# Development Conventions & Constraints: PiDashboard

This document outlines the coding standards, memory limits, and design guidelines.

---

## 1. Low-Resource Memory Constraints (Pi Zero 2W)

Pi Zero 2W provides a strict constraint of **512MB RAM**. To run the server and the kiosk browser simultaneously, the following conventions are enforced:

- **Target System RAM Allocation:** Combined host and kiosk footprint must stay within **212MB – 337MB**.
- **No Heavy Runtimes on Kiosk:** Widget fragments must utilize **Vanilla JS (ES6)** and raw DOM selectors. Loading React/Vue runtimes or heavy bundler libraries (like lodash or jQuery) onto the kiosk browser client is strictly **UNACCEPTABLE**.
- **Near-Zero Script Allocations:** Long-term JS script cycles must be kept minimal (target <5% CPU usage on idle). Memory allocations should be garbage collected promptly.

---

## 2. Decoupled UI & Proportional Coordinates

- **Client-Side Editing:** The React Admin Panel handles 100% of grid scaling, canvas dragging, and visual coordinate rendering.
- **Flat Layout Configurations:** Layout placements are passed to the server as static placement lists:
  ```json
  {
    "widget_id": "clock",
    "x": 20,
    "y": 40,
    "width": 300,
    "height": 100,
    "zIndex": 2
  }
  ```
- **Proportional Scaling:** Kiosk display monitors use a native proportional scaling wrapper (`ResizeObserver`) to resize elements dynamically according to the active viewport resolution.

---

## 3. Dark & Light Theme Styling Guidelines

All administrative UI components must be fully theme-aware:

- **Class Rules:** Avoid using hardcoded Tailwind color overrides (`bg-white`, `text-gray-900`, `text-gray-500`) for structural card boundaries or textual fields.
- **Theme Variables Mapping:** Always map visual properties to root HSL custom variables properties:
  - Background: `var(--color-bg)`
  - Cards & Surfaces: `var(--color-surface)`
  - Grid Table Borders: `var(--color-border)`
  - Labels & Body Text: `var(--color-text-secondary)`
  - Major Titles: `var(--color-text-primary)`
  - Subtitles & Hints: `var(--color-text-muted)`
  - Action Indicators: `var(--color-accent)`

---

## 4. Secure File Operations

- **Atomic Writes:** All canvas publishes must execute as atomic operations:
  1. Write temporary layout buffer file `active.json.tmp`.
  2. Rename file atomically to `active.json`.
- **EPERM Recovery:** On Windows, file renames can occasionally encounter lock exceptions (`EPERM: operation not permitted`). Always wrap renames in a robust error try/catch to log warnings and retry operations rather than crashing the server.
