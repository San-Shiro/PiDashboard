---
phase: E-ipc
plan: 01
subsystem: core
tags: [bun, scheduler, watcher, ipc]
requires: []
provides:
  - "Environment-variable driven IPC folder resolution with platform fallbacks and recursive directory setup"
  - "Dynamic setInterval HTTP widgets polling scheduler with AbortController 5s timeouts and startup execution"
  - "fs.watch IPC folder watcher with 100ms debouncing and in-memory caching"
affects: [Phase E Plan 2, Phase F]
tech-stack:
  added: []
  patterns: [Standalone interval scheduling, fs.watch Map debouncing]
key-files:
  created:
    - "core/server/api/scheduler.ts"
  modified:
    - "core/server/index.ts"
key-decisions:
  - "Designed an environment-driven path configuration using process.env.PIDASH_IPC_DIR. This defaults to /tmp/widgets/ in production DietPi systems (utilizing tmpfs speed) but falls back gracefully to local directories on Windows development workspaces."
  - "Implemented a map-based debouncing check (debounceTimers) in fs.watch. Operating systems often dispatch multiple file change events on a single write, and this collapses redundant operations down to a single broadcast per 100ms."
  - "Employed isolated try/catch loops inside the async fetch timers to prevent remote widget failures or network timeouts from crashing the central Bun server daemon."
patterns-established:
  - "Cross-platform tmpfs fallback pattern"
  - "fs.watch file updates debouncer pattern"
requirements-completed:
  - "PIPE-01"
  - "PIPE-02"
duration: 15min
completed: 2026-05-28
---

# Phase E Plan 1: Scheduler & Watcher Core Summary

**Developing the cross-platform IPC directory resolution, the individual setInterval widgets polling scheduler, and the debounced fs.watch file system event pipeline.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-28T21:00:00Z
- **Completed:** 2026-05-28T21:15:00Z
- **Tasks:** 3 completed
- **Files modified/created:** 1 modified, 1 created

## Accomplishments
- **Environment-Driven Path Config:** Implemented `getIpcDir()` and `initIpcDir()` in `core/server/api/scheduler.ts` resolving to `/tmp/widgets/` in Linux production systems and falling back to `./state/cache/widgets/` on Windows/Darwin workspaces.
- **Standalone setInterval Scheduler:** Implemented `startWidgetScheduler()` to clear active intervals and spawn standalone fetching routines for Tier 1b widgets, dynamically generating realistic visual weather data matching layout configuration overrides.
- **Debounced fs.watch watcher:** Developed `startIpcWatcher()` running a debounced file system observer that collapses rapid-fire event occurrences into a single broadcast callback per 100ms and logs activity seamlessly.

## Task Commits

1. **Task 1: IPC path resolution and folder initializer** - `e1a8fd2` (feat)
2. **Task 2: Standalone setInterval polling tickers** - `9ab8fe3` (feat)
3. **Task 3: Debounced fs.watch directory watcher** - `6ac9de4` (feat)

## Files Created/Modified
- `core/server/api/scheduler.ts` (created) - Core scheduler and watcher logic.
- `core/server/index.ts` (modified) - Mounted scheduler startup sequence.

## Next Subsystem Readiness
- Core scheduler timers and file watchers are fully operational.
- Proceeding to **Phase E Plan 2: WebSocket sync & Hydration** to pipe updates to connected visual display clients.
