import { existsSync, mkdirSync, statSync, renameSync, unlinkSync, appendFileSync } from "fs";
import { join, dirname } from "path";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export type LogCategory =
  | "AUTH"
  | "SERVER"
  | "COMPOSITOR"
  | "CANVAS"
  | "TEMPLATE"
  | "MEDIA"
  | "WIDGETS"
  | "SCHEDULER"
  | "WATCHER"
  | "WEBSOCKET"
  | "SYSTEM";

const LOGS_DIR = join(process.cwd(), "state", "cache", "logs");
const ACTIVE_LOG_FILE = join(LOGS_DIR, "server.log");
const MAX_FILE_SIZE = 5000000; // 5MB
const MAX_BACKUPS = 8;

export class Logger {
  private static instance: Logger;

  private constructor() {
    this.initLogsDir();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private initLogsDir(): void {
    try {
      if (!existsSync(LOGS_DIR)) {
        mkdirSync(LOGS_DIR, { recursive: true });
      }
    } catch (e) {
      console.error(`[logger-init] Failed to create logs directory: ${(e as Error).message}`);
    }
  }

  /**
   * Main logs writer. Enforces structured JSON formatting and size rotation.
   */
  private write(level: LogLevel, category: LogCategory, message: string, meta: Record<string, any> = {}): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      meta
    };

    const logString = JSON.stringify(logEntry);

    // 1. Output stringified JSON to console (process.stdout)
    if (level === "ERROR") {
      console.error(logString);
    } else if (level === "WARN") {
      console.warn(logString);
    } else {
      console.log(logString);
    }

    // 2. Persistent file append with active size rotation checks
    try {
      this.rotateIfNeeded();
      appendFileSync(ACTIVE_LOG_FILE, logString + "\n", "utf8");
    } catch (e) {
      // Avoid recursive errors in case of disk permission problems
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        category: "SYSTEM",
        message: `Failed to write to log file: ${(e as Error).message}`,
        meta: {}
      }));
    }
  }

  /**
   * Checks the size of server.log and rolls files if >= 5MB limit is met.
   */
  private rotateIfNeeded(): void {
    if (!existsSync(ACTIVE_LOG_FILE)) return;

    try {
      const size = statSync(ACTIVE_LOG_FILE).size;
      if (size >= MAX_FILE_SIZE) {
        // Delete oldest backup file if it exists
        const oldestBackup = join(LOGS_DIR, `server.${MAX_BACKUPS}.log`);
        if (existsSync(oldestBackup)) {
          unlinkSync(oldestBackup);
        }

        // Shift existing backup files sequentially
        for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
          const currentPath = join(LOGS_DIR, `server.${i}.log`);
          const nextPath = join(LOGS_DIR, `server.${i + 1}.log`);
          if (existsSync(currentPath)) {
            renameSync(currentPath, nextPath);
          }
        }

        // Shift active log file to server.1.log
        renameSync(ACTIVE_LOG_FILE, join(LOGS_DIR, "server.1.log"));
        
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "INFO",
          category: "SYSTEM",
          message: "Active log file rotated successfully.",
          meta: { max_backups: MAX_BACKUPS }
        }));
      }
    } catch (e) {
      console.error(`[logger-rotation] Log file rotation failed: ${(e as Error).message}`);
    }
  }

  public debug(category: LogCategory, message: string, meta?: Record<string, any>): void {
    this.write("DEBUG", category, message, meta);
  }

  public info(category: LogCategory, message: string, meta?: Record<string, any>): void {
    this.write("INFO", category, message, meta);
  }

  public warn(category: LogCategory, message: string, meta?: Record<string, any>): void {
    this.write("WARN", category, message, meta);
  }

  public error(category: LogCategory, message: string, err?: Error | unknown, meta: Record<string, any> = {}): void {
    const errorMeta = {
      ...meta,
      error: err instanceof Error ? {
        name: err.name,
        message: err.message,
        stack: err.stack
      } : err
    };
    this.write("ERROR", category, message, errorMeta);
  }
}

export const logger = Logger.getInstance();
