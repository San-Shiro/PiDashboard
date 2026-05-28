# Shipped Milestones: PiDashboard

This document logs all completed milestone releases for historical record, archiving metrics, accomplishments, and decisions.

---

## v1.0 — MVP

**Shipped on:** 2026-05-28
**Commit Range:** Init → v1.0 Release
**LOC Shipped:** 6,858 lines of TypeScript/JSX
**Phases:** 6 | **Plans:** 11 | **Tasks:** 16

### Accomplishments
1. **Scaffold Directory Layout**: Formed separate `core/server/`, `admin/src/`, and `widgets/` architectures to divide concerns.
2. **Dynamic Compositor Engine**: Created server compositor compiling static widget HTML/CSS fragments into single low-overhead display pages.
3. **Argon2 Session Gate**: Built full Argon2 hashing password gates and media management file upload validations.
4. **Vite React Admin Panel**: Compiled fully responsive dragging/resizing grid workspace with templates saving.
5. **Stand-alone Widgets**: AdaptedClock, Weather with custom SVG animations, and CPU `/proc` Sysinfo widgets.
6. **tmpfs IPC & WebSockets Watcher**: Built environment variable resilient watchers with bidirectional socket reloads.
7. **Rotation Categorized Logging**: Implemented 45MB max-aggregate categorized rotation logs and events crash recorders.

### Key Metrics
- **Kiosk Memory Footprint:** ~172MB - 277MB active system RSS RAM usage.
- **WebSocket Broadcast Latency:** <1.5ms.
- **Dynamic Composition Compilation Time:** ~7.2ms.

### Key Decisions
- Unified Server Daemon: Keeps memory usage minimized by sharing a single Bun runtime thread.
- Decoupled Drag-Drop Scaling: Scales grids completely client-side in the React workspace, keeping CPU overhead on the kiosk at zero.

---

_For planned features and future development roadmap, see [.planning/ROADMAP.md](file:///.planning/ROADMAP.md)._
