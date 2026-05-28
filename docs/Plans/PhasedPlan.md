# Raspberry Pi Zero 2W Smart Dashboard — Phased Architecture & Implementation Plan

> **Target hardware**: Raspberry Pi Zero 2W (512MB RAM, quad-core ARM Cortex-A53, single HDMI)
> **Scalable to**: Pi 4/5 (multi-display), x86 NUCs, Docker/headless servers
> **Core principles**: Customizability, modularity, lightweight, memory-aware

---

## Table of Contents

1. [Service Architecture Tiers & Runtime Contracts](#1-service-architecture-tiers--runtime-contracts)
2. [Widget Manifest Schema & Modularity System](#2-widget-manifest-schema--modularity-system)
3. [Admin Panel Architecture & Backend APIs](#3-admin-panel-architecture--backend-apis)
4. [File & Directory Structure](#4-file--directory-structure)
5. [Installer & Service Management](#5-installer--service-management)
6. [Phased Implementation Roadmap](#6-phased-implementation-roadmap)
7. [Platform Features & Optimizations](#7-platform-features--optimizations)

---

## 1. Service Architecture Tiers & Runtime Contracts

### Goal

Lock the system into a tiered, resource-aware architecture that works on a Pi Zero 2W (512MB RAM), provides crash isolation where needed, and keeps simple widgets cheap.

### Background Assumptions

- Display is a fullscreen kiosk (Cog/WPE) showing a **single HTML page** composed by Bun
- Bun is purely a **display compositor** — it reads JSON data from tmpfs and renders ALL widgets into one unified HTML page
- **Daemons do the heavy lifting**: data fetching, system access, sensor polling, MPD control, etc. They write JSON results to `/tmp/widgets/<widgetId>.json`
- For simple HTTP-only widgets (Tier 1b), Bun handles the fetch internally but still writes to the same tmpfs JSON pipeline
- The kiosk renders the single Bun-composed page — there are NO separate per-widget HTML documents loaded independently
- Widget packages provide **fragments** (HTML/CSS/JS snippets) that Bun injects into the single page, not standalone pages
- A **canvas** is a layout arrangement: which widgets, at what position/size/config, for a given resolution
- A **template** is a saved/named canvas preset — switchable, exportable, assignable to displays
- Core services run under systemd. Widget daemons are separate systemd units

---

### Approach A: One systemd daemon per widget (dedicated process model)

**How it works:**
- Each widget package ships a daemon (Go/Rust) running under its own systemd unit
- Daemon exposes a local endpoint or writes to IPC (e.g., tmpfs JSON) consumed by core server

**Tradeoffs:**

| Aspect | Assessment |
|:---|:---|
| RAM overhead | **Highest**. Each process has its own runtime + libraries |
| Crash isolation | **Excellent**. One widget crashing does not affect others |
| Restart granularity | **Excellent**. systemd can restart just the failed widget |
| Complexity | **Medium-high**. Many units, logs, updates, service management |

**Rough Pi Zero 2W per-daemon RAM estimates:**
- Go daemon: ~8–20MB RSS (depends on libs)
- Rust daemon: ~2–10MB RSS
- Bun/Node daemon: ~30–80MB RSS (**too heavy per-widget on Zero 2W**)

> 6–10 widgets as separate daemons can overwhelm memory quickly.

**Best for:** System-level access (`/proc`, dbus, GPIO, WiFi, BT, camera, audio, MPD integration), long-running computation (audio analysis, image processing, sensor fusion).

**Overkill for:** Simple HTTP fetch widgets.

---

### Approach B: Bun-handled widget fetching (centralized fetch host model)

**How it works:**
- A single Bun service loads widget fetch modules (or executes manifest-defined fetch definitions)
- Host polls HTTP APIs, does caching, normalization, and exposes a unified data API to the renderer/admin

**Tradeoffs:**

| Aspect | Assessment |
|:---|:---|
| RAM overhead | **Lowest per widget**. One runtime shared |
| Crash isolation | **Weaker**. A bug in one widget fetcher can crash the host unless sandboxed |
| Restart granularity | **Coarse**. Restarting host impacts all hosted widgets |
| Complexity | **Lower operationally**; higher inside the host (sandboxing, timeouts, per-widget limits) |

**RAM estimates:**
- Bun host: ~40–80MB RSS depending on workload
- Each additional HTTP-only widget adds mostly data/cache memory (~0.5–3MB per widget)

**Best for:** HTTP-only fetch widgets: weather, RSS, calendar ICS, quotes, time, simple APIs.

**Poor fit for:** Privileged/system access unless host runs privileged (not recommended).

---

### Approach C: Hybrid tiered model (RECOMMENDED)

**How it works:**
- Split widgets into tiers by resource needs and risk profile
- Use centralized host for "safe, low-cost" widgets; use dedicated daemons for privileged or heavy widgets

**Tradeoffs:**

| Aspect | Assessment |
|:---|:---|
| RAM overhead | **Balanced** |
| Crash isolation | **Strong where it matters**; acceptable for low-risk widgets |
| Restart granularity | **Fine for daemons**; acceptable coarse for host |
| Complexity | **Highest conceptually**, but manageable with strict tier rules and tooling |

---

### Recommended Tiered Architecture

#### Tier 0 — Core services (always-on)

> **IMPORTANT**: Bun runs as a **single-page compositor**. It reads all widget JSON from tmpfs, composes one HTML document with every enabled widget, and serves it to the kiosk. There is NO separate widget-host process.

| Service | Role | RAM |
|:---|:---|:---|
| `pi-dashboard.service` (Bun) | **Display compositor** + admin API + Tier 1b fetch + JSON→HTML rendering | ~40–80MB |
| `pi-dashboard-kiosk.service` (Cog/WPE) | Fullscreen kiosk — displays the single composed page | ~60–100MB |

**How Bun composes the display:**
```
1. Bun scans /tmp/widgets/*.json on interval (or watches via fs.watch)
2. For each enabled widget, reads its JSON data + its fragment (HTML/CSS/JS snippet)
3. Injects all widgets into ONE HTML page with positioned <div> containers
4. Serves this page at /display/main (or /display/:id for multi-display)
5. Kiosk renders the single page — all widgets visible simultaneously
6. Updates pushed via WebSocket to kiosk → DOM patches in-place (no full page reload)
```

**Estimated Tier 0 total: ~100–180MB**

#### Tier 1a — Client-only widgets (zero server cost)

**Definition:**
- Runs **entirely in the browser** (kiosk). Fragment JS handles all logic
- **Zero incremental cost on Bun** — no JSON file, no fetch, no daemon, no polling
- Bun only serves the fragment at page composition time; after that, the widget is self-sufficient
- Can use browser APIs: `Date()`, `setInterval`, `<video>`, `<img>`, CSS animations, local storage
- Can reference static assets from the widget package or media directory

**Examples:**

| Widget | Why client-only works |
|:---|:---|
| Clock / Date / Time | `new Date()` in JS — no server needed |
| Image display | `<img src="/media/...">` — static file serve |
| Image slideshow | Bun writes a file list JSON once at startup; fragment cycles with `setInterval` + CSS transitions |
| Video player | `<video src="/media/...">` — hardware-decoded by Pi GPU |
| Static text / quotes | Text baked into config, rendered by fragment |
| Countdown timer | Pure JS `Date.now()` arithmetic |
| Animated backgrounds | Pure CSS `@keyframes` |
| Embedded iframe | `<iframe src="...">` — the browser does everything |

**Estimated server RAM:** ~0 MB incremental (all cost is DOM complexity in the already-running kiosk)

**When to use:** If the widget can answer the question "do I need ANY data from outside the browser?" with NO → use client-only.

#### Tier 1b — Bun-fetched widgets (periodic HTTP fetch)

**Definition:**
- Bun fetches data from external HTTP/HTTPS APIs on a schedule
- Writes results to `/tmp/widgets/<widgetId>.json`
- Template reads the JSON and renders
- Hard limits: CPU timeouts, memory caps (soft), max response sizes, rate limits
- No shell execution, no file writes outside tmpfs

**Examples:**

| Widget | What Bun fetches |
|:---|:---|
| Weather | OpenWeather API every 10 min |
| RSS / News feed | RSS XML → parse → JSON every 15 min |
| Stocks / Crypto | Price API every 60s |
| Calendar | ICS URL every 30 min |
| Air quality | AQI API every 30 min |
| Motivational quote | Quote API once per day |

**Estimated RAM:**
- Incremental per widget: ~0.5–3MB for cached JSON + small transforms
- 10 Tier-1b widgets: ~5–30MB incremental

#### Tier 2 — Dedicated native/system daemons (systemd units, data producers only)

**Definition:**
- Needs system access, stable long-running connections, or heavy computation
- Runs with least privilege via systemd sandboxing
- **Only produces data** — writes JSON to `/tmp/widgets/<widgetId>.json`
- Has NO rendering responsibility. Bun reads the JSON and renders the widget UI

**Examples:**
Sysinfo (`/proc` scraping), MPD controller, lyrics sync, GPIO buttons/relays, camera capture, display brightness via PWM/GPIO, WiFi/BT manager bridges

**Estimated RAM:**
- Rust daemon: ~2–10MB each
- Go daemon: ~8–20MB each
- 4 daemons mixed: ~20–60MB total typical

#### Tier 3 — "High-risk / high-cost" external helpers (optional)

**Definition:**
- Memory-heavy (Python, Node) or use vendor SDKs
- Run rarely or on-demand; disabled by default on Zero 2W

**Examples:**
Computer vision, large ML inference, heavy browser automation

**Estimated RAM:** Highly variable; plan assumes disabled by default on Zero 2W.

---

### Revised RAM Budget (Pi Zero 2W, 512MB)

| Component | Estimate | Notes |
|:---|:---|:---|
| DietPi OS | ~40 MB | Measured baseline |
| Bun (compositor + server) | ~40–80 MB | Single process: compositor + admin API + Tier 1b fetching. Tier 1a costs nothing here |
| Cog/WPE kiosk | ~60–100 MB | Moderate DOM complexity |
| Wi-Fi / SSH / BT | ~15 MB | |
| Tier 2 daemons (3–4) | ~15–40 MB | Go/Rust mix |
| Video decode buffer | ~40–60 MB | Hardware-accelerated H.264 |
| tmpfs + cache | ~2 MB | |
| **Total** | **~212–337 MB** | |
| **Free Headroom** | **~175–300 MB** | **Comfortable even worst-case** |

---

### Core Runtime Contracts

Every widget must adhere to:

1. **Data output contract**: Tier 1b and Tier 2 widgets write JSON to `/tmp/widgets/<widgetId>.json`. Tier 1a widgets have **no data contract** — they are self-contained in the browser
2. **Health contract**: Each daemon (Tier 2+) exposes `GET /health` OR writes heartbeat to tmpfs. Tier 1a/1b have no health check (Bun monitors Tier 1b fetch success internally)
3. **Cache contract**: Last-known-good JSON retained in tmpfs; Bun serves cached data when source is unavailable (offline-first). Tier 1a widgets are inherently offline-capable
4. **Timeouts & backoff**: Enforced centrally for Tier 1b fetches; enforced in daemon template for Tier 2. Not applicable to Tier 1a
5. **Update frequency contract**: Tier 1b/Tier 2 widgets declare update frequency in manifest
   - Bun watches `/tmp/widgets/` for file changes (via `fs.watch`) and pushes DOM updates to the kiosk via WebSocket
   - For sub-second widgets (lyrics, music), the daemon can also push directly to Bun's WebSocket relay
   - Tier 1a widgets manage their own update cycle internally (e.g., `setInterval` for clock ticks)

### systemd Hardening Baseline (Tier 2 daemons)

```ini
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=<minimal>
DevicePolicy=closed    # except for device daemons (GPIO, camera)
Restart=on-failure
RestartSec=2
```

---

## 2. Widget Manifest Schema & Modularity System

### Goal

A schema-driven widget system where `manifest.json` is the source of truth for identity, config UI generation, data schema, resources, fallback behavior, and runtime requirements — without widget authors writing admin UI.

### Manifest Responsibilities

| Field Area | Purpose |
|:---|:---|
| Identity | `id`, `name`, `version`, `author`, `description` |
| Widget type + tier | `runner: "client"\|"hosted"\|"systemd"` |
| Transport | `transport: "poll"\|"websocket"` |
| Default layout | `x/y/width/height/zIndex/opacity` |
| Config UI schema | `configSchema[]` typed fields |
| Base fields (auto-injected) | `opacity`, `x`, `y`, `width`, `height`, `zIndex`, `activeFrom`, `activeTo`, `enabled` |
| Data schema | JSON schema-ish definition for produced data |
| Polling + caching | `pollIntervalSec`, `staleAfterSec`, `cacheStrategy` |
| Resources | Required assets, secrets, fallback files |
| Validation | `min/max`, `regex`, `required`, `enum` options |
| Capabilities | `needsNetwork`, `needsProcfs`, `needsGpio`, `needsAudio`, `needsCamera`, etc. |
| Requirements | `minRamMB`, `gpio_pins`, `i2c`, platform constraints |

### Proposed Manifest Schema (High-Level)

```
widgetId          (string, unique)
displayName       (string)
version           (semver)
tier              ("1a"|"1b"|"2"|"3")
runner            ("client"|"hosted"|"systemd")

entrypoints:
  fragment:       fragment/weather.html    ← HTML/CSS/JS snippet injected into the active canvas
  daemon:         daemon/bin/weatherd      ← Tier 2 only (data producer)
  fetchModule:    fetch/weather.ts         ← Tier 1b only (Bun fetch logic)

defaultLayout:    { x, y, width, height, zIndex, opacity }

polling:          { pollIntervalSec, jitterSec, timeoutMs,
                    backoff: { baseSec, maxSec } }

dataSchema:       { type: "object", properties: ... }

resources:
  secrets:        [{ key, label, required, hint }]
  media:          [{ slot, label, type: "image|video|audio", required, fallbackPath }]

configSchema:     array of field definitions:
                  { key, label, type, default, min, max, step, options, hint, required, pattern }

requirements:
  minRamMB:       (number, optional)
  gpio_pins:      [{ pin, mode, purpose }]  ← optional
  i2c:            (boolean, optional)
  capabilities:   ["network", "gpio", "audio", ...]

fallbackData:     last-resort JSON used if nothing cached (prevents blank widget)
```

### Picking the Right Tier — Decision Flowchart

```
Does the widget need ANY data from outside the browser?
  │
  ├─ NO  → Tier 1a (client-only)
  │       Examples: clock, timer, slideshow, video, static text
  │       Runner: "client"
  │       Cost: 0 extra server RAM
  │
  └─ YES → Can a simple HTTP fetch get the data?
           │
           ├─ YES → Tier 1b (Bun-fetched)
           │       Examples: weather, RSS, stocks, calendar
           │       Runner: "hosted"
           │       Cost: ~0.5–3MB per widget (JSON cache)
           │
           └─ NO  → Does it need system access, sockets, or heavy computation?
                    │
                    ├─ YES, lightweight → Tier 2 (Go/Rust daemon)
                    │   Examples: MPD, sysinfo, GPIO, camera
                    │   Runner: "systemd"
                    │   Cost: ~2–20MB per daemon
                    │
                    └─ YES, heavy → Tier 3 (external helper)
                        Examples: ML inference, computer vision
                        Runner: "systemd" + gated by platform profile
                        Cost: variable, disabled on Pi Zero 2W
```

### Example Manifest — Clock Widget (Tier 1a, client-only)

```json
{
  "widgetId": "clock",
  "displayName": "Clock",
  "version": "1.0.0",
  "tier": "1a",
  "runner": "client",
  "entrypoints": {
    "fragment": "fragment/clock.html"
  },
  "defaultLayout": {
    "x": 20, "y": 20,
    "width": 300, "height": 120,
    "zIndex": 5, "opacity": 1.0
  },
  "configSchema": [
    {
      "key": "format",
      "label": "Time Format",
      "type": "select",
      "default": "24h",
      "options": ["12h", "24h"]
    },
    {
      "key": "showSeconds",
      "label": "Show Seconds",
      "type": "toggle",
      "default": false
    },
    {
      "key": "showDate",
      "label": "Show Date",
      "type": "toggle",
      "default": true
    },
    {
      "key": "timezone",
      "label": "Timezone",
      "type": "text",
      "default": "auto",
      "hint": "'auto' uses system timezone. Or specify like 'Asia/Kolkata'."
    },
    {
      "key": "fontFamily",
      "label": "Font",
      "type": "select",
      "default": "monospace",
      "options": ["monospace", "sans-serif", "serif", "digital"]
    },
    {
      "key": "accentColor",
      "label": "Accent Color",
      "type": "color",
      "default": "#ffffff"
    }
  ],
  "requirements": {
    "capabilities": []
  }
}
```

> **Note**: No `polling`, no `dataSchema`, no `fallbackData`, no `fetchModule`, no `daemon`. This widget runs entirely in the browser using `setInterval` + `new Date()`. Zero server cost after initial page load. The `fragment/clock.html` is a self-contained HTML snippet.

### Example Manifest — Weather Widget (Tier 1b, Bun-fetched)

```json
{
  "widgetId": "weather",
  "displayName": "Weather",
  "version": "1.0.0",
  "tier": "1b",
  "runner": "hosted",
  "entrypoints": {
    "fragment": "fragment/weather.html",
    "fetchModule": "fetch/weather.ts"
  },
  "defaultLayout": {
    "x": 40, "y": 40,
    "width": 360, "height": 220,
    "zIndex": 10, "opacity": 1.0
  },
  "polling": {
    "pollIntervalSec": 600,
    "jitterSec": 15,
    "timeoutMs": 4000,
    "backoff": { "baseSec": 30, "maxSec": 1800 }
  },
  "resources": {
    "secrets": [
      {
        "key": "OPENWEATHER_API_KEY",
        "label": "OpenWeather API Key",
        "required": true,
        "hint": "Stored locally; never sent off device."
      }
    ],
    "media": [
      {
        "slot": "fallbackIcon",
        "label": "Fallback Icon",
        "type": "image",
        "required": false,
        "fallbackPath": "/opt/pi-dashboard/widgets/weather/assets/default.png"
      }
    ]
  },
  "configSchema": [
    {
      "key": "locationMode",
      "label": "Location Mode",
      "type": "radio",
      "default": "city",
      "options": ["city", "latlon"],
      "hint": "Choose how the widget resolves your location."
    },
    {
      "key": "city",
      "label": "City",
      "type": "text",
      "default": "London",
      "hint": "Used when Location Mode = city."
    },
    {
      "key": "lat",
      "label": "Latitude",
      "type": "number",
      "default": 51.5072,
      "min": -90, "max": 90,
      "hint": "Used when Location Mode = latlon."
    },
    {
      "key": "lon",
      "label": "Longitude",
      "type": "number",
      "default": -0.1276,
      "min": -180, "max": 180,
      "hint": "Used when Location Mode = latlon."
    },
    {
      "key": "units",
      "label": "Units",
      "type": "select",
      "default": "metric",
      "options": ["metric", "imperial"],
      "hint": "Controls °C/°F and wind units."
    },
    {
      "key": "showForecast",
      "label": "Show 3-day forecast",
      "type": "toggle",
      "default": true
    },
    {
      "key": "accentColor",
      "label": "Accent Color",
      "type": "color",
      "default": "#4ea1ff"
    }
  ],
  "dataSchema": {
    "type": "object",
    "properties": {
      "temp": { "type": "number" },
      "condition": { "type": "string" },
      "icon": { "type": "string" },
      "forecast": { "type": "array" }
    },
    "required": ["temp", "condition"]
  },
  "requirements": {
    "capabilities": ["network"]
  },
  "fallbackData": {
    "temp": 0,
    "condition": "Unavailable",
    "icon": "fallbackIcon",
    "forecast": []
  }
}
```

### Example Manifest — Music Player Widget (Tier 2, systemd daemon)

```json
{
  "widgetId": "music-player",
  "displayName": "Music Player",
  "version": "1.0.0",
  "tier": "2",
  "runner": "systemd",
  "transport": "websocket",
  "entrypoints": {
    "fragment": "fragment/music-player.html",
    "daemon": "daemon/bin/musicd"
  },
  "defaultLayout": {
    "x": 420, "y": 40,
    "width": 820, "height": 220,
    "zIndex": 20, "opacity": 1.0
  },
  "polling": {
    "pollIntervalSec": 1,
    "jitterSec": 0,
    "timeoutMs": 500,
    "backoff": { "baseSec": 2, "maxSec": 30 }
  },
  "resources": {
    "secrets": [],
    "media": [
      {
        "slot": "defaultAlbumArt",
        "label": "Default Album Art",
        "type": "image",
        "required": false,
        "fallbackPath": "/opt/pi-dashboard/widgets/music-player/assets/default-art.png"
      }
    ]
  },
  "configSchema": [
    {
      "key": "backend",
      "label": "Backend",
      "type": "select",
      "default": "mpd",
      "options": ["mpd", "spotify-connect"],
      "hint": "Select your music source."
    },
    {
      "key": "mpdHost",
      "label": "MPD Host",
      "type": "text",
      "default": "127.0.0.1"
    },
    {
      "key": "mpdPort",
      "label": "MPD Port",
      "type": "number",
      "default": 6600,
      "min": 1, "max": 65535
    },
    {
      "key": "showLyrics",
      "label": "Show lyrics",
      "type": "toggle",
      "default": false
    },
    {
      "key": "lyricsProvider",
      "label": "Lyrics Provider",
      "type": "radio",
      "default": "none",
      "options": ["none", "lrclib"],
      "hint": "May require network access."
    },
    {
      "key": "progressStyle",
      "label": "Progress Style",
      "type": "select",
      "default": "bar",
      "options": ["bar", "wave"]
    }
  ],
  "dataSchema": {
    "type": "object",
    "properties": {
      "state": { "type": "string" },
      "artist": { "type": "string" },
      "title": { "type": "string" },
      "album": { "type": "string" },
      "positionSec": { "type": "number" },
      "durationSec": { "type": "number" },
      "albumArtPath": { "type": "string" },
      "lyrics": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "time": { "type": "number" },
            "line": { "type": "string" }
          }
        }
      },
      "currentLineIndex": { "type": "number" }
    }
  },
  "requirements": {
    "capabilities": ["network", "audio"],
    "minRamMB": 256
  },
  "fallbackData": {
    "state": "stopped",
    "artist": "",
    "title": "No music",
    "album": "",
    "positionSec": 0,
    "durationSec": 0,
    "albumArtPath": "defaultAlbumArt"
  }
}
```

### Admin Auto-Generated Config Panel

- Admin reads `manifest.json` for widget, merges **base fields** + `configSchema`
- Renders form controls based on `type`:
  - `text` / `number` / `slider` / `toggle` / `color` / `time` / `select` / `radio` / `file`
- Inline validation:
  - `required`, `min/max`, `pattern`, `options` membership
- `"file"` picker binds to Media Manager assets; stores a file path or media id

### Canvas & Template Concepts

**Canvas** = a layout arrangement for a specific display resolution:
- Which widgets are placed on it
- Each widget's position (`x`, `y`, `width`, `height`, `zIndex`, `opacity`)
- Per-widget config overrides (e.g., this canvas uses Celsius, another uses Fahrenheit)
- Resolution / dimensions (e.g., 1920×1080, 1280×720)

**Template** = a saved/named canvas preset:
- A JSON snapshot of the full canvas state (widget selection + placements + configs)
- Switchable: one template is "active" per display at any time
- Multiple templates can be created: `morning.json`, `night.json`, `work.json`, etc.
- Import/export as JSON files for sharing between devices

**Multi-display (later phase)**:
- Each connected display can have a different active template
- The same template can be assigned to multiple displays
- Multiple canvases can be active simultaneously across displays

### Drag-and-Drop Layout Editor

- Widget bounding box defaults come from `manifest.defaultLayout`
- Current canvas layout values are stored in the active template:
  - `x`, `y`, `width`, `height`, `zIndex`, `opacity` per widget
- Layout editor:
  - Reads active template to place widgets on a canvas matching display resolution
  - On drag/resize, writes back to template storage immediately (debounced) or on "Save"
  - Canvas resolution selector (match connected display or set custom)
- Templates snapshot the entire canvas state (widget selection + positions + configs)

---

## 3. Admin Panel Architecture & Backend APIs

### Goal

Design the admin panel as a "full Linux control panel" with clear tab structure, backend endpoints, security model, and service integration.

### Core Web Architecture

- **Admin frontend**: React (runs on user's phone/laptop browser, NOT on the Pi)
- **Backend + Display compositor**: Single Bun server — handles admin API AND composes the single display page
- **Display page**: A single HTML page composed by Bun from widget fragments + JSON data, based on the active canvas template

**Backend responsibilities:**
- **Compose the display page**: read active canvas template, load widget fragments + `/tmp/widgets/*.json`, serve as single HTML
- **Push live updates**: watch tmpfs for changes → push DOM patches to kiosk via WebSocket (no full page reload)
- Tier 1b data fetching (HTTP APIs → write JSON to tmpfs)
- Auth + sessions
- Read/write `config.json` + per-widget configs
- Manage canvas templates (save/load/switch)
- Media upload + file inventory
- System control via constrained helper commands (prefer daemons/DBus; avoid arbitrary shell)
- Service management via systemd (through a privileged helper service)

### Tabs / Sections

| Tab | Purpose |
|:---|:---|
| Authentication | Login, lock screen, session management |
| Dashboard Overview | RAM/CPU graphs, service status, crash analytics |
| Widgets | Enable/disable, configure, preview |
| Canvases & Templates | Drag-drop canvas editor, template save/load/switch |
| Displays | Multi-display management (gated by platform profile) |
| Media & File Manager | Upload, organize, orphan cleanup |
| System Control | WiFi, BT, SSH, display, power, service manager |
| GPIO | Pin configuration, sensor setup (gated by platform profile) |
| Updates | OTA update check, apply, rollback |
| Widget Marketplace | Browse, install, update (future) |

### Authentication Design

- Password auth stored as **argon2** hash in local file: `/opt/pi-dashboard/secrets/admin.passhash`
- Cookie-based session token:
  - Signed token stored in HTTP-only cookie
  - Configurable expiry (1h / 24h / 7d)
- Lock screen vs logout:
  - **Lock**: keep session cookie but require re-enter password to unlock UI
  - **Logout**: revoke token / clear cookie

### Dashboard Overview Tab

| Feature | Data Source |
|:---|:---|
| Live RAM/CPU graph (poll every 3s) | Tier 2 sysinfo daemon or `/api/sysinfo` |
| Per-widget RAM breakdown | Tier 2: PID → RSS from `/proc/<pid>/status`; Tier 1b: host internal metrics |
| Active services list | systemd unit states for core + widget daemons |
| Quick restart buttons | `POST /api/systemd/restart?unit=...` |
| Maintenance mode toggle | Stops kiosk + widget daemons; keeps admin + minimal sysinfo |
| System uptime, CPU temp | `/proc/uptime`, `/sys/class/thermal/...` |

### Widgets Tab

- Widget cards: enable/disable toggle (writes config, starts/stops service if Tier 2)
- "Edit" opens auto-generated config panel from manifest
- Widget-specific fields rendered from manifest
- Inline validation per manifest field definition
- **"Preview widget"**: renders widget with staged config without enabling on main screen

### Canvases & Templates Tab

- **Canvas editor**: drag-drop widgets onto a canvas matching display resolution
- **Save as template**: snapshot current canvas (widgets + positions + configs) as a named preset
- **Template list**: browse saved templates with thumbnails (SVG/canvas render of bounding boxes)
- **One-click switch**: activate a template → Bun recomposes the display page + restarts affected Tier 2 daemons
- **Per-display assignment** (Phase 10): assign different templates to different connected displays
- **Import/export JSON**: downloadable file; upload to restore or share between devices

### Media & File Manager Tab

- Upload via drag-and-drop
- Grid view with filename/size/type/upload date
- Usage status: reverse index by scanning all widget configs for file references
- Delete protection: backend refuses delete if referenced by active config
- Orphan detection: list media not referenced by any config/canvas template; bulk cleanup
- Per-widget storage quota display
- Fallback assignment UI: map required resource slot → selected file

### System Control Tab

| Feature | Backend |
|:---|:---|
| WiFi scan/connect/disconnect | `nmcli` via system-bridge or NetworkManager DBus |
| Bluetooth pair/unpair | `bluetoothctl`/DBus |
| SSH toggle + status + IP | systemd unit control |
| Display DPMS on/off, brightness | PWM/GPIO via gpio-bridge |
| Reboot / shutdown | system-bridge |
| Service manager | Table of all services, start/stop/restart, logs tail via `journalctl` |

### Security Boundary

- Admin web server does **NOT** run as root
- A privileged `system-bridge` daemon (Tier 2) exposes a narrow API:
  - systemd operations (start/stop/restart/status)
  - journal tail
  - nmcli/btctl operations (whitelisted)
  - reboot/shutdown
- Authenticate calls from core server to system-bridge via **Unix socket + filesystem permissions**

> **Note**: For Phase 1–3, `sudo systemctl` with a command whitelist is acceptable. The full system-bridge is introduced in Phase 7.

---

## 4. File & Directory Structure

### On-Pi File Structure

```
/opt/pi-dashboard/
├── core/
│   ├── server/               # Bun server (admin API + display compositor + Tier 1b fetcher)
│   ├── compositor/           # Page composition engine (reads fragments + JSON → single HTML)
│   ├── ipc/                  # IPC adapters (tmpfs watchers, unix sockets)
│   └── system-bridge/        # Privileged helper API (systemd, journal, wifi, power)
│
├── widgets/
│   ├── _base/
│   │   ├── manifest.schema.json   # Canonical JSON schema for manifests
│   │   ├── validate-manifest      # CLI/tool to validate widgets
│   │   └── field-renderers.md     # Mapping of configSchema types → UI controls
│   ├── clock/
│   ├── weather/
│   ├── music-player/
│   ├── sysinfo/
│   └── automation/
│
├── media/
│   ├── uploads/              # User uploaded assets
│   ├── thumbs/               # Generated thumbnails/previews
│   └── index.json            # Optional cached inventory index
│
├── canvases/
│   ├── active.json           # Points to currently active canvas template per display
│   └── saved/
│       ├── morning.json      # Saved canvas template: widgets + positions + configs + resolution
│       ├── night.json
│       └── work.json
│
├── state/
│   ├── cache/                # Widget-host cache, last-known-good JSON
│   ├── crashlog/             # Crash analytics events (jsonl or sqlite)
│   ├── metrics/              # Optional metrics snapshots
│   ├── config-backups/       # Config versioning snapshots
│   ├── rollback/             # OTA update rollback snapshots
│   ├── updates/              # Downloaded update bundles
│   └── locks/
│
├── secrets/
│   ├── admin.passhash        # Argon2 hash
│   └── widget-secrets.json   # API keys (encrypted optional)
│
├── installer/
│   ├── install.sh            # Master installer
│   ├── uninstall.sh
│   └── systemd/
│       ├── pi-dashboard.service
│       ├── pi-dashboard-kiosk.service
│       └── pi-dashboard-system-bridge.service
│
├── config.json               # Global config: enabled widgets, per-widget config,
│                             # display definitions (canvas templates stored in canvases/)
├── platform.json             # Auto-generated platform profile
└── versions.json             # Tracks core + each widget version separately
```

### Widget Package Structure (self-contained)

**Tier 1a — client-only (simplest):**
```
widgets/clock/
├── manifest.json
├── fragment/
│   ├── clock.html            # Widget HTML fragment (self-contained)
│   ├── clock.css             # Widget-scoped styles
│   └── clock.js              # All logic runs in browser (Date, setInterval)
└── install.sh
```

**Tier 1b — Bun-fetched:**
```
widgets/weather/
├── manifest.json
├── fetch/
│   └── weather.ts            # Bun fetch module (API call + JSON transform)
├── fragment/
│   ├── weather.html          # Widget HTML fragment
│   ├── weather.css           # Widget-scoped styles
│   └── weather.js            # Reads JSON data from compositor, updates DOM
├── assets/
│   └── default.png
└── install.sh
```

**Tier 2 — daemon (data producer):**
```
widgets/music-player/
├── manifest.json
├── daemon/                   # Go/Rust data producer
│   ├── src/
│   └── bin/musicd
├── fragment/
│   ├── music-player.html     # Widget HTML fragment
│   ├── music-player.css
│   └── music-player.js
├── assets/
│   └── default-art.png
└── install.sh
```

> **Key**: `fragment/*.html` is NOT a standalone page. It is an HTML fragment that Bun injects into the composed display page inside a `<div data-widget="<widgetId>">` container. The CSS is auto-namespaced to prevent widget style collisions.

### Admin Panel Codebase (development machine, NOT on Pi)

```
apps/admin/
├── src/
│   ├── app-shell/                  # Nav, routing, auth guard, layout
│   ├── shared/
│   │   ├── api/                    # Typed API client
│   │   ├── components/             # Button, Modal, Form controls, Charts
│   │   ├── hooks/
│   │   └── utils/
│   ├── tabs/
│   │   ├── overview/
│   │   ├── widgets/
│   │   ├── canvases/                # Canvas editor + template management
│   │   ├── displays/               # Multi-display management
│   │   ├── media-manager/
│   │   ├── system-control/
│   │   ├── gpio/                   # GPIO pin configuration
│   │   ├── updates/                # OTA update management
│   │   ├── auth/
│   │   └── marketplace/            # Future
│   └── manifest-ui/
│       ├── SchemaForm.tsx          # Renders configSchema to UI
│       ├── validators.ts
│       └── field-types/            # text, slider, toggle, color, file picker etc.
└── public/
```

### Key Boundary Decisions

- **Single-page display**: Bun reads the active canvas template, loads all widget fragments, composes one HTML page
- **Daemons are data-only**: They write JSON to tmpfs and have zero rendering responsibility
- **Fragments ≠ Templates**: "Fragment" = widget HTML snippet. "Template" = saved canvas layout preset. Never mix these terms
- Admin config panel is generated solely from manifest schema; widget authors do NOT ship admin UI
- System-level operations are mediated by `system-bridge`
- Widget fragments are **plain HTML/CSS/JS** — no build step, no framework dependency

---

## 5. Installer & Service Management

### Goal

A master installer that reliably provisions the Pi, plus a standard widget installer contract.

### Master Installer: `installer/install.sh`

**Preflight checks:**
- Detect model (Pi Zero 2W / Pi 4 / Pi 5 / x86_64 / aarch64)
- Record CPU arch, check RAM
- Validate OS (Debian / Raspberry Pi OS version)
- Check disk space

**Install system dependencies:**
- Bun runtime (pinned version, offline fallback from bundled tarball)
- Kiosk engine: Cog/WPE on Pi (lighter than Chromium); Chromium option on higher-RAM devices
- Nginx (optional reverse proxy) + local TLS (optional, future)

**Create directory structure:**
- `/opt/pi-dashboard/...` dirs with correct ownership
- tmpfs mount in `/etc/fstab` for cache/IPC

**Generate platform profile:**
- Auto-detect hardware capabilities → write `/opt/pi-dashboard/platform.json`

**Install core services:**
- `pi-dashboard.service` (merged Bun server)
- `pi-dashboard-system-bridge.service` (privileged, deferred to Phase 7)
- `pi-dashboard-kiosk.service` (Cog/WPE launching URL)

**Install default widgets:**
- Copy widget packages
- For each default widget: run `install.sh install`
- Enable as per default `config.json`

**Enable autostart:**
```bash
systemctl enable --now pi-dashboard.service
systemctl enable --now pi-dashboard-kiosk.service
```

**Configure kiosk:**
- Set to open `http://127.0.0.1:<port>/display/main`
- Boot splash screen integration

### Widget Installer Contract

Every widget's `widgets/<id>/install.sh` must implement:

| Command | Action |
|:---|:---|
| `install` | Place files, register systemd unit if Tier 2, set permissions |
| `uninstall` | Stop service, remove unit/files, cleanup state/cache |
| `enable` | Mark enabled in config + start service (Tier 2) or register with host (Tier 1b) |
| `disable` | Stop service / unregister, mark disabled |

**Contract rules:**
- Must print machine-readable status lines (`KEY=VALUE`) for logging
- Must be **idempotent** (running install twice is safe)
- Must check for GPIO pin conflicts if widget declares `gpio_pins` requirements

### systemd Unit Naming

- `pi-dashboard-widget-<widgetId>.service` for Tier 2 daemons
- Labels/metadata in unit files to allow admin grouping

### Operational Policies

- All core services restart on failure
- Bun compositor isolates Tier 1b fetches with:
  - Per-widget timeout
  - Per-widget max response size
  - Per-widget backoff
  - Defensive JSON parsing

---

## 6. Phased Implementation Roadmap

### Goal

Break the project into phases with concrete deliverables, created components, and dependencies.

---

### Phase 0 — Architecture Finalization

**Deliverables:**
- [ ] This document approved
- [ ] Manifest schema v1 frozen
- [ ] Tier rules frozen + default widget list decided

**Dependencies:** None

---

### Phase 1 — Core Foundation

**Deliverables:**
- [ ] Bun core server skeleton (admin + display compositor endpoints)
- [ ] tmpfs IPC/cache directories (`/tmp/widgets/`)
- [ ] Minimal single-page compositor that shows a clock widget
- [ ] Basic admin shell with navigation (tabs present but mostly empty)
- [ ] Kiosk service starts display on boot, pointing at composed page

**Created components/files:**
- `/opt/pi-dashboard/core/server/*` scaffolding
- `/opt/pi-dashboard/core/compositor/*` (page composition engine)
- Admin app shell: `apps/admin/src/app-shell/*`, `tabs/*` placeholders

**Dependencies:** Phase 0

---

### Phase 2 — Widget Engine (Manifest System)

**Deliverables:**
- [ ] Manifest validator (schema + runtime validation)
- [ ] Widget registry loader (scan `/opt/pi-dashboard/widgets/*/manifest.json`)
- [ ] Auto-generated config panel from `configSchema`
- [ ] Weather widget (Tier 1b) end-to-end: Bun fetches API → writes JSON to tmpfs → compositor injects fragment into page
- [ ] Sysinfo widget daemon (Tier 2) end-to-end: Go daemon writes JSON to tmpfs → compositor renders
- [ ] Offline-first caching of last-known-good JSON per widget in tmpfs
- [ ] WebSocket push: compositor watches tmpfs → pushes DOM patches to kiosk

**Created components/files:**
- `widgets/_base/manifest.schema.json`
- Admin schema form renderer: `apps/admin/src/manifest-ui/*`
- Compositor engine: fragment loading + JSON injection + WebSocket push
- Example widget packages: `widgets/weather`, `widgets/sysinfo`

**Dependencies:** Phase 1

---

### Phase 3 — Authentication & Basic Admin Depth

**Deliverables:**
- [ ] Authentication: argon2 hash storage, cookie session, lock screen
- [ ] Maintenance mode toggle
- [ ] Service list + status + restart buttons (via `sudo systemctl` whitelist for now)
- [ ] Per-widget RAM breakdown view (PID-based for Tier 2)
- [ ] Crash analytics capture (jsonl)

**Created components/files:**
- `/opt/pi-dashboard/secrets/admin.passhash`
- Admin tabs: `tabs/overview/*`, `tabs/auth/*`

**Dependencies:** Phase 2 (widget list), Phase 1 (core server)

---

### Phase 4 — Canvas Editor

**Deliverables:**
- [ ] Drag/drop canvas editor (matching display resolution)
- [ ] Resize handles, snapping/grid optional
- [ ] z-index controls
- [ ] `activeFrom`/`activeTo` time gating per widget
- [ ] Live preview of canvas in kiosk (no reboot required)

**Created components/files:**
- `apps/admin/src/tabs/canvases/CanvasEditor/*`
- Backend endpoints to persist canvas layout into active template

**Dependencies:** Phase 2 (manifest + base fields), Phase 3 (auth)

---

### Phase 5 — Canvas Template System

**Deliverables:**
- [ ] Save/load named canvas templates (snapshot of widget selection + positions + configs + resolution)
- [ ] Template thumbnails (SVG/canvas render of bounding boxes)
- [ ] Import/export template JSON (for sharing between devices)
- [ ] Apply template atomically → Bun recomposes display + restarts affected Tier 2 daemons
- [ ] Canvas resolution selector (match display or set custom)

**Created components/files:**
- `/opt/pi-dashboard/canvases/*`
- Admin tab: `apps/admin/src/tabs/canvases/*`

**Dependencies:** Phase 4 (canvas editor), Phase 2 (config system)

---

### Phase 6 — Media & File Manager

**Deliverables:**
- [ ] Upload, thumbnail generation
- [ ] Usage tracking across active config + canvas templates
- [ ] Delete protection + orphan cleanup
- [ ] Fallback resource assignment UI per widget resource slot
- [ ] Per-widget quota reporting

**Created components/files:**
- `/opt/pi-dashboard/media/*`
- Admin tab: `apps/admin/src/tabs/media-manager/*`

**Dependencies:** Phase 2 (resource declarations in manifest), Phase 5 (canvas templates for "inactive template" labeling)

---

### Phase 7 — System Control & System Bridge

**Deliverables:**
- [ ] `system-bridge` privileged daemon (narrow API, Unix socket auth)
- [ ] WiFi scan/connect/disconnect
- [ ] Bluetooth pair/unpair
- [ ] SSH toggle + status + IP display
- [ ] Display DPMS on/off, brightness control if supported
- [ ] Reboot/shutdown
- [ ] Service manager with logs tail

**Created components/files:**
- `/opt/pi-dashboard/core/system-bridge/*`
- Admin tab: `apps/admin/src/tabs/system-control/*`

**Dependencies:** Phase 3 (auth strongly recommended)

---

### Phase 8 — Distribution & Installer

**Deliverables:**
- [ ] `install.sh` master installer (platform-detecting, idempotent)
- [ ] `uninstall.sh` clean removal
- [ ] OTA update engine (check + download + verify checksum + apply + rollback)
- [ ] Platform profile generator (`platform.json`)
- [ ] Admin panel "Updates" section
- [ ] CI pipeline to build pre-built OS images for Pi Zero 2W, Pi 4, Pi 5
- [ ] Docker distribution for non-Pi hosts

**Distribution tiers:**

| Tier | Method | Target Users |
|:---|:---|:---|
| Tier 1 | `curl -fsSL https://pidashboard.dev/install.sh \| sudo bash` | Developers, tinkerers |
| Tier 2 | Pre-built OS image (flash with Pi Imager → boot) | General users |
| Tier 3 | Docker container | Non-Pi hosts, servers |

**Self-updating OTA flow:**
1. Admin panel checks `https://releases.pidashboard.dev/latest.json`
2. User clicks "Update" → backend downloads bundle
3. Verify sha256 checksum
4. Snapshot current state to rollback directory
5. Apply update atomically (extract to staging → swap)
6. Run config migration scripts
7. Restart affected services
8. Health check → OK: cleanup old snapshots / FAIL: auto-rollback

**Platform profile system (`platform.json`):**

```json
{
  "profile": "pi-zero-2w",
  "arch": "armv7l",
  "ramMB": 512,
  "cores": 4,
  "gpu": "VideoCore IV",
  "hasGpio": true,
  "hasI2c": true,
  "hasSpi": true,
  "maxDisplays": 1,
  "recommendedKiosk": "cog",
  "tier3Allowed": false,
  "maxTier2Daemons": 4,
  "performanceMode": "conservative"
}
```

**Feature gating by profile:**

| Feature | Pi Zero 2W | Pi 4/5 | x86 NUC | Docker |
|:---|:---|:---|:---|:---|
| GPIO | ✅ | ✅ | ❌ | ❌ |
| Tier 3 widgets | ❌ | Optional | ✅ | ✅ |
| Multi-display | ❌ (1 HDMI) | ✅ (2 HDMI) | ✅ (2–6) | ✅ (network) |
| Max Tier 2 daemons | 4 | 8 | Unlimited | Unlimited |
| Recommended kiosk | Cog/WPE | Cog or Chromium | Chromium | N/A (external) |

**Widget update independence:**
- Core system and widget updates are separate channels
- `versions.json` tracks core + each widget version independently

**Created components/files:**
- `installer/install.sh`, `installer/uninstall.sh`
- OTA update engine in server
- `platform.json` generator
- Admin tab: `apps/admin/src/tabs/updates/*`

**Dependencies:** Phase 7 (system-bridge for service restarts during updates)

---

### Phase 9 — GPIO & Hardware I/O

**Deliverables:**
- [ ] `gpio-bridge` daemon (Tier 2, Go or Rust, ~3–8MB)
- [ ] GPIO config schema + admin UI tab
- [ ] Pin conflict detection engine
- [ ] I2C/SPI bus support
- [ ] At least 2 reference widgets:
  - `sensor-temp` (I2C BME280 → temperature/humidity widget)
  - `motion-wake` (PIR sensor → screen wake)

**GPIO bridge architecture:**

```
gpio-bridge daemon (Tier 2, root or gpio group)
  │
  ├── Reads: /opt/pi-dashboard/gpio-config.json
  ├── Writes: /tmp/widgets/gpio.json          ← sensor readings
  ├── Exposes: Unix socket or HTTP             ← control commands
  ├── Watches: Pin interrupts                  ← hardware events
  └── Polls: ADC via I2C/SPI                   ← analog sensors
```

**GPIO config schema:**

```json
{
  "gpio": {
    "pins": [
      {
        "pin": 17,
        "mode": "input",
        "pull": "up",
        "label": "Motion Sensor",
        "trigger": "rising",
        "action": "wake_display"
      },
      {
        "pin": 18,
        "mode": "output",
        "type": "pwm",
        "label": "Screen Brightness",
        "default": 100
      },
      {
        "pin": 27,
        "mode": "input",
        "pull": "up",
        "label": "Physical Button",
        "trigger": "falling",
        "debounceMs": 200,
        "action": "next_template"
      }
    ],
    "i2c": [
      {
        "bus": 1,
        "address": "0x76",
        "driver": "bme280",
        "label": "Temp/Humidity/Pressure",
        "pollIntervalSec": 30
      }
    ]
  }
}
```

**Safety controls:**
- **Pin conflict detection**: Block if two widgets claim the same pin
- **Output limits**: PWM duty cycle capped, relay toggle rate-limited
- **Reserved pins**: I2C, SPI, UART pins locked out of general GPIO config
- **Admin-only**: GPIO changes require auth + confirmation dialog
- **Dry-run mode**: Test pin config without activating

**Manifest extension for GPIO widgets:**

```json
{
  "requirements": {
    "capabilities": ["gpio"],
    "gpio_pins": [
      { "pin": 17, "mode": "input", "purpose": "Motion detection" }
    ],
    "i2c": true
  }
}
```

**Gating:** GPIO tab hidden when `platform.json` has `"hasGpio": false`.

**Created components/files:**
- `gpio-bridge` daemon source + binary
- GPIO config schema
- Admin tab: `apps/admin/src/tabs/gpio/*`
- Reference widgets: `widgets/sensor-temp`, `widgets/motion-wake`

**Dependencies:** Phase 7 (system-bridge for hardware access mediation)

---

### Phase 10 — Multi-Display Support

**Deliverables:**
- [ ] Display registration API (`POST /api/displays`, `GET /api/displays/:id`)
- [ ] Per-display canvas template assignment in `config.json`
- [ ] Per-display kiosk URL routing (`/display/:id`)
- [ ] Display management admin tab
- [ ] Display heartbeat / online status tracking (WebSocket)
- [ ] Platform profile `maxDisplays` gating
- [ ] At least one tested multi-display setup (Pi 4 dual HDMI or x86 + 2 monitors)

**Display registration model:**

```
GET /display/main          ← primary kiosk (default, backwards-compatible)
GET /display/lobby         ← second display, different layout
GET /display/kitchen       ← third display, only shows clock + weather
GET /display/storefront    ← fourth display, product slideshow
```

Each display gets its own:
- Layout (widget positions, sizes, z-index)
- Widget set (which widgets are enabled)
- Canvas template assignment
- Resolution profile
- Active schedule

**Config schema extension:**

```json
{
  "displays": {
    "main": {
      "resolution": { "width": 1280, "height": 720 },
      "orientation": "landscape",
      "widgets": ["clock", "weather", "music-player"],
      "activeTemplate": "default",
      "schedule": {
        "06:00-22:00": "daytime",
        "22:00-06:00": "night"
      }
    },
    "lobby": {
      "resolution": { "width": 1920, "height": 1080 },
      "orientation": "portrait",
      "widgets": ["slideshow", "clock", "announcements"],
      "activeTemplate": "lobby-signage"
    }
  }
}
```

**Widget data sharing:** Daemons produce data **once**. Multiple displays consume the same JSON — no duplication.

**Display-specific rendering:** Widgets use CSS container queries or receive display context to adapt (compact mode for small displays, full mode for large).

**Multi-kiosk connection:**

| Platform | Method |
|:---|:---|
| Pi 4/5 (dual HDMI) | Two Cog instances, each on its own HDMI output via Wayland |
| x86 NUC | Multiple Chromium windows in kiosk mode, one per display |
| Network clients | Any device browser opens `http://host/display/<name>` |

**RAM implications:**

| Profile | Displays | Kiosk RAM | Server RAM |
|:---|:---|:---|:---|
| Pi Zero 2W | 1 | ~60–100 MB | ~40–80 MB |
| Pi 4 (4GB) | 2 | ~120–200 MB | ~50–100 MB |
| x86 NUC (16GB) | 4 | ~400–600 MB | ~80–150 MB |
| Docker (headless) | 0 local | 0 MB | ~40–80 MB |

**Gating:** "Add Display" button hidden when `platform.json` has `maxDisplays === 1`.

**Created components/files:**
- Display registration API endpoints
- Per-display config storage
- Admin tab: `apps/admin/src/tabs/displays/*`

**Dependencies:** Phase 4 (layout editor), Phase 8 (platform profiles)

---

### Phase 11 — Widget Marketplace

**Deliverables:**
- [ ] Registry index fetch + browse
- [ ] Install/uninstall/update flows
- [ ] Installer script execution under controlled environment
- [ ] Widget verification (manifest validation, signature optional future)

**Created components/files:**
- Admin tab: `apps/admin/src/tabs/marketplace/*`
- Backend: registry client + package installer runner

**Dependencies:** Phase 8 (installer contract must be battle-tested), Phase 3 (auth), Phase 2 (manifest validation)

> **Note:** Phase 8 (Distribution) MUST come before Phase 11. Users can't install marketplace widgets without a working installer contract.

---

### Phase Dependency Graph

```
Phase 0
  └─→ Phase 1
       └─→ Phase 2
            ├─→ Phase 3 (Auth)
            │    ├─→ Phase 4 (Canvas Editor)
            │    │    ├─→ Phase 5 (Canvas Templates)
            │    │    │    └─→ Phase 6 (Media)
            │    │    └─→ Phase 10 (Multi-display)
            │    └─→ Phase 7 (System Control)
            │         ├─→ Phase 8 (Distribution)
            │         │    └─→ Phase 11 (Marketplace)
            │         └─→ Phase 9 (GPIO)
            └─→ Phase 11 (also needs Phase 2 for manifest)
```

---

## 7. Platform Features & Optimizations

### Offline-First & Never-Blank Display

**Last-known-good cache per widget:**
- Tier 1b: Server persists JSON snapshots to `/opt/pi-dashboard/state/cache/<widgetId>.json`
- Tier 2: Daemon writes snapshots to cache path; server reads if daemon offline

**Boot behavior:**
- Renderer loads immediately with cached widget data (stale markers allowed)
- Widgets visually indicate stale/offline state instead of disappearing

### Boot Splash Screen

- Simple splash shown by kiosk before renderer loads (static HTML/PNG)
- Replace splash with dashboard when core server health is OK

### Night Mode / Scheduled Dimming

- Global schedule in `config.json`
- System-bridge controls: DPMS off or brightness reduction
- Optional "night theme" for renderer

### Widget Preview Mode

- In Widgets tab: "Preview" opens a sandboxed preview frame
- Uses staged config, pulls staged data (cache or one-shot fetch)
- Does not enable on main display until saved

### Remote Config Sync (Optional)

- **Push**: Admin exports a signed config bundle; remote tool pushes to Pi over LAN
- **Pull**: Pi periodically checks a known URL for updates (with auth token)
- Must be atomic + versioned to avoid bricking the display

### Crash Analytics (Local)

**Record:**
- `widgetId`, `tier`, `timestamp`, `exit code`, last logs snippet, restart count

**Store as:**
- jsonl in `/opt/pi-dashboard/state/crashlog/events.jsonl` (simple)
- or SQLite for querying in admin

**Display:** Overview tab shows "last 24h crashes" and top offenders

### Config Versioning & Rollback

- Keep last N snapshots of `config.json` + canvas templates: `/opt/pi-dashboard/state/config-backups/<timestamp>.json`
- Admin UI: list snapshots, diff summary, one-click rollback (atomic apply + restart)

### Config Migration

- `config.json` includes `"configVersion": 1`
- On core update, migration runner transforms old configs to new schema
- Migration scripts stored in update bundles

### Admin Hotkeys & Theme

- Hotkeys: save, search widget, toggle maintenance mode (guarded)
- Dark/light theme stored in browser local storage + optional server preference

### Pi-Specific Optimizations

- GPU memory split recommendation UI: warn if too high on 512MB
- Suggest Cog/WPE on Zero 2W; allow Chromium on Pi 4+
- Optional "performance mode":
  - Reduce polling rates
  - Cap FPS in renderer
  - Disable animations
- Optional overclock UI (advanced, guarded with warnings)

### Widget Development Experience

- `fswatch` on widget directory → Bun sends WebSocket `reload` → kiosk reloads affected widget (not whole page)
- Future: `create-widget` CLI scaffold tool
- Future: widget template repository + developer documentation

---

## Summary

| Layer | Tech | Job | RAM (Pi Zero 2W) |
|:---|:---|:---|:---|
| OS | DietPi 32-bit | Foundation | ~40 MB |
| Compositor + Server | Bun | Display compositor + admin API + Tier 1b data fetching | ~40–80 MB |
| Display | WPE WebKit (Cog) | Render single composed page (all widgets in one HTML) | ~60–100 MB |
| Tier 1a widgets | HTML/CSS/JS | Client-only: clock, slideshow, video, timers | **~0 MB** (runs in kiosk) |
| Tier 1b widgets | Bun fetch | Weather, RSS, stocks (JSON cached in tmpfs) | ~0.5–3 MB each |
| Tier 2 daemons | Go / Rust | MPD, sysinfo, GPIO, camera (write JSON to tmpfs) | ~15–40 MB total |
| Networking | OS | Wi-Fi / BT / SSH | ~15 MB |
| Video decode | Hardware | H.264 via Pi GPU | ~40–60 MB |
| IPC | tmpfs | `/tmp/widgets/*.json` — RAM-based data pipeline | ~2 MB |
| **Total** | | | **~212–337 MB** |
| **Free headroom** | | | **~175–300 MB** |