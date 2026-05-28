# PiDashboard

## What This Is
PiDashboard is a lightweight, highly customizable smart dashboard system optimized for the Raspberry Pi Zero 2W. It provides a kiosk-style display interface that displays real-time widget information (weather, system info, music players, clock) alongside a fully responsive, drag-and-drop Web Admin Control Panel that runs on client devices (phones/laptops) to manage and publish layouts.

## Core Value
Deliver premium, responsive, and visually stunning dashboard kiosk displays on low-resource hardware (Pi Zero 2W, 512MB RAM) by decoupling the React-based admin control panel from a zero-framework, Bun-composited HTML display client.

## Requirements

### Validated
- ✓ Admin Layout Editor Prototype — A draggable, resizable layout editor in the admin panel with move/resize/z-index/opacity (validated in `src-anything/UI-Draft1`)
- ✓ Theme and Preset Design — CSS custom property theme support (dark/light) and resolution preset canvases (validated in `src-anything/UI-Draft1`)
- ✓ **CORE-01**: Bun HTTP and WebSocket server acting as the single backend process — v1.0
- ✓ **COMP-02**: Core compositor that reads canvas JSON and dynamic widget fragments — v1.0
- ✓ **FRAG-03**: Self-contained, framework-free widget fragment loader — v1.0
- ✓ **PIPE-04**: `/tmp/widgets/` memory-mapped tmpfs file watcher pipeline — v1.0
- ✓ **WSS-05**: Minimal 3-message WebSocket push protocol — v1.0
- ✓ **SCHED-06**: Tiered scheduler inside Bun for Tier 1b HTTP fetch intervals — v1.0
- ✓ **SYS-07**: Zero-daemon system stats reader parsing `/proc` directly — v1.0
- ✓ **AUTH-08**: Session gate powered by Argon2 hashes and secure cookies — v1.0
- ✓ **MEDIA-09**: File upload and media management API for localized assets — v1.0
- ✓ **MAINT-10**: One-click low-resource Maintenance Mode pausing all polling and daemons — v1.0
- ✓ **LOG-11**: Structured logging with automated rotation capped at 45MB max disk usage — v1.0
- ✓ **CRASH-12**: Persistent JSONL crash recorder and recovery with exponential backoff on retry — v1.0

### Active
- [ ] **MKT-01**: Local ZIP widget marketplace for dynamic installer ZIP packages — v2.0
- [ ] **DISP-02**: Driving multiple physical kiosk displays from a single server with screen target filters — v2.0

### Out of Scope
- [React on Kiosk] — Excluded because loading a React SPA on a 512MB Pi Zero 2W kiosk browser consumes excessive RAM and CPU.
- [Database Servers (SQLite/PostgreSQL)] — Excluded to keep I/O overhead to a minimum; system uses flat file JSON and memory-mapped files.

## Context
Shipped v1.0 MVP with 6,858 LOC TypeScript/JSX. The system uses a single unified Bun server/watcher daemon, achieving a low active RAM memory footprint of ~172MB-277MB on the target 512MB Pi Zero 2W. Low-overhead structured 45MB rotating logging is active, with standalone widget fragments fully decoupled.

## Constraints
- **RAM Budget**: Total system must operate within a 212MB-337MB RAM window to comfortably fit the 512MB limit of the Pi Zero 2W.
- **CPU Overhead**: Zero-cost editing. The Bun server does nothing while the admin is editing client-side; processing is limited to short rename/reload bursts only during a "Publish" request.
- **Terminology**: The following terms are sacred and must not be confused:
  - **Fragment**: A widget's self-contained HTML/CSS/JS snippet file.
  - **Canvas**: An active layout arrangement (which widgets are present, their positions, resolutions, and configurations).
  - **Template**: A named canvas preset (morning, night, standard) that can be saved, exported, or activated.

## Key Decisions

| Decision | Rationale | Outcome |
|:---|:---|:---|
| Pre-built Static Admin | Vite-bundles React + Tailwind to run on the laptop/phone browser, keeping Pi CPU usage at 0 during layout edits. | ✓ Good |
| Bun Composited Kiosk HTML | Compiles widget HTML fragments on-the-fly to serve a raw 5KB HTML document to the Pi browser instead of a heavy JS framework bundle. | ✓ Good |
| Draft → Publish Editing | Client-side edits do not write to disk or notify kiosks until the user clicks "Save & Publish", keeping Pi work to a single 7ms burst. | ✓ Good |
| tmpfs RAM IPC | External daemons (sysinfo, music) write straight to `/tmp/widgets/<id>.json`, which is watched in-memory. | ✓ Good |
| One-Click Maintenance Mode | Pauses schedulers and halts low-level daemons to immediately drop Pi system memory consumption on demand. | ✓ Good |
| Unified Daemon Thread | Running backend server and schedulers in a single Bun thread reduces memory usage and context switching. | ✓ Good |
| Categorized Rotation Logger | Categorizing into 11 categories with automated rotation capped at 45MB ensures memory logging does not saturate disk space. | ✓ Good |
| Windows Developer Caching | Enforcing environment variable `PIDASH_IPC_DIR` mapping allows out-of-the-box Windows workspace execution. | ✓ Good |

## Evolution
This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-28 after v1.0 milestone completion*

