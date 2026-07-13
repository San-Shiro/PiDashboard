import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger";

const CRASH_LOG_FILE = join(process.cwd(), "state", "cache", "logs", "crashes.jsonl");

export interface CrashEvent {
  id: string;
  timestamp: string;
  source: string;
  tier: string;
  error: string;
  stack?: string;
  exitCode?: number;
  restartCount?: number;
  resolved: boolean;
}

export function recordCrash(source: string, tier: string, error: string, meta: Partial<CrashEvent> = {}) {
  const event: CrashEvent = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    source,
    tier,
    error,
    resolved: false,
    ...meta
  };

  try {
    const logsDir = join(process.cwd(), "state", "cache", "logs");
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    appendFileSync(CRASH_LOG_FILE, JSON.stringify(event) + "\n", "utf8");
    logger.error("CRASH", `Recorded crash for ${source}: ${error}`);
  } catch (e) {
    console.error(`[crash-recorder] Failed to write crash log: ${(e as Error).message}`);
  }
}

export function getRecentCrashes(hours: number = 24): CrashEvent[] {
  try {
    if (!existsSync(CRASH_LOG_FILE)) return [];
    
    const lines = readFileSync(CRASH_LOG_FILE, "utf8").split("\n").filter(l => l.trim().length > 0);
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    
    return lines
      .map(l => JSON.parse(l) as CrashEvent)
      .filter(event => event.timestamp >= cutoff)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    return [];
  }
}

export function getCrashStats(): Record<string, number> {
  const crashes = getRecentCrashes(24 * 7); // Last 7 days
  const stats: Record<string, number> = {};
  
  crashes.forEach(c => {
    stats[c.source] = (stats[c.source] || 0) + 1;
  });
  
  return stats;
}
