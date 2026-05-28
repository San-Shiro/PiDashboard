# PiDashboard (Smart Dashboard Platform)

PiDashboard is a lightweight, highly customizable smart dashboard system optimized for low-resource hardware like the **Raspberry Pi Zero 2W** (512MB RAM).

---

## 🏗️ Repository Layout & Structure

This repository is structured around a multi-component workspace, keeping the core active services decoupled from plans, ideas, and system draft sibling folders:

```text
PiDashboard/ (Repository Root)
├── core/                        # The active smart dashboard kiosk platform workspace
│   ├── admin/                   # React 18 + Vite Web Admin Control Panel
│   ├── server/                  # Bun Host Process HTTP & WebSocket server compositor
│   ├── widgets/                 # Zero-dependency visual widget snippets library
│   ├── canvases/                # Canvas grid arrangements configurations database
│   ├── media/                   # Static uploads manager directory (backgrounds, custom media)
│   ├── docs/                    # Full comprehensive guides documentation suite
│   └── package.json             # Workspace NPM scripts and root package config
├── docs/                        # Project roadmap, phases planning, and draft archives
└── README.md                    # Top-level repository directory map (this file)
```

---

## 🚀 Getting Started

All runtime components, source code, visual widget libraries, deployment configurations, and detailed modular guides live in the [**`/core/`**](./core/) subdirectory.

To install, build, deploy, or extend PiDashboard, refer to the following comprehensive documentation guides under `/core/docs/`:

1. [**Pi Installation & Deployment Guide**](./core/docs/pi-installation.md)
   *Step-by-step setup guides for DietPi system packages, tmpfs memory RAM-disk configurations, autostart daemons, and cog graphics layers.*
2. [**User Guide & Operations**](./core/docs/user-guide.md)
   *Learn how to navigate the Web Admin Panel, place/scale widget coordinates on grid workspaces, save layout template presets, and suspend display resources using Maintenance Mode.*
3. [**Widget Development Guide**](./core/docs/widget-development.md)
   *Tutorial mapping how to package custom visual fragments (Vanilla CSS/HTML snippets) and register JSON manifest fields for form generation.*
4. [**Daemon Development Guide (Tier 2)**](./core/docs/daemon-development.md)
   *Develop low-level background systemd daemons (compiled Go/Rust metrics engines) driving real-time values to tmpfs watcher slots.*
5. [**API Reference Guide**](./core/docs/api-reference.md)
   *Complete documentation for all exposed authentication, canvas layouts, presets templates, widgets, media, and system cURL REST APIs.*
6. [**Scheduler & Compositor Internals**](./core/docs/scheduler-compositor-internals.md)
   *Detailed structural code maps explaining compose.ts dynamic layouts, ResizeObserver view scale transforms, and scheduler backoffs.*
7. [**Troubleshooting & FAQ Guide**](./core/docs/troubleshooting-faq.md)
   *Diagnose blank display kiosks, metric updates backoffs, password hash resets, systemd service diagnostics, and version metrics.*

For advanced technical details regarding technological stacks (Bun runtime, frame-free rendering, zero SD card wear, Argon2 secure session cookies), view [**Codebase Architecture & Decisions**](./core/docs/codebase-explanation.md).
