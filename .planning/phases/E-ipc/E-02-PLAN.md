---
phase: E-ipc
plan: 02
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - "core/server/index.ts"
files_created: []
autonomous: true
requirements:
  - "PIPE-03"
must_haves:
  truths:
    - "WebSocket server upgrades display clients, registers active sockets, and maintains robust registry lifecycle hooks."
    - "Initial client WebSocket connections trigger immediate state hydration pushes from the in-memory cache."
    - "FileSystem watcher file modifications trigger dynamic WebSocket push updates to all connected displays."
  artifacts:
    - path: "core/server/index.ts"
      provides: "WebSocket connection upgrades, state hydration caches, and real-time broadcasts pipeline"
      contains: "stateCache"
---

<objective>
Implement WebSocket client upgrades, immediate in-memory state hydration, and dynamic file changes broadcasting handlers.

Purpose: Empowers the kiosk visual display client with near-zero latency real-time layout data synchronization.
Output: Upgraded WebSockets registries, state hydration push loops, and debounced filesystem broadcasts.
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
@.planning/phases/E-ipc/E-01-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Mount WebSocket upgrades registry lifecycle</name>
  <files>core/server/index.ts</files>
  <read_first>
    - core/server/index.ts
  </read_first>
  <action>
    Integrate WebSocket server upgrade lifecycle in core/server/index.ts:
    1. Import the connection registry Set `kiosks` and verify standard websocket handlers (`open`, `close`, `message`).
    2. Ensure the `websocket.open` callback registers the socket into the `kiosks` Set.
    3. Ensure the `websocket.close` callback removes the socket from the registry safely to prevent memory leakages.
  </action>
  <verify>
    Check compile state.
  </verify>
  <acceptance_criteria>
    - Connection sockets are stored under active kiosks registry.
    - Sockets are cleared cleanly on closed connection gates.
  </acceptance_criteria>
  <done>WebSocket client upgrades lifecycle handlers are complete</done>
</task>

<task type="auto">
  <name>Task 2: Build state hydration loop on client connection</name>
  <files>core/server/index.ts</files>
  <read_first>
    - core/server/index.ts
    - core/server/api/scheduler.ts
  </read_first>
  <action>
    Implement connection hydration inside core/server/index.ts `websocket.open` handler:
    1. Import the global in-memory `stateCache` Map from core/server/api/scheduler.ts.
    2. Inside the `open(ws)` websocket callback, loop through all cached states in `stateCache`.
    3. For each cached element (representing the last good parsed JSON for a widget, e.g. cpu usage or weather metrics), send a text payload instantly to the socket:
       `ws.send(JSON.stringify({ type: "data", widget: widgetId, data: payload }))`
  </action>
  <verify>
    Vite compilation check is successful.
  </verify>
  <acceptance_criteria>
    - stateCache items are transmitted instantly upon new socket establishment.
    - Hydration payload follows the strict 3-message data format contract.
  </acceptance_criteria>
  <done>Initial WebSocket client state hydration pipeline is operational</done>
</task>

<task type="auto">
  <name>Task 3: Hook filesystem updates and system reload alerts into WebSocket broadcasts</name>
  <files>core/server/index.ts</files>
  <read_first>
    - core/server/index.ts
    - core/server/api/scheduler.ts
  </read_first>
  <action>
    Glue the watcher callback to the websocket registry in core/server/index.ts:
    1. Invoke `startIpcWatcher()` upon server startup.
    2. Provide an update callback `(widgetId, data) => { ... }` that broadcasts the data to all active kiosks:
       `kiosks.forEach((ws) => ws.send(JSON.stringify({ type: "data", widget: widgetId, data })))`
    3. Ensure existing API endpoints `/api/canvas/publish` and `/api/templates/:id/apply` broadcast a system reload alert to kiosks:
       `kiosks.forEach((ws) => ws.send(JSON.stringify({ type: "reload" })))`
    4. Ensure maintenance state toggle API broadcasts a maintenance state update:
       `kiosks.forEach((ws) => ws.send(JSON.stringify({ type: "maintenance", enabled: isMaint })))`
  </action>
  <verify>
    Verify compilation and verify Bun server boots cleanly.
  </verify>
  <acceptance_criteria>
    - Filesystem modifications trigger a JSON-stringified broadcast message to kiosks.
    - System layout publishes and templates apply trigger reload events.
    - Maintenance state updates correctly broadcast toggles.
  </acceptance_criteria>
  <done>FileSystem events and system control signals are fully bound to WebSocket broadcasts</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Run `npm run build --workspace=admin` to ensure Vite compilations are green.
</verification>

<success_criteria>
- Instant hydration updates kiosks immediately on launch.
- Live filesystem updates broadcast to all displays.
</success_criteria>

<output>
After completion, create `.planning/phases/E-ipc/E-02-SUMMARY.md`
</output>
