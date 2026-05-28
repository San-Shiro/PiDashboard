# System Architecture: PiDashboard

This document outlines the system patterns, layout composition pipeline, data flow, and runtime entry points of the PiDashboard project.

---

## 1. Decoupled Architectural Philosophy

PiDashboard is designed to run efficiently on low-resource hardware like the Raspberry Pi Zero 2W (512MB RAM). To achieve this, it splits the layout editing capabilities from layout presentation:

```
┌───────────────────────────────────────┐
│     Client Admin Panel (React)        │ (Runs entirely on PC/laptop)
└──────────────────┬────────────────────┘
                   │ Layout Publish (POST /api/canvases/active)
                   ▼
┌───────────────────────────────────────┐
│          Bun Server Core              │ (Runs on Raspberry Pi)
│ (Compositor, Socket Broker, IPC Watch)│
└──────────────────┬────────────────────┘
                   │ Composed HTML Page (GET /display)
                   ▼
┌───────────────────────────────────────┐
│       Vanilla Kiosk Display Client     │ (Loads in ~5KB of JS on Pi)
└───────────────────────────────────────┘
```

- **Heavy Processing Client-Side:** Drag-and-drop scaling, live grids, and layout customizations are executed on the administrative device (e.g. laptop/phone).
- **Lightweight Display Kiosk:** The Pi does *zero* layout parsing at runtime. It receives a single fully composed HTML/CSS/JS package from the Bun compositor, loading in milliseconds.

---

## 2. Layered Architecture

The backend host process is separated into clear modules:

1. **Host Server (`core/server/index.ts`):** 
   - Receives REST requests from the Admin Panel.
   - Manages WS connections for connected displays.
   - Initialises file watchers on `/tmp/widgets` for IPC.
2. **Compositor Engine (`core/server/compositor/`):**
   - Composes active canvas layout JSON with widget HTML/CSS/JS fragments.
   - Produces a single compiled static display page.
3. **Configuration Registry (`core/server/config/`):**
   - Configures global profiles, theme settings, and network options.
4. **Authentication & Session Manager (`core/server/api/auth.ts`):**
   - Handles password hash setup, login cookies, and session validation.

---

## 3. Dynamic Compositor Pipeline

The compositor takes `canvases/active.json` + `widgets/<id>/fragment/` files and rolls them into a single page:

1. **Fetch Layout Canvas:** Reads the active layout array defining widget placement (`x`, `y`, `width`, `height`, `zIndex`, `opacity`, `schedule`).
2. **Extract Widget Fragments:** Matches each active instance with its widget fragment folder:
   - `fragment.html` (markup)
   - `style.css` (visual properties)
   - `client.js` (DOM interactions)
3. **Wrap in Containers:** Encloses each widget inside a theme-aware absolute container matching the placement parameters:
   ```html
   <div class="widget-instance-container" style="left: 10px; top: 20px; width: 300px; height: 150px; z-index: 10; opacity: 0.9;">
     <!-- Inject fragment.html -->
   </div>
   ```
4. **Compile Viewport Scripts:** Appends the viewport proportional scaling listener (`ResizeObserver`) to resize elements dynamically.
5. **Serve Dynamic Output:** Returns a fully cached, static page directly to the kiosk browser.
