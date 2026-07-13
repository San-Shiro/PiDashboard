import { describe, it, expect } from "bun:test";
import { getSystemStats, setMaintenanceMode, getMaintenanceMode } from "./system";

describe("System and Maintenance API Core", () => {
  it("should retrieve system stats successfully containing CPU and Memory metrics", () => {
    const stats = getSystemStats();
    
    // CPU checks
    expect(stats).toHaveProperty("cpu");
    expect(stats.cpu).toHaveProperty("usage");
    expect(stats.cpu).toHaveProperty("temp");
    expect(typeof stats.cpu.usage).toBe("number");
    expect(typeof stats.cpu.temp).toBe("number");

    // Memory checks
    expect(stats).toHaveProperty("memory");
    expect(stats.memory).toHaveProperty("total");
    expect(stats.memory).toHaveProperty("free");
    expect(stats.memory).toHaveProperty("used");
    expect(stats.memory).toHaveProperty("usagePercent");
    expect(typeof stats.memory.total).toBe("number");
    expect(typeof stats.memory.free).toBe("number");
  });

  it("should successfully set and query Maintenance Mode config states", () => {
    // Save previous state to avoid pollution
    const originalState = getMaintenanceMode();

    setMaintenanceMode(true);
    expect(getMaintenanceMode()).toBe(true);

    setMaintenanceMode(false);
    expect(getMaintenanceMode()).toBe(false);

    // Restore
    setMaintenanceMode(originalState);
  });
});
