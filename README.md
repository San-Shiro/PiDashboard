# PiDashboard

PiDashboard is a lightweight, customizable smart dashboard platform for low-resource Raspberry Pi kiosk deployments.

## Layout

The app lives directly at the repo root.

```text
PiDashboard/
├── admin/                  # React + Vite admin control panel
├── core/                   # Bun server, API routes, compositor, SDK
├── widgets/                # Widget manifests and HTML fragments
├── community-widgets/      # Packaged (.wig) community widget bundles
├── canvases/                # Active/saved canvas JSON layouts
├── config/                 # Runtime config (active widgets, etc.)
├── media/                  # Preserved user media/uploads
├── daemons/                # Background widget data producers
├── scripts/                # Host/helper scripts
├── tests/                  # Runtime and smoke-test helpers
├── deploy/                 # Deployment scripts for Raspberry Pi
└── docs/                   # Planning, design, and architecture notes
```

## Common Commands

Run these from the repo root unless noted otherwise.

```bash
# Start the Bun dashboard server
bun run core/tools/server.ts

# Start the admin app during UI development
cd admin
npm run dev

# Build the admin app
cd admin
npm run build
```

The kiosk display is served at `http://localhost:3000/`, and the admin panel is served at `http://localhost:3000/admin/` by the Bun host process.

## Deployment

Deployment helpers live in `deploy/`. The deploy script packages the repo root as the app root on the Pi (excluding `deploy/`, `docs/`, and local/runtime files), so service commands such as `bun run core/tools/server.ts` resolve from the deployed `PiDashboard` directory.

```bash
python deploy/deploy-pidashboard.py
```

## Notes For Contributors

- Preserve existing media in `media/uploads/`.
- Keep generated runtime state, logs, dependency folders, and deployment archives out of source control.
