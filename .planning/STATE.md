# State: PiDashboard

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28)

**Core value:** Deliver premium, low-overhead kiosk dashboards via a decoupled admin SPA and vanilla composed client.
**Current focus:** Phase C: Admin Panel Extraction

## Progress Summary
- Total phases: 6
- Completed phases: 2
- Active phase: Phase C

---

## Active Phase: Phase C: Admin Panel Extraction
- **Status**: Not started
- **Plans**: 2 plans (`C-01-PLAN.md`, `C-02-PLAN.md`)

### Goals
Prune the heavy prototype scaffolding and extract Vite-built static admin React components.

### Active Plan
- **None — Phase C has not been planned yet.** Run `/gsd-plan-phase C` to plan this phase.

### Checklist
- [ ] C-01: Extract Vite React structure and configure API proxy setups.
- [ ] C-02: Clean, compile, and link the drag-drop editor tabs to backend APIs.

### Issues & Risks
- None.

---

## Completed Phases

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
