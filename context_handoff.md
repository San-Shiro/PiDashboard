# PiDashboard: Project Context & Handoff

## Current Source Of Truth

The app lives directly at the repo root — there is no nested workspace folder. Older lanes (`LiteDashboard/` wrapper, top-level `core/`, `core_legacy_archive/`, `src-anything/`, and the `archive/` reference folder) have all been removed; there is no legacy code path to fall back to.

When making product changes, start in:

```text
PiDashboard/
├── admin/      # React 18 + Vite admin panel
├── core/       # Bun server, API routes, compositor, SDK, validation
├── widgets/    # Widget manifests and HTML fragments
├── canvases/   # Active and saved canvas layouts
├── media/      # Preserved uploads and media assets
├── daemons/    # Background data producers
├── scripts/    # Host helper scripts
└── tests/      # Runtime/smoke-test helpers
```

## Project Overview

PiDashboard is a lightweight smart dashboard system aimed at Raspberry Pi Zero 2W-class constraints. Heavy editing and layout work happens in the admin panel on a client device. The Pi host focuses on serving the kiosk page, composing published canvas layouts, receiving lightweight daemon/widget updates, and pushing changes over WebSockets.

## Architecture Snapshot

- **Backend / Host Process:** Bun server on port 3000, with HTTP routes, WebSocket handling, compositor output, static media serving, and auth.
- **Admin Control Panel:** React 18, Tailwind, and TanStack Query. It runs as a static SPA served under `/admin/`.
- **Kiosk Display Client:** Composited vanilla HTML/CSS/JS served at `/`, with widgets rendered from manifest + fragment files.
- **Data Flow:** Admin edits canvas/template JSON, publishes an active canvas, server composes a kiosk page, daemons or widgets update state, and displays receive reload/state messages over WebSocket.
- **Runtime Constraints:** Avoid Pi-side layout processing, keep widgets lightweight, preserve low memory use, and avoid unnecessary persistent disk churn.

## Repository Layout

- `admin/`, `core/`, `widgets/`, `canvases/`, `config/`, `media/`, `daemons/`, `scripts/`, `tests/`, `community-widgets/`: the active application, all at the repo root.
- `deploy/`: Packaging and Pi kiosk setup scripts.
- `docs/`: Planning, design notes, and historical specifications. Some older docs still mention `core/` from before the flattening; treat paths in dated/historical docs as approximate.

## Current Cleanup Decision

The app was flattened from a nested `LiteDashboard/` workspace directly onto the repo root — there's now a single app tree with no wrapper folder. Existing media is preserved. The reference-only `archive/` folder (old `core/`, `core_legacy_archive/`, `src-anything/` prototypes), the old `.planning/` GSD state, and accumulated debug/scratch cruft (stray logs, screenshots, one-off fix/test scripts, `dev/`, `scratch/`) have all been deleted outright — none of it was buildable or referenced by the active app.

## Contribution Rules

- Do not delete uploaded media from `media/uploads/`.
- Keep generated bundles, runtime state, logs, dependency folders, and scratch outputs out of source control.
- Service and deployment commands resolve from the repo root with `bun run core/tools/server.ts`.
