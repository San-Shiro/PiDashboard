# Phase F: Logging & Tiered Error Recovery - Technical Research

**Date:** 2026-05-28
**Status:** Completed

---

## 1. Centralized Structured JSON Logger (`core/server/utils/logger.ts`)

### Objective
Provide a unified, highly optimized, singleton logging class that outputs structured single-line JSON records to both the console and persistent files.

### Design Details
- Standardized severity levels: `DEBUG`, `INFO`, `WARN`, `ERROR`.
- Standardized category scopes: `AUTH`, `SERVER`, `COMPOSITOR`, `CANVAS`, `TEMPLATE`, `MEDIA`, `WIDGETS`, `SCHEDULER`, `WATCHER`, `WEBSOCKET`, `SYSTEM`.
- Method signatures:
  - `logger.info(category, message, meta?)`
  - `logger.warn(category, message, meta?)`
  - `logger.error(category, message, err?, meta?)`
  - `logger.debug(category, message, meta?)`
- Console and file streams must capture logs in unified JSON strings:
  ```json
  {"timestamp":"2026-05-28T21:00:00.000Z","level":"INFO","category":"SERVER","message":"Server started","meta":{}}
  ```
- File writing must write to `state/logs/server.log` asynchronously or synchronously in isolated try/catch loops to avoid holding locks on SSDs/SD cards.

---

## 2. Rotation-Aware Filesystem Rotation

### Objective
Maintain a strict storage footprint limit (aggregate max 45MB) by dividing logs into small 5MB files.

### Rotation Algorithm
- Every time a log is appended to `state/logs/server.log`:
  1. Check the file size of `server.log` using `statSync(filePath).size`.
  2. If the size exceeds 5,000,000 bytes (5MB):
     - Delete `server.8.log` if it exists.
     - Rename `server.7.log` to `server.8.log`.
     - Rename `server.6.log` to `server.7.log`.
     - ...
     - Rename `server.log` to `server.1.log`.
     - Create a fresh `server.log` and write the log record.
  3. This ensures that the server never stores more than 9 logs (1 active + 8 backups), keeping the total footprint under 45MB (maximum 45,000,000 bytes) and protecting the low-resource Raspberry Pi Zero 2W's limited SD card space.

---

## 3. Persistent JSONL Event Crash Recorder & Exponential Backoff

### Objective
Log system crashes and connection failures to `state/logs/events.jsonl`, enforcing exponential retry backoffs on scheduler HTTP request failures to prevent thundering herds.

### JSONL Crash Recorder
- Standardize events format:
  ```json
  {"timestamp":"2026-05-28T21:05:00.000Z","event":"fetch_failed","widget_id":"weather","error":"Request timeout","attempts":3,"next_retry_in_sec":480}
  ```
- Appends lines atomically to `state/logs/events.jsonl` on any failure.

### Jittered Exponential Backoff Scheduler Logic
- Maintain a global tracking Map: `const fetchAttempts = new Map<string, number>()`.
- In `startWidgetScheduler()`, when a Tier 1b request fails:
  1. Increment the failure count: `const attempts = (fetchAttempts.get(inst.id) || 0) + 1; fetchAttempts.set(inst.id, attempts);`.
  2. Calculate exponential interval multiplier: `const factor = Math.min(Math.pow(2, attempts), 8);`.
  3. Base interval in milliseconds is multiplied by `factor`. E.g., for a 60s base poll, consecutive failures poll at: 120s, 240s, 480s, 480s (max cap 8x).
  4. Add random Jitter: `const jitter = (Math.random() * 4 - 2) * 1000;` (adds/subtracts 1-2 seconds).
  5. Cancel the current `setInterval` timer: `clearInterval(fetchTimers.get(inst.id))`.
  6. Schedule a single-shot `setTimeout` using the backed-off interval to attempt recovery:
     - If the backed-off request succeeds:
       - Clear attempts tracking: `fetchAttempts.set(inst.id, 0)`.
       - Re-register the standard `setInterval` timer mapping the base poll interval.
       - Log the recovery event in `events.jsonl` and structured logs.
     - If the request fails again:
       - Recurse, calculating the next backoff level.
