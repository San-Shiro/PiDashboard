# Compositor & Scheduler Internals Guide

This document details the underlying code mechanics of the **HTML Compositor** and **API Scheduler / Watcher** within PiDashboard, as well as the custom environment variables that control them.

---

## 🎨 1. HTML Compositor (`compose.ts`)

The HTML compositor ([compose.ts](./../server/compositor/compose.ts)) is the central layout engine of PiDashboard. It dynamically renders a single, lightweight HTML document for the kiosk client from the active layout config and visual widget fragments.

### Core Compositor Flow
1. **Load Layout Canvas:** Reads `core/canvases/active.json`.
2. **Inject CSS styling:** Standard system styles are injected.
3. **Parse Placement Configurations:** Iterates through placed widget instances.
4. **Isolate Widget Slices:** For each active widget instance, reads the custom `.html` fragment specified by `entrypoints.fragment` inside its manifest.
5. **Absolute Layout Wrapper & Dataset Binding:** Encapsulates the fragment in a `div` wrapper styled with absolute coordinate sizing based on its `base_config` (`x`, `y`, `width`, `height`, `zIndex`, `opacity`). The server injects:
   - `data-widget="[widget-id]"` attributes for isolated CSS selectors.
   - `data-config="[stringified JSON]"` holding specific instance config variables (e.g. format, unit).
6. **Auto-scaling Script Injection:** Inserts an embedded runtime script. Using `ResizeObserver` API, it monitors window dimensions and performs proportional scaling transforms (`transform: scale(...)`), ensuring layouts adapt to different display screens (e.g., 720p monitor, 1080p kiosk) without responsive layout breakage.
7. **WebSocket Reconnection Loop:** Injects a lightweight WebSocket client script that connects to `/ws/display`. This handles automatic connection state recoveries with incremental backoffs to guarantee the kiosk screen never stays offline.

---

## ⏱️ 2. API Scheduler & Watcher (`scheduler.ts`)

The Scheduler and Watcher engine ([scheduler.ts](./../server/api/scheduler.ts)) controls background data flow, watches local IPC updates, maps intervals, and journals status flags.

### ⏱️ Scheduler & Exponential Backoff Timers
For Tier 1b (Server-Fetched) widgets, the scheduler registers standalone timers matching the polling intervals specified in the manifests.
If a scheduled fetch routine fails (e.g., DNS timeout or network outage):
- **Exponential Backoff:** The polling interval is immediately backed off by a factor of $2^n$ (where $n$ is consecutive failure attempts), capped at a maximum of $8\times$ the base interval.
- **Random Jitter:** Adds a random jitter factor of $\pm 2$ seconds to prevent multiple failed queries from hitting third-party APIs simultaneously (thundering herd problem).
- **Auto-Recovery Detection:** Once a polling routine succeeds after a series of failures, the scheduler clears the backoff time, deletes the failure count log, journals a `fetch_recovered` event, and automatically restores the standard base polling interval.
- **State Hydration:** When a display kiosk connects via WebSocket, the server pulls data from `stateCache` and instantly pushes all cached states to the browser, ensuring zero loading delay.

### 🔍 tmpfs RAM-Disk Watcher & Debouncing
For Tier 2 (Daemon-Driven) widgets, a filesystem watcher is initialized on the IPC folder using `fs.watch`:
- **100ms Debouncer:** Operating systems often trigger multiple rapid-fire write signals during file modifications. To prevent waste of CPU context-switching, the watcher implements a 100ms debouncer.
- **Atomic Renames:** Watches atomic `os.Rename` operations (temp file rename -> JSON target), completely avoiding reading half-written buffer chunks.
- **WebSocket Broadcast:** The updated JSON contents are read, cached inside the in-memory `stateCache`, and instantly sent to all connected kiosk screens via the WebSocket pipeline.

### 📊 System Event Journaling
Whenever a scheduled polling fails, recovers, or changes state, a structured entry is written atomically to `/core/state/cache/logs/events.jsonl`:
```json
{"timestamp":"2026-05-28T21:00:00.123Z","event":"fetch_failed","widget_id":"weather","error":"API rate limit exceeded","attempts":2,"next_retry_in_sec":120}
```

---

## ⚙️ 3. Environment Variables Reference

PiDashboard uses environment variables to allow seamless execution across development (e.g. Windows/macOS laptop) and production (e.g. DietPi kiosk client):

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`PORT`** | Integer | `3000` | Sets the port on which the Bun HTTP/WebSocket server listens. |
| **`PIDASH_IPC_DIR`** | String Path | *(Operating System Dependent)* | Absolute folder path where Tier 2 daemons write JSON metric files and the scheduler watches. |

### 🔍 Platform-Dependent IPC Folder Fallbacks
If `PIDASH_IPC_DIR` is not explicitly set:
- **On Linux platforms:** Evaluates to `/tmp/widgets` (mounted to in-memory `tmpfs` RAM-disk).
- **On Windows & macOS development environments:** Evaluates to local workspace path `core/state/cache/widgets`, avoiding execution crashes when native linux tmp paths are missing.
