# PiDashboard: Comprehensive System Guide & Architectural Documentation

> Lightweight, highly customizable smart dashboard kiosk system optimized for low-resource hardware like the Raspberry Pi Zero 2W.

---

## 1. System Architecture Overview

PiDashboard uses a strict **Decoupled Client-Server (Draft-Edit-Composite) Architecture** designed to deliver fluid, premium kiosk displays on hardware with extreme memory constraints (such as the Pi Zero 2W's 512MB RAM).

```
                                  ┌───────────────────────────────┐
                                  │      Admin Panel (React)      │
                                  │   (Runs client-side on PC)    │
                                  └──────────────┬────────────────┘
                                                 │ Save & Publish (POST)
                                                 ▼
┌─────────────────────────┐       ┌───────────────────────────────┐       ┌─────────────────────────┐
│     Tier 1b Fetcher     ├──────►│          Bun Server           │◄──────┤     Tier 2 Daemon       │
│  (HTTP Scheduler in Bun)│       │ (HTTP + WS + Compositor + IPC)│       │ (systemd sysinfo, MPD)  │
└─────────────────────────┘       └──────┬───────────────▲────────┘       └────────────┬────────────┘
                                         │               │                             │
                                         │ Composite     │ Watch                       │ Writes JSON
                                         │ HTML          │ (/tmp/widgets/)             │
                                         ▼               │                             ▼
                                  ┌──────────────┴───────┴────────┐       ┌─────────────────────────┐
                                  │     Kiosk Display Client      │◄──────┤    tmpfs IPC folder     │
                                  │   (Vanilla JS Kiosk Browser)  │       │ (/tmp/widgets/*.json)   │
                                  └───────────────────────────────┘       └─────────────────────────┘
```

### Core Design Principles
1. **Decoupled Heavy Processing**: The PC/laptop running the Admin Panel performs all the heavy layout scaling, canvas drag-and-drop computations, and widget configurations. The Pi Zero remains completely passive, receiving only a single static JSON package on publish.
2. **Zero-Framework Kiosk**: The display kiosk running on the Pi does not load any heavy JavaScript frameworks (no React, no Vue, no Angular). It is composited on the server into a single optimized page loading under ~5KB of vanilla JavaScript.
3. **RAM Optimization (Target: ~212-337MB total system RAM)**: Kiosk memory allocation is minimized by using lightweight, standalone widget fragments, raw DOM operations, and hardware-accelerated CSS animations.
4. **RAM-Disk IPC (tmpfs)**: Background system services (hardware monitors, music players, weather trackers) publish real-time state by writing standard JSON files directly to `/tmp/widgets/` (in-memory tmpfs RAM disk). The Bun server watches these files and pushes diffs to the kiosk client via WebSockets.

---

## 2. Directory Structure

```
LiteDashboard/
├── admin/               # React 18 Admin Control Panel (PC Editor)
│   ├── dist/            # Compiled static production bundle served by Bun
│   ├── src/             # React components, theme provider, and page layout
│   └── package.json     # Node build tool configuration
├── core/                # Core Server and Compositor Engine
│   ├── engine/          # Compositor template engine and schemas
│   ├── sdk/             # pi-widget.js client runtime script
│   ├── server/          # API routers, custom middleware, state store
│   └── tools/           # server.ts main entry point and validation tools
├── widgets/             # Widget Registry (manifest + fragments)
│   ├── clock/           # Classic digital clock widget
│   ├── weather/         # City weather forecaster widget
│   └── [16+ others]     # Standalone or daemon-powered visual units
├── daemons/             # Background services for device/hardware feeds
│   ├── music-player.sh  # MPD/Mopidy audio loop daemon
│   └── daily-quote.sh   # Hourly quote cycle script
├── scripts/             # Host utility scripts and scheduling workers
├── canvases/            # Active layouts and template JSON presets
│   └── active.json      # Currently running kiosk viewport configuration
├── config.json          # Root config file containing security Argon2 password
└── docs/                # Comprehensive markdown specifications and guides
```

---

## 3. Core Server Engine (`core/tools/server.ts`)

The backend is built as a zero-dependency **Bun HTTP/WebSocket Server** that provides high-throughput IPC, file watching, and API routing.

### 3.1 Startup & Lifecycle
On execution, the Bun process loads configuration, registers termination handlers to flush memory buffers synchronously, hydrates the widget registry, and establishes in-memory observers.
- **Port/IP binding**: Binds natively on `0.0.0.0:3000`.
- **Termination hooks**: Intercepts `SIGINT` and `SIGTERM` to invoke `stateStore.flushAll()`, preventing loss of runtime state (like notepad text or loops).

### 3.2 SPA Static Serving & MIME Types
Serves the React Admin SPA dynamically. If an admin subroute is requested (e.g. `/admin/layouts`), the server automatically falls back to serving `admin/dist/index.html` (HTML5 History API router support).
- Includes strict directory traversal guards to block malicious file path requests outside process folders.
- Implements cache-control headers (`public, max-age=3600` for assets, `no-store` for active kiosk views).

### 3.3 Security Gate (`core/server/middleware/auth-gate.ts`)
Cookies and Argon2 secure all backend operations.
- **Cookie verification**: Inspects incoming request headers for a valid HTTP-only `token` cookie.
- **Argon2id hashing**: Implemented using Bun's native password utility (`Bun.password.verify` and `Bun.password.hash`) mapping against `$argon2id$v=19$m=65536...` inside `config.json`. No external C/C++ node-modules are required.

---

## 4. In-Memory State Store (`core/server/state/state-store.ts`)

The `StateStore` manages in-memory data states, merges updates, and handles file-system persistence.

### 4.1 Persistence Debounce
To avoid wearing out the Raspberry Pi's SD card through rapid-write thrashing (such as continuous notepad typing), the state store uses a debounced, asynchronous flushing model:
- **Merges**: State merges occur instantly in-memory (`deepMerge`).
- **Debounce**: A 2.0-second delay (`PERSIST_DEBOUNCE_MS`) is initiated on change. Any subsequent change resets the timer. On expiry, the compiled state is written to `state/widgets/{key}.json`.
- **Naive Size Limiting**: State blocks per widget instance are limited to 50KB to preserve memory. Attempts to save larger payloads throw errors.

---

## 5. Compositor Engine (`core/engine/compositor.ts`)

The Compositor combines layout schemas and fragments into a single optimized page.

```
                  ┌──────────────────────────────┐
                  │      canvases/active.json    │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
   ┌────────────────────────────────────────────────────────────┐
   │                     Compositor Engine                      │
   │                                                            │
   │  1. Parse Active Canvas & Validate JSON Schema             │
   │  2. Load Registered Widgets (manifest.json)                │
   │  3. Wrap Script in Scoped IIFE                             │
   │  4. Apply absolute layout CSS values (x, y, zIndex)        │
   │  5. Inject Sandboxed Iframe (community) OR Shadow DOM      │
   │  6. Inject WebSocket reloader client                       │
   └─────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │      Single Composite HTML   │
                  │   (Served at http://host/)   │
                  └──────────────────────────────┘
```

### 5.1 Dynamic IIFE Wrapper
For `core` and `verified` widgets, the compositor isolates execution environments using a dynamic closure. It extracts the `<script>` tag from the widget's HTML fragment and encapsulates it in an IIFE scope containing local overrides:
```javascript
(function() {
  var instanceId = '{instance.id}';
  var widgetType = '{widget_id}';
  
  // Scoped helper shortcuts
  var root = container.shadowRoot || container;
  var $ = function(sel) { return root.querySelector(sel); };
  var $$ = function(sel) { return root.querySelectorAll(sel); };
  
  // Custom API wrapper
  var widget = {
    config: { ... },
    state: { ... },
    patchState: function(delta) { ... },
    callDaemon: function(payload) { ... }
  };
  
  // Backwards compatibility alias
  var PiWidget = {
    config: config,
    state: state,
    patchState: function(delta) { widget.patchState(delta); },
    callDaemon: function(payload) { widget.callDaemon(payload); },
    onState: function(fn) { onState = fn; },
    destroy: function(fn) { onDestroy = fn; }
  };
  
  var onState, onDestroy;
  
  // --- WIDGET SCRIPT INJECTED HERE ---
  // ...
  
  window.PiWidget._registerAPI(instanceId, widgetType, {
    onState: onState,
    onDestroy: onDestroy
  });
})();
```

### 5.2 Sandbox Isolation Levels
- **`core` and `verified` widgets**: Render inline in the DOM. The compositor isolates their DOM/styles inside a **Shadow DOM** (`container.attachShadow({ mode: 'open' })`), preventing global CSS styling contamination or ID namespace collisions.
- **`community` widgets**: Render inside a sandboxed `<iframe>` container using a `srcdoc` property and the `sandbox="allow-scripts"` flag, preventing local filesystem, DOM, or cookie access.

### 5.3 Custom Theming & CSS Properties
The compositor translates canvas theme palettes into native CSS variables injected into the viewport `:root`. Widgets adapt to active canvas aesthetics by using these variables:
- `--canvas-bg`: Kiosk background color.
- `--canvas-surface`: Card/panel background color.
- `--canvas-text`: Primary text color.
- `--canvas-accent`: Highlight/accent color (like buttons or active gauges).
- `--canvas-border`: Borders and dividers.
- `--canvas-muted`: Secondary, muted text labels.

### 5.4 Layout & Schedule Handling
- **Absolute Positioning**: Layout dimensions and coordinates (`x`, `y`, `width`, `height`, `zIndex`, `opacity`, `borderRadius`, `blendMode`, `filters`) are mapped directly to inline container styles.
- **Schedule Windows**: Viewport schedules run a 30-second checking loop that parses current timezone time (`HH:MM`) and matches it against `data-schedule` attributes:
  ```javascript
  // If current local time is outside activeFrom -> activeTo, or current day is unchecked:
  el.style.display = 'none'; // Otherwise empty '' to render
  ```

---

## 6. Client SDK (`core/sdk/pi-widget.js`)

Injected by the compositor, the global `PiWidget` script acts as the runtime system on the kiosk page.

### 6.1 State Dispatching
Monitors incoming WebSocket payloads from the server and routes daemon updates or merged state properties back to the specific widget instances:
```javascript
_dispatchState: function(widgetType, instanceId, data) {
  for (var i = 0; i < _stateHandlers.length; i++) {
    var h = _stateHandlers[i];
    // Match both global state models and specific instance-level states
    if (h.type === widgetType && (instanceId === 'global' || h.instance === instanceId)) {
      try { h.handler(data); } catch(e) { ... }
    }
  }
}
```

### 6.2 Visual Frame Loop
To conserve CPU processing power on the Pi Zero, the SDK limits and schedules periodic animation ticks via a central `requestAnimationFrame` dispatcher:
- **`_startFrameLoop(fps)`**: Collects registered `onFrame(timestamp)` callbacks from widgets and fires them at a regulated rate (default 60FPS, configurable down to 10FPS to lower CPU usage).

---

## 7. Background Daemons & IPC RAM-Disk

Background daemons continuously gather telemetry and push updates.

### 7.1 Real-Time IPC Folder (`/tmp/widgets/`)
External processes write output directly to the tmpfs RAM disk (`/tmp/widgets/*.json`). Because this folder resides in RAM, disk read/write wear is completely eliminated.
The Bun server observes the filesystem folder using native path watchers, instantly broadcasting changes via WebSockets.

### 7.2 Core Shell Daemons (`daemons/`)
- **`music-player.sh`**: Interface with the Music Player Daemon (MPD) using `mpc`. Handles album indexing, playback queues, loop controls, track information, and elapsed time, pushing JSON data to `/tmp/widgets/music-player.json`.
- **`daily-quote.sh`**: Standard bash array storing 50+ pre-compiled quotes. Increments hourly using modular mathematics `(current_hour % total_quotes)` to update `/tmp/widgets/daily-quote.json`.
- **`network-info.sh`**: Telemetry scraper that inspects `iwconfig` and `/proc/net/dev` to compile real-time wireless signal strengths (dBm), network interface names, and active download/upload transfer rates.
- **`wsl-weather.sh`**: Scheduler that queries `wttr.in` for hourly forecasts and location parameters. Automatically resolves current location coordinates and reads city settings synced by `core/server/api/templates.ts` on canvas saves.

---

## 8. React 18 Admin Control Panel

The PC-based Admin interface manages configurations and edits layouts.

```
admin/src/
├── App.jsx                       # Main router, session manager, API triggers
├── main.tsx                      # Entry point & global Error Boundary
├── index.css                     # Tailwind imports & modern typography configs
└── components/
    └── dashboard/
        ├── canvas-editor-page.jsx # Interactive layout editor (Drag/Resize)
        ├── widget-edit-panel.jsx  # Slide-over settings manager
        ├── widget-renderers.jsx   # Live client-side preview of widgets
        ├── theme-provider.jsx     # Visual theme designer (Midnight, Rosé, etc.)
        ├── controls/
        │   └── index.jsx          # Schema UI inputs (Segmented cards, sliders)
        └── tabs/                  # Main panels (Media, GPIO, System, Telemetry)
```

### 8.1 Visual Grid & Layout Editor
- **Fidelity Drag-and-Drop**: Built using vanilla pointer events to scale, move, and drag widgets on an active scale grid.
- **Live Previews**: Uses `widget-renderers.jsx` to render active representations of custom widgets directly inside the drag grid container.
- **Drafting Workflow**: All coordinate calculations are stored in local component state. Clicking **Publish** sends a single `POST` package containing the final canvas JSON configuration to `/api/templates/active` to compile and restart the kiosk client.

### 8.2 JSON Schema Controls
The `widget-edit-panel.jsx` and `controls/index.jsx` automatically render configuration interfaces by parsing `configSchema` properties defined in a widget's `manifest.json`. Developers do not write settings pages; they describe their needs in JSON, and the Admin Panel renders premium Tailwind visual elements:
- **`slider`**: Generates a smooth slide bar with minimum/maximum values, step values, and visual indicators.
- **`color`**: Displays a visual color picker featuring custom hex entries and saturation presets.
- **`radio` / `segmented`**: Generates modern segment cards with hover effects.
- **`file`**: Integrates a media selector that opens a library browser showing categorised images/videos/audio, supporting drag-and-drop uploads.

---

## 9. Raspberry Pi Kiosk Deployment Guide

Follow these steps to deploy and run PiDashboard in kiosk mode on a Raspberry Pi Zero 2W.

### 9.1 Base Installation & Runtime
SSH into the Pi Zero, clone the directory, and install the Bun runtime:
```bash
# 1. Install Bun (for 64-bit aarch64 OS)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# 2. Setup project folder
mkdir -p ~/PiDashboard
# (Sync LiteDashboard files using SCP/SFTP)

# 3. Create tmpfs widgets IPC folder if not already present
mkdir -p /tmp/widgets
```

### 9.2 Configure Systemd Service (`/etc/systemd/system/pidashboard.service`)
Create the service configuration to run the backend in the background:
```ini
[Unit]
Description=PiDashboard Server
After=network.target

[Service]
Type=simple
User=rpsaini
WorkingDirectory=/home/rpsaini/PiDashboard
ExecStart=/home/rpsaini/.bun/bin/bun run core/tools/server.ts
Restart=always
RestartSec=5
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```
Register and start the daemon:
```bash
sudo cp ~/PiDashboard/pidashboard.service /etc/systemd/system/pidashboard.service
sudo systemctl daemon-reload
sudo systemctl enable pidashboard.service
sudo systemctl start pidashboard.service
```

### 9.3 Configure Labwc Wayland Kiosk Autostart (`~/.config/labwc/autostart`)
Wayland is the default graphics server on modern Raspberry Pi OS releases. `labwc` acts as the compositor. To auto-launch Chromium in full-screen on boot, configure `~/.config/labwc/autostart`:

```bash
# Prevent screen blanking
gsettings set org.gnome.desktop.session idle-delay 0 || true

# Wait for local dashboard server to respond
while ! curl -s http://localhost:3000/ > /dev/null; do
  sleep 1
done

# Launch Chromium in borderless kiosk mode
chromium --kiosk --no-first-run --noerrdialogs --disable-infobars --start-maximized --ozone-platform=wayland http://localhost:3000/
```

Since the Pi's window manager is configured for desktop auto-login (`autologin-user=rpsaini`), rebooting the Pi Zero will launch the server and display the dashboard automatically!
