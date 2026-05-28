# Phase E: tmpfs IPC & Data Pipeline - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the memory-mapped RAM disk watcher and real-time push scheduler. Expose dynamic intervals and standard WS push connections for kiosks.

</domain>

<decisions>
## Implementation Decisions

### IPC Directory Path Configuration
- **D-01:** Implement environment-variable driven path configuration using `PIDASH_IPC_DIR`.
- **D-02:** Default the path to `/tmp/widgets/` (supporting tmpfs on Linux/Raspberry Pi) but fall back gracefully to a workspace-local folder (e.g., `./state/cache/widgets/`) or allow overrides in development to support seamless Windows workflow execution out of the box.

### Fetching Scheduler Strategy (PIPE-02)
- **D-03:** Standalone Ticker Architecture: Spawn individual `setInterval` timers for each active Tier 1b (Bun-fetched) widget manifest upon startup.
- **D-04:** Timer Management: Create and clear timers dynamically when widget layouts are updated or published.
- **D-05:** Fault Tolerance: Failed HTTP requests use a strict 5-second timeout, cache the last known good state, and log errors independently without blocking other widget schedules.

### WebSocket Client Caching & State Hydration (PIPE-03)
- **D-06:** State Hydration: Bun maintains an in-memory cache of the latest JSON state for all widgets.
- **D-07:** Connection Push: When a new kiosk socket connects or reloads, the Bun server instantly pushes the current cached state, preventing blank widget elements or delayed poll cycles.

### the agent's Discretion
- **D-08:** Exact fs.watch debouncing intervals (to avoid multiple rapid-fire watch events on file writes).
- **D-09:** JSON parsing safety limits (handling corrupted or partially written JSON files gracefully).
- **D-10:** Logging format categories for IPC watch activities.

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `core/server/index.ts`: Has `server.upgrade(req)` mounted and basic WebSocket connection registry (`const kiosks = new Set<any>()`).
- `core/server/api/widgets.ts`: Contains widget manifest parsing (`getWidgetRegistry`) and active placement getters (`getWidgetInstances`).
- `core/server/compositor/compose.ts`: Already handles viewport scaling and mounts the kiosk-side WebSocket reload, maintenance, and data subscription callback loops.

### Established Patterns
- High-performance, zero-RAM flat-file persistence.
- WebSocket-scoped browser updater subscription hooks via `window.__widgetUpdaters`.

### Integration Points
- `/ws/display` endpoint in `core/server/index.ts` where kiosks establish active WebSockets.
- Bun server startup loop in `core/server/index.ts` where dynamic setInterval tickers will be initialized.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: E-ipc*
*Context gathered: 2026-05-28*
