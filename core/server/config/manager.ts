import { existsSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), "config", "config.json");
const DEFAULT_CONFIG = {
  widgets: {},
  logging: {
    level: "info",
    enableAccessLog: false,
    maxFileSizeMB: 5,
    maxRotatedFiles: 3
  },
  system: {
    maintenanceMode: false
  }
};

export class ConfigManager {
  private config: typeof DEFAULT_CONFIG;

  constructor() {
    this.config = this.load();
  }

  private load(): typeof DEFAULT_CONFIG {
    try {
      if (existsSync(CONFIG_PATH)) {
        const raw = readFileSync(CONFIG_PATH, "utf8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn(`[config] Failed to parse config, using defaults: ${(e as Error).message}`);
    }
    this.saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  private saveConfig(newConfig: typeof DEFAULT_CONFIG): void {
    const dir = join(process.cwd(), "config");
    const tmpPath = `${CONFIG_PATH}.tmp`;
    try {
      // Atomic write-rename
      writeFileSync(tmpPath, JSON.stringify(newConfig, null, 2), "utf8");
      renameSync(tmpPath, CONFIG_PATH);
    } catch (e) {
      console.error(`[config] Failed to write config atomically: ${(e as Error).message}`);
      // Fallback direct write
      try {
        writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), "utf8");
      } catch (err) {
        console.error(`[config] Extreme fallback failed: ${(err as Error).message}`);
      }
    }
  }

  public get<K extends keyof typeof DEFAULT_CONFIG>(key: K): typeof DEFAULT_CONFIG[K] {
    return this.config[key];
  }

  public set<K extends keyof typeof DEFAULT_CONFIG>(key: K, value: typeof DEFAULT_CONFIG[K]): void {
    this.config[key] = value;
    this.saveConfig(this.config);
  }
}

export const configManager = new ConfigManager();
