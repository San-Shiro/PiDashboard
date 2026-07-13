# PiDashboard: Project Context & Handoff

## Current Source Of Truth

`LiteDashboard/` is the active product workspace. The top-level `core/`, `core_legacy_archive/`, and `src-anything/` trees were older implementation/prototype lanes and now live under `archive/` for reference only.

When making product changes, start in:

```text
LiteDashboard/
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

- `LiteDashboard/`: Canonical active application.
- `deploy/`: Packaging and Pi kiosk setup scripts.
- `docs/`: Planning, design notes, and historical specifications. Some older docs still mention `core/`; treat those paths as historical unless they explicitly reference `LiteDashboard/`.
- `archive/`: Reference-only historical code, prototypes, handoffs, and artifacts.

## Current Cleanup Decision

The directory streamlining task intentionally keeps `LiteDashboard/` as a top-level folder rather than moving app contents to the repo root. Existing media is preserved. Archived code is not deleted; it is retained to make earlier implementation ideas recoverable without confusing future active development.

## Contribution Rules

- Make active product changes only under `LiteDashboard/`, unless the task is explicitly about repo docs, deployment, or archive organization.
- Do not delete uploaded media from `LiteDashboard/media/uploads/`.
- Do not treat `archive/` as buildable or deployable source.
- Keep generated bundles, runtime state, logs, dependency folders, and scratch outputs out of source control.
- Service and deployment commands should continue to resolve from the deployed app root with `bun run core/tools/server.ts`.
