import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { configManager } from "../config/manager";
import { kiosks } from "../index";

export function getSystemStats(): any {
  let cpuUsage = 15; // Baseline default mock
  let totalMem = 512 * 1024 * 1024; // Default 512MB (Pi Zero 2W)
  let freeMem = 280 * 1024 * 1024;
  let temp = 41.2; // default temp °C

  // 1. Linux Meminfo Parse
  const meminfoPath = "/proc/meminfo";
  if (existsSync(meminfoPath)) {
    try {
      const content = readFileSync(meminfoPath, "utf8");
      const totalMatch = content.match(/MemTotal:\s+(\d+)\s+kB/);
      const freeMatch = content.match(/MemAvailable:\s+(\d+)\s+kB/) || content.match(/MemFree:\s+(\d+)\s+kB/);
      if (totalMatch) totalMem = parseInt(totalMatch[1]) * 1024;
      if (freeMatch) freeMem = parseInt(freeMatch[1]) * 1024;
    } catch (e) {
      console.warn(`[system] Meminfo read failed: ${(e as Error).message}`);
    }
  }

  // 2. Linux Thermal Zone Parse
  const thermalPath = "/sys/class/thermal/thermal_zone0/temp";
  if (existsSync(thermalPath)) {
    try {
      const rawTemp = readFileSync(thermalPath, "utf8");
      temp = parseInt(rawTemp.trim()) / 1000;
    } catch (e) {
      console.warn(`[system] Thermal read failed: ${(e as Error).message}`);
    }
  }

  // 3. Proc CPU Stats parse
  const statPath = "/proc/stat";
  if (existsSync(statPath)) {
    try {
      const firstLine = readFileSync(statPath, "utf8").split("\n")[0];
      const match = firstLine.match(/^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (match) {
        const user = parseInt(match[1]);
        const nice = parseInt(match[2]);
        const system = parseInt(match[3]);
        const idle = parseInt(match[4]);
        const total = user + nice + system + idle;
        cpuUsage = Math.round(((total - idle) / total) * 100);
      }
    } catch (e) {}
  }

  return {
    cpu: {
      usage: cpuUsage,
      temp: parseFloat(temp.toFixed(1))
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
      usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100)
    },
    uptime: Math.round(process.uptime())
  };
}

export function setMaintenanceMode(enabled: boolean): void {
  const current = configManager.get("system");
  configManager.set("system", { ...current, maintenanceMode: enabled });

  console.log(`[system] Maintenance Mode ${enabled ? "ENABLED" : "DISABLED"}`);

  // Broadcast maintenance socket payload to connected kiosks
  const msg = JSON.stringify({ type: "maintenance", enabled });
  for (const ws of kiosks) {
    try {
      ws.send(msg);
    } catch (e) {
      console.warn(`[system] Kiosk WS alert failed: ${(e as Error).message}`);
    }
  }
}

export function getMaintenanceMode(): boolean {
  return configManager.get("system").maintenanceMode;
}
