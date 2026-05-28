---
phase: E-ipc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - "core/server/index.ts"
files_created:
  - "core/server/api/scheduler.ts"
autonomous: true
requirements:
  - "PIPE-01"
  - "PIPE-02"
must_haves:
  truths:
    - "IPC directory paths resolve correctly via PIDASH_IPC_DIR env variables with fallback paths."
    - "Standalone setInterval polling fetch timers run per Tier 1b widget and clear on layout publishes."
    - "fs.watch directory watchers capture widgets JSON files modifications with 100ms debouncing."
  artifacts:
    - path: "core/server/api/scheduler.ts"
      provides: "HTTP polling timers scheduler, fs.watch directory watchers, and state cache"
      contains: "fs.watch"
---

<objective>
Implement the environment-variable-driven IPC folder setup, standalone setInterval fetching timers, and fs.watch watcher.

Purpose: Establishes a zero-RAM memory-mapped file pipeline using tmpfs directories.
Output: Dynamic intervals scheduler, automatic AbortController 5s timeouts, and fs.watch directory event listeners.
</objective>

<execution_context>
@~/.gemini/antigravity/get-shit-done/workflows/execute-plan.md
@~/.gemini/antigravity/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/E-ipc/E-CONTEXT.md
@.planning/phases/E-ipc/E-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Resolve IPC directory paths and setup folder</name>
  <files>core/server/api/scheduler.ts</files>
  <read_first>
    - core/server/index.ts
    - core/server/api/widgets.ts
  </read_first>
  <action>
    Create core/server/api/scheduler.ts and implement getIpcDir():
    1. Read process.env.PIDASH_IPC_DIR. If present, use it.
    2. If absent, fallback to:
       - "/tmp/widgets" on Linux systems (check process.platform === "linux").
       - join(process.cwd(), "state", "cache", "widgets") on non-Linux (e.g. Windows/Darwin) systems.
    3. Implement initIpcDir() to recursively create the resolved path using existsSync/mkdirSync.
    4. Export these functions.
  </action>
  <verify>
    Run npm run build --workspace=admin to check path compiles.
  </verify>
  <acceptance_criteria>
    - getIpcDir resolves to absolute tmpfs path or local development cache fallback.
    - initIpcDir correctly creates the target folder recursively if it does not exist.
  </acceptance_criteria>
  <done>IPC directory setup and cross-platform path resolution are complete</done>
</task>

<task type="auto">
  <name>Task 2: Build individual setInterval fetching tickers</name>
  <files>core/server/api/scheduler.ts, core/server/index.ts</files>
  <read_first>
    - core/server/api/widgets.ts
    - core/server/index.ts
  </read_first>
  <action>
    Implement HTTP polling scheduler inside core/server/api/scheduler.ts:
    1. Export a global Map tracking timers: fetchTimers = new Map&lt;string, any&gt;().
    2. Export a global Map caching the latest parsed widget payloads: stateCache = new Map&lt;string, any&gt;().
    3. Implement startWidgetScheduler() to:
       - Clear any existing timers in fetchTimers and clear the registry.
       - Load active widgets using getWidgetInstances().
       - Filter for widgets with manifest.tier === "1b".
       - For each Tier 1b widget, query its configuration (instance.widget_config, e.g. location, units) and manifest configSchema keys.
       - Define an async fetchRoutine() that executes fetch(url) to the widget's API, applying a strict 5-second AbortController timeout signal, parses JSON, and writes it directly to join(getIpcDir(), `${widget_id}.json`).
       - Register setInterval(fetchRoutine, intervalSec * 1000) inside fetchTimers.
       - Fire the initial fetchRoutine() immediately on registration.
    4. Mount startWidgetScheduler() inside core/server/index.ts during server launch, and call it dynamically inside POST /api/canvas/publish and POST /api/templates/:id/apply to reset timers on new layout publications.
  </action>
  <verify>
    Vite workspace build compiles with zero errors.
  </verify>
  <acceptance_criteria>
    - fetchTimers cleanly registers and clears interval nodes.
    - startWidgetScheduler initiates HTTP fetches and writes data directly to files in IPC directory.
    - HTTP requests abort successfully if they exceed 5 seconds.
  </acceptance_criteria>
  <done>Dynamic setInterval HTTP widgets polling scheduler is operational</done>
</task>

<task type="auto">
  <name>Task 3: Implement fs.watch watcher with debouncing</name>
  <files>core/server/api/scheduler.ts</files>
  <read_first>
    - core/server/api/scheduler.ts
  </read_first>
  <action>
    Implement the filesystem watcher inside core/server/api/scheduler.ts:
    1. Export startIpcWatcher(onUpdate: (widgetId: string, data: any) =&gt; void):
       - Start fs.watch(getIpcDir(), (eventType, filename) =&gt; { ... }).
       - Filter eventType and assert that filename ends with ".json".
       - Implement a 100ms Map-based debouncer (debounceTimers = new Map&lt;string, any&gt;()) to group duplicate fs.watch events.
       - Read the file content asynchronously via fs.readFile, parse the JSON payload, and store it inside the global in-memory stateCache Map.
       - Execute the onUpdate callback passing the parsed widget ID and data payload.
    2. Wrap file reads and JSON parses in robust try/catch blocks to gracefully handle partial writes or corrupted temporary buffers without crashing the watcher.
  </action>
  <verify>
    Verify compilation and start is green.
  </verify>
  <acceptance_criteria>
    - startIpcWatcher watches files in getIpcDir().
    - 100ms debouncing correctly limits duplicate broad-scale event dispatches.
    - stateCache stores the latest parsed JSON.
  </acceptance_criteria>
  <done>fs.watch IPC directory watcher with debouncing is complete</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Run `npm run build --workspace=admin` to ensure Vite compilations are green.
</verification>

<success_criteria>
- IPC path resolves dynamically with proper fallbacks.
- Scheduler and watcher processes run concurrently without blocking.
</success_criteria>

<output>
After completion, create `.planning/phases/E-ipc/E-01-SUMMARY.md`
</output>
