# Testing Suite & Verification Guide: PiDashboard

This document outlines the testing frameworks, automated mock systems, and command execution profiles used in the PiDashboard project.

---

## 1. Test Architecture & Runners

| Component | Framework | Command | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend & Host** | Bun Test | `bun test` | API responses, configuration reloads, auth sessions, and state triggers |
| **Frontend SPA** | Vite + React tsc | `tsc && vite build` | Static TypeScript compiling and validation |

---

## 2. Backend Automated Test Coverage

The backend system verification is located under `core/server/api/system.test.ts`:

- **CPU & Memory Metric Audits:** Asserts that system diagnostics APIs contain standard keys:
  - `cpu`: `{ usage: number, temp: number }`
  - `memory`: `{ total: number, free: number, used: number, usagePercent: number }`
  - `uptime`: `number`
- **Maintenance State Audits:** Checks that switching active modes using `setMaintenanceMode(boolean)` registers correctly and broadcasts statuses.

---

## 3. Platform Diagnostics Mocking

Since production runs on Linux (Raspberry Pi Zero 2W) but developers run code on local sandboxes (Windows/macOS), the backend implements mock diagnostics fallbacks:

- **Proc files check:** Checks if `/proc/meminfo`, `/proc/stat`, and `/sys/class/thermal/thermal_zone0/temp` exist.
- **Fallback values:** If these paths are absent (like on Windows), the diagnostics engine dynamically falls back to providing safe metrics (e.g., CPU temp: `41.2°C`, CPU usage: `15%`, simulated processes: `bun`, `cog`) without crashing.
- **Backwards compatibility:** The API provides both old nested objects and flattened parameters so that older tests stay green and newer React components read exact MB values without displaying `undefined`.

---

## 4. How to Execute Tests

To execute tests on the local workspace environment, run:

```powershell
# Run the Bun test suite absolutely
C:\Users\Ketan\.bun\bin\bun.exe test api/system.test.ts
```

> **Note:** Ensure that port `3000` is free when executing tests. The test runner imports files that try to initialize the server, which can trigger `EADDRINUSE` if the background server process is running.
