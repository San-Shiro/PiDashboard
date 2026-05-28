# Project Retrospective: PiDashboard

## Milestone: v1.0 — MVP

**Shipped:** 2026-05-28
**Phases:** 6 | **Plans:** 11

### What Was Built
- Fully responsive drag-and-drop React Admin Panel served by Vite static assets.
- Composed zero-framework Vanilla JS/HTML kiosk client (~5KB loading footprint).
- Standalone widget loader parsing manifests (Clock, Weather with dynamic SVGs, Sysinfo monitor).
- Memory-mapped tmpfs data pipelines (`PIDASH_IPC_DIR`) watched in-memory.
- Structured logger rotation (45MB max footprint) and events JSONL crash recovery with jittered exponential backoffs.

### What Worked
- **Process Consolidation:** Merging the core backend web server, scheduling tickers, and WebSocket pools into a single Bun process kept RSS memory usage comfortably inside the 172-277MB window, leaving substantial room on the Pi Zero 2W.
- **Cross-Platform Path Fallbacks:** Enforcing filesystem fallback paths mapping Linux `/tmp/widgets/` directly to local workspace caching folders on Windows allowed instant offline debugging.
- **Micro-Animations UI:** Crafting custom SVG graphs and dark-themed dashboard tabs client-side provided a visual look without taxing the Pi browser client CPU.

### What Was Inefficient
- Initial mockup React dependencies had dozens of duplicate chart and icon packages, requiring a detailed manual cleanup cycle in Phase C to compile the Vite bundles.

### Patterns Established
- Decoupled State Management: Kiosk displays never request REST endpoints or run dynamic grids; they only render an absolute composited HTML page and receive websocket payloads.
- Standalone Widget Fragments: All widgets operate without loading jQuery or React, keeping browser garbage collection pauses near 0ms.

### Key Lessons
- When targeting constrained hardware (512MB RAM), dynamic client-side HTML composition beats framework bundling.

---

## Cross-Milestone Trends

| Milestone | Date | Commits | LOC | Phases | Plans | Gaps | Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **v1.0** | 2026-05-28 | 46 | 6,858 | 6 | 11 | 0 | Shipped |
