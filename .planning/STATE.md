# State: PiDashboard

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28)

**Core value:** Deliver premium, low-overhead kiosk dashboards via a decoupled admin SPA and vanilla composed client.
**Current focus:** Phase B: Bun Backend Server & Compositor

## Progress Summary
- Total phases: 6
- Completed phases: 1
- Active phase: Phase B

---

## Active Phase: Phase B: Bun Backend Server & Compositor
- **Status**: Not started
- **Plans**: 3 plans (`B-01-PLAN.md`, `B-02-PLAN.md`, `B-03-PLAN.md`)

### Goals
Deploy a functional Bun web server, static admin server, cookie auth gate, and vanilla HTML layout compositor.

### Active Plan
- **None — Phase B has not been planned yet.** Run `/gsd-plan-phase B` to plan this phase.

### Checklist
- [ ] B-01: Build core Bun server with routes, static file server, and Argon2 cookie auth.
- [ ] B-02: Implement the HTML dynamic layout compositor and auto-scaling kiosk client.
- [ ] B-03: Implement the Maintenance Mode toggle and media management APIs.

### Issues & Risks
- None.

---

## Completed Phases

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
