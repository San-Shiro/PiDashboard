import { existsSync, mkdirSync, watch, readFile, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger";
import { stateCache } from "../api/scheduler";

const debounceTimers = new Map<string, any>();

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
            
            // Write cache to disk to survive restarts (Implementation Gap Fix)
            const cacheDir = join(process.cwd(), "state", "cache");
            if (!existsSync(cacheDir)) {
              mkdirSync(cacheDir, { recursive: true });
            }
            writeFileSync(join(cacheDir, `${widgetId}.json`), content, "utf8");

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
