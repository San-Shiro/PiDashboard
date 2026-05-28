# Repository Structure & Directory Map: PiDashboard

This document outlines the file layout and key locations of the PiDashboard project.

---

## 1. Directory Tree Overview

```
PiDashboard/
├── core/
│   ├── admin/                 # Admin Control Panel Workspace (Vite + React)
│   │   ├── src/
│   │   │   ├── components/    # Reusable React components & primitives
│   │   │   │   └── dashboard/ # Tab components (overview, widgets, layout, media)
│   │   │   ├── index.css      # Core tailwind setup and style imports
│   │   │   └── App.jsx        # Root admin layout and routing Shell
│   │   ├── index.html         # Vite entrance template
│   │   └── package.json       # Admin dependencies & Vite profiles
│   │
│   ├── server/                # Host Backend process (Bun runtime)
│   │   ├── api/               # Authentication, WIFI controls, system API handlers
│   │   ├── compositor/        # Layout engine composing widgets into HTML
│   │   ├── index.ts           # Main backend entry point
│   │   └── package.json       # Bun host dependencies
│   │
│   ├── widgets/               # Standalone reusable widget files
│   │   ├── _base/             # Validation schema definitions
│   │   ├── clock/             # Clock widget fragment
│   │   ├── weather/           # Weather widget fragment
│   │   └── sysinfo/           # System information widget fragment
│   │
│   ├── canvases/              # Layout JSON configs
│   │   └── active.json        # Active layout viewport configuration
│   │
│   ├── config/                # Settings databases and system configuration
│   │
│   ├── media/                 # User uploaded graphics and static icons
│   │
│   ├── secrets/               # Argon2 hash storage (Excluded from Git)
│   │
│   └── state/                 # Process caches and persistent runtime logs
│
├── docs/                      # General installation & API references
└── README.md                  # Root informational index
```

---

## 2. Key Target Locations

### A. Backend Core Files
- `core/server/index.ts`: The main host server broker handling all routing, WebSocket clients, and static admin file servers.
- `core/server/api/system.ts`: Discovers CPU parameters, calculates memory metrics, parses processes, and governs maintenance mode.
- `core/server/api/auth.ts`: Creates tokens, sets session states, and hashes password values using Argon2.

### B. React Components & UI Elements
- `core/admin/src/App.jsx`: The layout shell implementing side-by-side tab navigations, logout, and the dark mode switch.
- `core/admin/src/components/dashboard/tabs/overview-tab.jsx`: Graphing dashboard showing system RAM/CPU, uptime tracking, and daemon controls.
- `core/admin/src/components/dashboard/tabs/widgets-tab.jsx`: Grid lists depicting configured instances and new addition templates.
- `core/admin/src/components/dashboard/widget-edit-panel.jsx`: Slider parameters editing size, coordinates, opacities, and zIndex fields.

### C. Widget Fragment Parts
Every widget lives in its own folder under `core/widgets/` containing:
- `manifest.json`: Defines category, parameters, icon, and editable config schema fields.
- `fragment.html`: Embedded HTML elements.
- `style.css`: Visual styling sheets.
- `client.js`: Vanilla JS performing local DOM manipulation and handling WebSockets.
