# GSD Project Guide: PiDashboard

<!-- GSD:project-start source:PROJECT.md -->
## Project

### What This Is
PiDashboard is a lightweight, highly customizable smart dashboard system optimized for the Raspberry Pi Zero 2W. It provides a kiosk-style display interface that displays real-time widget information (weather, system info, music players, clock) alongside a fully responsive, drag-and-drop Web Admin Control Panel that runs on client devices (phones/laptops) to manage and publish layouts.

### Core Value
Deliver premium, responsive, and visually stunning dashboard kiosk displays on low-resource hardware (Pi Zero 2W, 512MB RAM) by decoupling the React-based admin control panel from a zero-framework, Bun-composited HTML display client.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack
- **Backend / Host Process**: Bun (for fast runtime, built-in HTTP server, in-memory WebSocket server, and watcher support).
- **Admin Control Panel**: React 18 + Tailwind 3 + TanStack Query 5, compiled to a lightweight, static bundle served by the Bun process.
- **Kiosk Display Client**: Vanilla HTML5 + CSS custom properties (variables) + Vanilla JavaScript. No framework runtime, no bundle overhead (loads in ~5KB of JS).
- **Inter-Process Communication (IPC)**: RAM-disk based messaging (`/tmp/widgets/*.json` in tmpfs watched in-memory).
- **WebSocket Protocol**: Custom 3-message protocol (`data`, `reload`, `maintenance`).
- **Security & Session Gate**: Cookie-based authentication verified using Argon2 password hashes.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions
- **RAM Constraint**: Kiosk browser must operate with near-zero long-term script allocation (target total system RAM: ~212-337MB).
- **Terminology**: Never confuse the following:
  - **Fragment**: A widget's self-contained HTML/CSS/JS file.
  - **Canvas**: An active layout arrangement JSON config defining widget placements.
  - **Template**: A named canvas preset (saved, exportable).
- **Client-Side Preview**: Drag-and-drop layout scaling and live configuration schemas are rendered client-side on the Admin React Panel. The Pi does zero processing during editing, receiving a single publish JSON package.
- **Zero-Dependency Widgets**: Widget fragments must be standalone and use raw DOM operations without loading heavy dependencies.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

```
                                  ┌───────────────────────────────┐
                                  │      Admin Panel (React)      │
                                  │   (Runs client-side on PC)    │
                                  └──────────────┬────────────────┘
                                                 │ Save & Publish (POST)
                                                 ▼
┌─────────────────────────┐       ┌───────────────────────────────┐       ┌─────────────────────────┐
│     Tier 1b Fetcher     ├──────►│          Bun Server           │◄──────┤     Tier 2 Daemon       │
│  (HTTP Scheduler in Bun)│       │ (HTTP + WS + Compositor + IPC)│       │ (systemd sysinfo, MPD)  │
└─────────────────────────┘       └──────┬───────────────▲────────┘       └────────────┬────────────┘
                                         │               │                             │
                                         │ Composite     │ Watch                       │ Writes JSON
                                         │ HTML          │ (/tmp/widgets/)             │
                                         ▼               │                             ▼
                                  ┌──────────────┴───────┴────────┐       ┌─────────────────────────┐
                                  │     Kiosk Display Client      │◄──────┤    tmpfs IPC folder     │
                                  │   (Vanilla JS Kiosk Browser)  │       │ (/tmp/widgets/*.json)   │
                                  └───────────────────────────────┘       └─────────────────────────┘
```

The system uses a strict **Draft → Publish** workflow:
1. **Compositor**: Takes `canvases/active.json` + `widgets/<id>/fragment/*.html` and wraps them in absolute containers, returning a single, optimized dynamic page.
2. **IPC RAM disk**: External systemd daemons (sysinfo, player lyrics) write straight to `/tmp/widgets/sysinfo.json`. Bun watches this in-memory folder and instantly pushes updates to connected kiosk display sockets.
3. **Maintenance Mode**: An operational state that halts the Tier 1b fetching timers and systemd daemons, shifting the kiosk to a minimal, static HTML page.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project-local skills found yet. Establish a custom project skill by placing a `SKILL.md` under `.agent/skills/`.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` — do not edit manually.
<!-- GSD:profile-end -->
