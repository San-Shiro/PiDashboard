# State: PiDashboard

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28)

**Core value:** Deliver premium, low-overhead kiosk dashboards via a decoupled admin SPA and vanilla composed client.
**Current focus:** Planning next milestone (v2.0 Marketplace & Multi-Display)

## Progress Summary
- Total phases: 6 completed in v1.0, 2 planned in v2.0
- Completed phases: 6
- Active phase: None


---

## Completed Phases

### Phase F: Logging & Tiered Error Recovery
- **Completed**: 2026-05-28
- **Plans Complete**: 1/1
- **Checklist**:
  - [x] F-01: Implement rotation-aware logger, crash analyst recorder, and tiered error handler.

### Phase E: tmpfs IPC & Data Pipeline
- **Completed**: 2026-05-28
- **Plans Complete**: 2/2
- **Checklist**:
  - [x] E-01: Build Tier 1b scheduler and local /tmp/ watcher IPC.
  - [x] E-02: Implement WebSocket server and websocket browser client push handlers.

### Phase D: Widget Fragment System
- **Completed**: 2026-05-28
- **Plans Complete**: 2/2
- **Checklist**:
  - [x] D-01: Implement manifest validation schema and fragment injection functions.
  - [x] D-02: Adapt primary widget fragments (Clock, Weather, Sysinfo) to vanilla specifications.

### Phase C: Admin Panel Extraction
- **Completed**: 2026-05-28
- **Plans Complete**: 2/2
- **Checklist**:
  - [x] C-01: Extract Vite React structure and configure API proxy setups.
  - [x] C-02: Clean, compile, and link the drag-drop editor tabs to backend APIs.

### Phase B: Bun Backend Server & Compositor
- **Completed**: 2026-05-28
- **Plans Complete**: 3/3
- **Checklist**:
  - [x] B-01: Build core Bun server with routes, static file server, and Argon2 cookie auth.
  - [x] B-02: Implement the HTML dynamic layout compositor and auto-scaling kiosk client.
  - [x] B-03: Implement the Maintenance Mode toggle and media management APIs.

### Phase A: Restructure & Directory Layout
- **Completed**: 2026-05-28
- **Plans Complete**: 1/1
- **Checklist**:
  - [x] Create `core/server/` folders
  - [x] Create `admin/src/` and `admin/public/` folders
  - [x] Create `widgets/` and `widgets/_base/` folders
  - [x] Create `canvases/` and `media/uploads/` folders
  - [x] Create `state/cache/` and `state/logs/` folders
  - [x] Write root `package.json` with workspace configuration
  - [x] Write `core/server/package.json` for Bun server dependencies
