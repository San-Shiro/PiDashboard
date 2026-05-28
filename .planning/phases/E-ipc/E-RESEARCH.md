# Phase E: tmpfs IPC & Data Pipeline - Technical Research

**Date:** 2026-05-28
**Status:** Completed

---

## 1. Bun Scheduler Tickers (`setInterval`)

### Objective
Spawn isolated, standalone timers for each active widget defined in `canvases/active.json` that belongs to **Tier 1b** (Bun-fetched).

### Architecture
- Maintain a global in-memory registry of active timers: `const fetchTimers = new Map<string, any>()`.
- Upon server boot or when a new layout is published:
  1. Iterate over all existing timers in `fetchTimers` and clear them via `clearInterval()`.
  2. Clear the map.
  3. Load `canvases/active.json` and get all active widget placements.
  4. Hydrate their manifests from the scanned registry to check if they are **Tier 1b**.
  5. For each Tier 1b widget:
     - Read its `polling.pollIntervalSec` from its manifest (defaulting to 60s if absent).
     - Calculate the interval in milliseconds: `const ms = intervalSec * 1000`.
     - Define the fetch routine: execute an asynchronous request fetching from its configured source, apply a strict 5-second timeout using a standard `AbortController` signal, and write the resulting JSON directly to the IPC RAM-disk directory under `<widget_id>.json`.
     - Register the timer: `fetchTimers.set(instanceId, setInterval(fetchRoutine, ms))`.
     - Execute the initial fetch immediately upon startup so the visual displays are not blank for the first poll cycle.

### Fault Tolerance & Isolation
- Each fetch routine runs in an isolated `try/catch` block.
- A request failure (e.g., DNS error, status 500) will log a warning to the server console and write a fallback status/error payload or continue using the last cached data, ensuring that failures do not crash the Bun process or block subsequent intervals.

---

## 2. tmpfs Watcher IPC (`fs.watch`)

### Objective
Detect instant file additions, modifications, or deletions in the IPC RAM-disk directory (`PIDASH_IPC_DIR`) and broadcast data packets to connected display clients.

### Path Resolution
- Read the environment variable `PIDASH_IPC_DIR` using `process.env.PIDASH_IPC_DIR`.
- Default to `/tmp/widgets/` on Linux/Raspberry Pi.
- If running on Windows or if `/tmp/` is unavailable, fall back to a workspace-local directory: `join(process.cwd(), "state", "cache", "widgets")`.
- Automatically create the target directory recursively using `mkdirSync(path, { recursive: true })` upon startup.

### File Watcher Logic
- Bun natively supports Node.js `fs.watch()`. We will watch the resolved IPC folder.
- **Debouncing:** File writes can trigger multiple filesystem watch events in quick succession. We will implement a lightweight, map-based debouncing check (`const debounceTimers = new Map<string, any>()`) to ensure that a file change only triggers a single WebSocket broadcast per 100ms.
- **Action:**
  1. On change event, extract the filename (e.g. `weather.json`).
  2. Parse the widget name (the basename without `.json` extension, e.g., `weather`).
  3. Read the file content asynchronously, parse the JSON, and call the WebSocket broadcast handler.

---

## 3. WebSocket Caching & State Hydration

### Objective
Prevent kiosks from showing empty layouts or holding loading indicators upon initial boot or manual page reload.

### Caching Architecture
- Maintain an in-memory database of the latest published states: `const stateCache = new Map<string, any>()`.
- Whenever a file change is read by the `fs.watch` watcher:
  - Cache the parsed JSON payload: `stateCache.set(widgetId, data)`.
  - Broadcast the update to all connected kiosks.

### State Hydration on Connection
- In `core/server/index.ts`, when a new kiosk WebSocket connects under `/ws/display`:
  1. Loop through all cached states in `stateCache`.
  2. For each cached item, instantly transmit a `data` message containing the cached payload:
     ```json
     { "type": "data", "widget": "widgetId", "data": { ... } }
     ```
  3. This hydrates the display client instantly before any scheduled poll or native daemon write occurs.
