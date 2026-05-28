import { existsSync, mkdirSync, watch, readFile, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { getWidgetInstances } from "./widgets";
import { logger } from "../utils/logger";

// In-memory registries
export const fetchTimers = new Map<string, any>();
export const stateCache = new Map<string, any>();
const debounceTimers = new Map<string, any>();
const fetchAttempts = new Map<string, number>();

// Log & Event file paths
const EVENTS_LOG_FILE = join(process.cwd(), "state", "cache", "logs", "events.jsonl");

/**
 * Resolves the absolute directory path to the IPC RAM-disk directory.
 * Supports cross-platform environments using environment variables or fallbacks.
 */
export function getIpcDir(): string {
  if (process.env.PIDASH_IPC_DIR) {
    return process.env.PIDASH_IPC_DIR;
  }

  // Fallback depending on Process Operating System
  if (process.platform === "linux") {
    return "/tmp/widgets";
  }

  // Local development cache on Windows/Darwin
  return join(process.cwd(), "state", "cache", "widgets");
}

/**
 * Initializes the resolved IPC folder recursively.
 */
export function initIpcDir(): void {
  const dir = getIpcDir();
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.info("SYSTEM", `Created IPC directory: ${dir}`);
    } else {
      logger.info("SYSTEM", `IPC directory exists: ${dir}`);
    }
  } catch (e) {
    logger.error("SYSTEM", `Failed to initialize IPC directory at ${dir}: ${(e as Error).message}`, e);
  }
}

/**
 * Appends a structured failure or recovery event atomically to events.jsonl
 */
export function recordEvent(event: string, widgetId: string, error: string | null, meta: Record<string, any> = {}): void {
  const eventEntry = {
    timestamp: new Date().toISOString(),
    event,
    widget_id: widgetId,
    error,
    ...meta
  };
  try {
    const logsDir = join(process.cwd(), "state", "cache", "logs");
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    appendFileSync(EVENTS_LOG_FILE, JSON.stringify(eventEntry) + "\n", "utf8");
  } catch (e) {
    // Graceful console error write in case of file problems
    console.error(`[event-recorder] Failed to write event log: ${(e as Error).message}`);
  }
}

/**
 * Starts standalone timers for Tier 1b widgets, handling backoffs and recoveries.
 */
export function startWidgetScheduler(): void {
  // Clear any existing active intervals/timeouts
  fetchTimers.forEach((timer) => {
    clearInterval(timer);
    clearTimeout(timer);
  });
  fetchTimers.clear();

  const instances = getWidgetInstances();
  const tier1bWidgets = instances.filter((inst) => inst.manifest?.tier === "1b");

  logger.info("SCHEDULER", `Spawning timers for ${tier1bWidgets.length} active Tier 1b widgets.`);

  tier1bWidgets.forEach((inst) => {
    scheduleWidget(inst);
  });
}

/**
 * Configures scheduling for a single widget instance with backoff support.
 */
function scheduleWidget(inst: any, customIntervalMs?: number): void {
  const baseIntervalSec = inst.manifest.polling?.pollIntervalSec || 60;
  const baseIntervalMs = baseIntervalSec * 1000;

  const location = inst.widget_config?.location || "London";
  const units = inst.widget_config?.units || "metric";

  const fetchRoutine = async () => {
    try {
      // Simulate real query: let's enforce a random mock error if location is 'ErrorLocation' to allow controlled testing of backoffs
      if (location === "ErrorLocation") {
        throw new Error("Simulated DNS resolution failure or API connection timeout.");
      }

      // High-fidelity mock weather data
      const tempBase = location.toLowerCase().includes("york") ? 14 : 19;
      const temp = units === "imperial" ? Math.round(tempBase * 9/5 + 32) : tempBase;
      
      const data = {
        location,
        temp: temp + Math.sin(Date.now() / 60000) * 1.5,
        condition: "Partly Cloudy",
        tempMax: temp + 3,
        tempMin: temp - 4,
        humidity: 78 + Math.round(Math.sin(Date.now() / 30000) * 4),
        windSpeed: units === "imperial" ? 10 : 16,
        updated_at: Math.floor(Date.now() / 1000)
      };

      const filePath = join(getIpcDir(), `${inst.widget_id}.json`);
      writeFileSync(filePath, JSON.stringify(data), "utf8");

      // Successful execution: check if we recovered from previous failure
      if (fetchAttempts.has(inst.id)) {
        fetchAttempts.delete(inst.id);
        logger.info("SCHEDULER", `Widget instance ${inst.id} (${inst.widget_id}) recovered successfully. Restoring base polling interval.`);
        recordEvent("fetch_recovered", inst.widget_id, null, { instance_id: inst.id });
        
        // Restore standard recurring intervals scheduling
        scheduleWidget(inst);
      }
    } catch (err) {
      const attempts = (fetchAttempts.get(inst.id) || 0) + 1;
      fetchAttempts.set(inst.id, attempts);

      const factor = Math.min(Math.pow(2, attempts), 8); // max 8x
      const backoffMs = baseIntervalMs * factor;
      const jitter = (Math.random() * 4 - 2) * 1000; // jitter +/- 2 seconds
      const finalIntervalMs = Math.max(backoffMs + jitter, 1000); // hard limit min 1s

      logger.warn("SCHEDULER", `Widget instance ${inst.id} (${inst.widget_id}) poll execution failed (Attempt ${attempts}). Backing off retry to ${Math.round(finalIntervalMs / 1000)}s.`, {
        error: (err as Error).message
      });

      recordEvent("fetch_failed", inst.widget_id, (err as Error).message, {
        attempts,
        next_retry_in_sec: Math.round(finalIntervalMs / 1000),
        instance_id: inst.id
      });

      // Clear the current timer and register single-shot backoff setTimeout
      if (fetchTimers.has(inst.id)) {
        const activeTimer = fetchTimers.get(inst.id);
        clearInterval(activeTimer);
        clearTimeout(activeTimer);
      }

      const backoffTimeout = setTimeout(fetchRoutine, finalIntervalMs);
      fetchTimers.set(inst.id, backoffTimeout);
    }
  };

  // Clear current timer if any
  if (fetchTimers.has(inst.id)) {
    const activeTimer = fetchTimers.get(inst.id);
    clearInterval(activeTimer);
    clearTimeout(activeTimer);
  }

  if (customIntervalMs !== undefined) {
    // Single shot timeout retry trigger
    const timeout = setTimeout(fetchRoutine, customIntervalMs);
    fetchTimers.set(inst.id, timeout);
  } else {
    // Run once immediately on startup
    fetchRoutine();
    
    // Standard recurring interval ticker
    const timer = setInterval(fetchRoutine, baseIntervalMs);
    fetchTimers.set(inst.id, timer);
  }
}

/**
 * Starts the fs.watch watcher on the IPC directory with 100ms debouncing.
 */
export function startIpcWatcher(onUpdate: (widgetId: string, data: any) => void): void {
  const dir = getIpcDir();
  logger.info("WATCHER", `Initializing fs.watch on ${dir}`);

  try {
    watch(dir, (eventType, filename) => {
      if (!filename || !filename.endsWith(".json")) return;

      const widgetId = filename.replace(".json", "");

      // 100ms Debouncer check to collapse rapid-fire OS write events
      if (debounceTimers.has(widgetId)) {
        clearTimeout(debounceTimers.get(widgetId));
      }

      const debouncer = setTimeout(() => {
        debounceTimers.delete(widgetId);
        
        const filePath = join(dir, filename);
        if (!existsSync(filePath)) return;

        readFile(filePath, "utf8", (err, content) => {
          if (err) return;
          try {
            const data = JSON.parse(content);
            // Cache latest state in-memory
            stateCache.set(widgetId, data);
            // Execute websocket updates callback
            onUpdate(widgetId, data);
          } catch (e) {
            // Gracefully ignore partial or incomplete buffer writes
          }
        });
      }, 100);

      debounceTimers.set(widgetId, debouncer);
    });
  } catch (e) {
    logger.error("WATCHER", `Failed to start fs.watch watcher: ${(e as Error).message}`, e);
  }
}
