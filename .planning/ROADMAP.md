# Roadmap: PiDashboard

## Overview
PiDashboard is initialized with a modular, lightweight, high-performance architecture. The development journey progresses from directory layout restructuring, to the core Bun server with a vanilla HTML compositor, to the React admin panel extraction, to the standalone fragment system, to the memory-mapped tmpfs data pipeline, and finally to the structured logging and tiered error-handling system.

## Phases

- [ ] **Phase A: Restructure & Directory Layout** - Set up the new, clean directory architecture, separating production files from UI-Draft1.
- [ ] **Phase B: Bun Backend Server & Compositor** - Build the central Bun backend containing dynamic composition, core API endpoints, basic auth, upload endpoints, and Maintenance Mode.
- [ ] **Phase C: Admin Panel Extraction** - Extract and clean the React-Tailwind SPA from UI-Draft1, compiling it to Vite static files served by Bun.
- [ ] **Phase D: Widget Fragment System** - Implement self-contained vanilla HTML/JS/CSS fragments, manifests parsing, and compositor injection.
- [ ] **Phase E: tmpfs IPC & Data Pipeline** - Build the in-memory RAM disk watcher using fs.watch and real-time 3-message WebSocket push.
- [ ] **Phase F: Logging & Tiered Error Recovery** - Add structured rotation-aware logging, a persistent JSONL crash analytics recorder, and exponential backoff recovery.

---

## Phase Details

### Phase A: Restructure & Directory Layout
- **Goal**: Set up the production workspace structures.
- **Depends on**: Nothing
- **Requirements**: None (pre-requisite phase)
- **Success Criteria**:
  1. The new workspace directories `core/`, `admin/`, and `widgets/` exist.
  2. `src-anything/UI-Draft1` is untouched and serves as an isolated reference.
- **Plans**: 1 plan

Plans:
- [ ] A-01: Establish structural folders, workspace package.json, and configurations.

### Phase B: Bun Backend Server & Compositor
- **Goal**: Deploy a functional Bun web server, static admin server, cookie auth gate, and vanilla HTML layout compositor.
- **Depends on**: Phase A
- **Requirements**: SERV-01, SERV-02, SERV-03, LAYT-03, SECO-01, SECO-02, SECO-03
- **Success Criteria**:
  1. Bun server starts successfully and listens on port 3000.
  2. Bun compositor reads `canvases/active.json` and outputs a compiled HTML document.
  3. Kiosk display client automatically scales the active canvas container to fit screens.
  4. Maintenance mode POST request pauses system workers and renders a static maintenance screen.
  5. File uploads are validated and processed successfully under `media/uploads/`.
- **Plans**: 3 plans

Plans:
- [ ] B-01: Build core Bun server with routes, static file server, and Argon2 cookie auth.
- [ ] B-02: Implement the HTML dynamic layout compositor and auto-scaling kiosk client.
- [ ] B-03: Implement the Maintenance Mode toggle and media management APIs.

### Phase C: Admin Panel Extraction
- **Goal**: Prune the heavy prototype scaffolding and extract Vite-built static admin React components.
- **Depends on**: Phase B
- **Requirements**: LAYT-01, LAYT-02, FRAG-03
- **Success Criteria**:
  1. React Admin builds successfully via Vite with pruned dependencies (~12 vs 40).
  2. Drag-and-drop widget resizing and layering edits run completely on the client side.
  3. Clicking "Save & Publish" in the React interface sends layout JSON to the backend in a single burst.
- **Plans**: 2 plans

Plans:
- [ ] C-01: Extract Vite React structure and configure API proxy setups.
- [ ] C-02: Clean, compile, and link the drag-drop editor tabs to backend APIs.

### Phase D: Widget Fragment System
- **Goal**: Establish the standalone fragment parser loading vanilla HTML/CSS/JS widget modules.
- **Depends on**: Phase C
- **Requirements**: FRAG-01, FRAG-02, PIPE-03
- **Success Criteria**:
  1. Widget loader parses widget JSON manifests for validation.
  2. Compositor successfully injects self-contained fragment scopes (style, DOM elements, script tags) into the main page.
  3. Embedded fragment JS runs independently without polluting the global scope.
- **Plans**: 2 plans

Plans:
- [ ] D-01: Implement manifest validation schema and fragment injection functions.
- [ ] D-02: Adapt primary widget fragments (Clock, Weather, Sysinfo) to vanilla specifications.

### Phase E: tmpfs IPC & Data Pipeline
- **Goal**: Build the memory-mapped RAM disk watcher and real-time push scheduler.
- **Depends on**: Phase D
- **Requirements**: PIPE-01, PIPE-02
- **Success Criteria**:
  1. Scheduler manages Tier 1b HTTP fetching timers on intervals.
  2. Bun detects JSON updates inside `/tmp/widgets/` instantly using in-memory `fs.watch`.
  3. Kiosk displays update widget values immediately without browser reloads using the 3-message WebSocket protocol.
- **Plans**: 2 plans

Plans:
- [ ] E-01: Build Tier 1b scheduler and local /tmp/ watcher IPC.
- [ ] E-02: Implement WebSocket server and websocket browser client push handlers.

### Phase F: Logging & Tiered Error Recovery
- **Goal**: Add robust operations tooling, file logs rotation, crash analytics, and backoff retries.
- **Depends on**: Phase E
- **Requirements**: LOGG-01, LOGG-02, LOGG-03
- **Success Criteria**:
  1. Log records are formatted across 4 levels and 11 categories.
  2. Log files rotate and stay under a maximum aggregate footprint of 45MB.
  3. Persistent `events.jsonl` tracks failures, allowing automated widget backoff and last-known-good caching.
- **Plans**: 1 plan

Plans:
- [ ] F-01: Implement rotation-aware logger, crash analyst recorder, and tiered error handler.

---

## Progress

| Phase | Plans Complete | Status | Completed |
|:---|:---|:---|:---|
| Phase A: Restructure & Directory Layout | 0/1 | Not started | - |
| Phase B: Bun Backend Server & Compositor | 0/3 | Not started | - |
| Phase C: Admin Panel Extraction | 0/2 | Not started | - |
| Phase D: Widget Fragment System | 0/2 | Not started | - |
| Phase E: tmpfs IPC & Data Pipeline | 0/2 | Not started | - |
| Phase F: Logging & Tiered Error Recovery | 0/1 | Not started | - |
