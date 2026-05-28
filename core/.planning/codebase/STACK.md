# Codebase Stack: PiDashboard

This document outlines the core runtime, language versions, dependencies, and configurations utilized across the PiDashboard workspaces.

---

## 1. Core Technologies & Runtimes

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend & Host** | Bun | `^1.3.0` | HTTP/WS Server, Compositor, IPC File Watcher, and Test Runner |
| **Frontend SPA** | React 18 + TypeScript | `^18.3.1` | Admin Control Panel drag-and-drop dashboard dashboard |
| **Kiosk Client** | Vanilla HTML5 / ES6 JS | Native | Ultra-lightweight display client optimized for Pi Zero 2W WPE WebKit |
| **Styling (SPA)** | Tailwind CSS | `^3.4.4` | Styling framework for the React admin control panel |
| **Styling (Kiosk)**| CSS Variables + Flexbox| Native | Zero-dependency kiosk styling using dynamic theme properties |

---

## 2. Dependency Breakdown

### A. Host Backend (`core/server/`)
The backend operates as a zero-dependency environment aside from native binary integrations to keep the host footprint exceptionally small.

- **Production Dependencies:**
  - `argon2` (`^0.40.1`): Used for secure cookie-based session verification with high-entropy passphrases.
- **Built-in Bun Core Modules:**
  - `fs`: Handles layout and upload filesystem read/writes (`existsSync`, `readFileSync`, `writeFileSync`, `renameSync`).
  - `path`: Native path segment joining (`join`, `resolve`).
  - `crypto`: Session UUID generation.
  - `Bun.serve`: Built-in high-performance HTTP server with integrated WebSocket support.
  - `Bun.password`: Native hashing wrappers for argon2 verify algorithms.
  - `Bun.spawn`: Spawns and manages external system processes.

### B. Admin Control Panel (`core/admin/`)
The React SPA compiles down to single static HTML/JS/CSS bundles served by Bun.

- **Core Dependencies:**
  - `react` / `react-dom` (`^18.3.1`): Main component renderer.
  - `@tanstack/react-query` (`^5.51.1`): Handles all widget registry, media uploads, and metrics API queries, state caching, and mutations.
  - `lucide-react` (`^0.407.0`): Icon pack for widget controls.
  - `react-colorful` (`^5.6.1`): Tiny color picker component used in widgets config.
- **Dev Dependencies:**
  - `vite` (`^5.3.4`): Next-gen frontend toolchain and development server.
  - `tailwindcss` (`^3.4.4`) / `autoprefixer` / `postcss`: Styles compilation pipeline.
  - `typescript` (`^5.2.2`): Static typing checks.

---

## 3. Configuration Profiles

### A. Workspace Management
The codebase uses npm workspaces defined at `core/package.json` to manage sibling projects:
```json
{
  "name": "pi-dashboard-workspace",
  "private": true,
  "workspaces": [
    "admin",
    "server"
  ]
}
```

### B. Environment Variables & Fallbacks
The backend adapts seamlessly to local development versus production environments via environment configurations:

- `PORT` (Default: `3000`): Port that the Bun HTTP/WS server binds to.
- `PIDASH_IPC_DIR` (Fallback: `/core/server/state/cache/widgets`): RAM-disk folder location watched in-memory. On Raspberry Pi, this points to `/tmp/widgets` (tmpfs) to avoid SD card wear-and-tear.
- `NODE_ENV`: Used to toggle dev logs and sandbox allowances.
