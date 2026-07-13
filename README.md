# PiDashboard

PiDashboard is a lightweight, customizable smart dashboard platform for low-resource Raspberry Pi kiosk deployments.

## Active Workspace

`LiteDashboard/` is the canonical product workspace.

```text
PiDashboard/
├── LiteDashboard/          # Active dashboard app
│   ├── admin/              # React + Vite admin control panel
│   ├── core/               # Bun server, API routes, compositor, SDK
│   ├── widgets/            # Widget manifests and HTML fragments
│   ├── canvases/           # Active/saved canvas JSON layouts
│   ├── media/              # Preserved user media/uploads
│   ├── daemons/            # Background widget data producers
│   ├── scripts/            # Host/helper scripts
│   ├── tests/              # Runtime and smoke-test helpers
│   └── dev/                # Local probes, scratch files, and test harnesses
├── deploy/                 # Deployment scripts for Raspberry Pi
├── docs/                   # Planning, design, and historical architecture notes
└── archive/                # Reference-only historical workspaces/prototypes/artifacts
```

Older top-level workspaces such as `core/`, `core_legacy_archive/`, and `src-anything/` have been moved under `archive/` for reference. Do not treat archived folders as active implementation targets.

## Common Commands

Run these from `LiteDashboard/` unless noted otherwise.

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

Deployment helpers live in `deploy/`. The deploy script packages the contents of `LiteDashboard/` as the app root on the Pi, so service commands such as `bun run core/tools/server.ts` resolve from the deployed `PiDashboard` directory.

```bash
python deploy/deploy-pidashboard.py
```

## Notes For Contributors

- Keep new product work inside `LiteDashboard/`.
- Preserve existing media in `LiteDashboard/media/uploads/`.
- Keep generated runtime state, logs, dependency folders, and deployment archives out of source control.
- Use `archive/` only for historical reference. If code needs to be revived from there, copy it deliberately into `LiteDashboard/` and adapt it to the current structure.
