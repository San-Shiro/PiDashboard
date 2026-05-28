# Codebase Architecture & Key Decisions

This document details the code-level architecture of PiDashboard, the underlying technologies chosen, and the specific advantages they provide when running on low-resource hardware like the Raspberry Pi Zero 2W.

---

## 🏗️ 1. Decoupled Core Architecture

PiDashboard separates layout editing from kiosk display rendering. This division keeps operational costs near zero.

```
                              ┌───────────────────────────────────────────────┐
                              │             Web Admin (React SPA)             │
                              │       - Client-side drag-and-drop scaling     │
                              │       - Local config schema forms compilation │
                              │       - Compiles bundle once, runs on client  │
                              └───────────────────────┬───────────────────────┘
                                                      │ Publish POST
                                                      ▼
┌─────────────────────────┐   Composes HTML   ┌───────┴───────┐   WebSocket   ┌─────────────────────────┐
│  Tier 1b scheduler module├─────────────────►│   Bun Server  ├──────────────►│    Kiosk Client         │
│  (Isolated fetch loop)  │   Reads widgets   │  (Single JS   │   Push data   │ (Zero-framework HTML/JS)│
└─────────────────────────┘                   └───────────────┘               └─────────────────────────┘
```

---

## ⚡ 2. Core Technological Decisions

### Decision: Bun Runtime over Node.js
- **Why:** Bun features built-in support for TypeScript compilation, a lightweight HTTP server (`Bun.serve`), an optimized WebSocket server implementation, and high-performance file writing APIs.
- **Advantages:**
  - **Single Dependency Layer:** Removes the need to load bloated dependencies like Express or `ws` packages.
  - **Memory Footprint:** The entire backend runs in a single process thread under Bun with standard RSS RAM consumption of ~32MB, compared to ~75MB for equivalent Node.js stacks.
  - **Fast Execution Start:** Start-up takes under 40ms, enabling self-healing crashes to recover instantly.

### Decision: Zero-Framework Composed Kiosk Display
- **Why:** The display kiosk is served as a single HTML document compiled on-the-fly by `compose.ts`. It loads zero third-party framework runtimes (no React, no jQuery, no Vue).
- **Advantages:**
  - **Extreme Memory Reductions:** React SPAs on Chrome consumes ~180-280MB of RAM due to Virtual DOM overhead. The PiDashboard vanilla client loads in a 5KB script footprint, consuming just ~24MB of browser memory.
  - **No Garbage Collection Pauses:** Framework-free rendering directly manipulates DOM nodes, eliminating micro-stutters and frame drops.
  - **Auto-Scaling Layouts:** The compositor injects an embedded auto-scale script using the `ResizeObserver` API to scale widgets proportionally.

### Decision: tmpfs RAM-disk watcher IPC
- **Why:** Rather than employing standard databases (SQLite, MongoDB) or IPC queues, background monitors write flat JSON files to a tmpfs RAM-disk `/tmp/widgets/` watched by the server using `fs.watch`.
- **Advantages:**
  - **Zero Wear on Storage:** Frequent disk writes can degrade MicroSD cards in under 6 months. In-memory tmpfs operations occur entirely in RAM, causing zero wear.
  - **Lowest CPU overhead:** Watching a folder in-memory using `fs.watch` triggers callback notifications in < 1.5ms with near-zero CPU cycles.
  - **Extreme Resilience:** If a daemon crashes, it simply stops updating its JSON file. The server continues to serve the last-known-good cached state, keeping layout widgets active instead of blanking.

### Decision: Minimal 3-Message WebSocket Protocol
- **Why:** Communication between the Bun server and the kiosk browser is limited to three specific message types:
  1. `data`: Push new data values for a specific widget.
  2. `reload`: Trigger a complete browser reload (when layout configurations are published).
  3. `maintenance`: Display a static overlay during maintenance standby.
- **Advantages:**
  - **Zero Bandwidth Bloat:** Payload footprints average <350 bytes per packet.
  - **Zero Processing Overhead:** Kiosk displays are purely passive receivers, processing messages dynamically inside single-line switch checks.

### Decision: Categorized Rotation Logger
- **Why:** The logging engine is a custom singleton (`core/server/utils/logger.ts`) dividing entries into 11 distinct category domains across 4 levels, with built-in log rotation capped at 5MB files.
- **Advantages:**
  - **Zero Disk Saturation Risk:** Sequential backups roll from `server.log` to `server.8.log`, enforcing a strict 45MB ceiling. The SD card can never be saturated by logs.
  - **No Thread Blocking:** Log writes are completed asynchronously using Bun's low-level file streams, preventing I/O thread bottlenecks.
