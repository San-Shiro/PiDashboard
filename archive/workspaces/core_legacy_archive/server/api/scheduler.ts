import { existsSync, mkdirSync, readFile, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { getIpcDir } from "../ipc/tmpfs-watcher";
import { getWidgetInstances } from "./widgets";
import { logger } from "../utils/logger";

// In-memory registries
export const fetchTimers = new Map<string, any>();
export const stateCache = new Map<string, any>();
const fetchAttempts = new Map<string, number>();

// Log & Event file paths
const EVENTS_LOG_FILE = join(process.cwd(), "state", "cache", "logs", "events.jsonl");



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

  const fetchRoutine = async () => {
    try {
      if (!inst.manifest?.entrypoints?.fetchModule) {
        throw new Error(`Widget ${inst.widget_id} is missing entrypoints.fetchModule in manifest`);
      }
      
      // Load the widget's fetch module dynamically
      const mod = await import(`../../../widgets/${inst.widget_id}/${inst.manifest.entrypoints.fetchModule}`);
      const data = await mod.fetchData(inst.widget_config);

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

