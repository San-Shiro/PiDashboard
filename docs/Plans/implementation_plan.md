# PiDashboard: From UI Draft to Production Architecture

## Locked-In Decisions

| Decision | Choice | Rationale |
|:---|:---|:---|
| Admin panel tech | React + Tailwind (pre-built static bundle) | Runs on phone/laptop, zero Pi cost. Pre-built = no build tools on Pi |
| Display page tech | Bun-composed vanilla HTML + vanilla JS | Runs on Pi kiosk. ~5KB JS vs ~300KB React bundle |
| Editing model | **Draft → Publish** | Admin edits client-side only. Pi sees nothing until "Save & Publish" |
| WebSocket protocol | 3 message types: `data`, `reload`, `maintenance` | Minimal — ~1 message every 5s during normal operation |
| Canvas storage | JSON files on disk, HTML composed on-the-fly per request | Not baked to static HTML files |
| Maintenance mode | Static HTML page, all polling/daemons paused | Near-zero resource usage |

---

## Background

The existing [UI-Draft1](file:///f:/VSCodium/Github/PiDashboard/src-anything/UI-Draft1) is a fully functional prototype with:

- ✅ Working admin panel (Overview, Widgets, Layout, Canvases, Media, Themes, System, Marketplace, Docs tabs)
- ✅ Working kiosk display page at `/display` with auto-scaling canvas
- ✅ Drag-and-drop layout editor with move/resize/z-index/opacity
- ✅ Manifest-driven config panel (`ManifestField` renders any `configSchema` type)
- ✅ Canvas/template system with resolution presets and save/load/apply
- ✅ Widget renderers (Clock, Weather, Lyrics, Sysinfo, Automation, Image)
- ✅ Theme system with dark/light toggle and CSS variables
- ✅ Auth gate with login/lock screen

**What's missing:** All APIs are dummy/scaffold. No real backend, no tmpfs IPC, no fragment system, no systemd integration, no logging.

---

## Core Architecture: Draft → Publish Model

### During Admin Editing (Zero Pi Cost)

```
Phone/Laptop (React admin)                  Pi (Bun server)
┌─────────────────────────┐                ┌──────────────┐
│ Drag widgets around     │                │              │
│ Change configs          │   NOTHING →    │  Idle         │
│ Preview in React canvas │                │  (0% CPU)    │
│ All local state         │                │              │
└─────────────────────────┘                └──────────────┘
```

### On "Save & Publish" (One Burst)

```
Phone clicks "Publish"
  → POST /api/canvas/publish {full canvas JSON}           ~1ms network
  → Bun writes canvases/active.json                       ~1ms disk
  → Bun recomposes display HTML from fragments             ~5ms CPU
  → WebSocket → kiosk: {type:"reload"}                    ~0.1ms
  → Kiosk reloads page with new layout                    ~200ms render
  → Done. Total Pi work: ~7ms
```

### Normal Operation (Minimal Load)

```
Bun Tier 1b scheduler
  → fetch weather API every 10 min → write /tmp/widgets/weather.json
  → fs.watch detects change
  → WebSocket → kiosk: {type:"data", widget:"weather", data:{...}}
  → Kiosk JS: el.textContent = "32°C"                    ~0.1ms

Tier 2 daemon (sysinfo)
  → writes /tmp/widgets/sysinfo.json every 5s
  → same WebSocket pipeline
```

### WebSocket Protocol (Complete — 3 message types)

```
Bun → Kiosk:
  {type: "data",        widget: "weather", data: {temp:32, ...}}
  {type: "reload"}
  {type: "maintenance", enabled: true|false}

Kiosk → Bun:
  (nothing — kiosk is receive-only)
```

### Maintenance Mode

```
Admin toggles "Enter Maintenance"
  → POST /api/system/state {maintenance_mode: true}
  → Bun pauses all Tier 1b fetches
  → Bun optionally stops Tier 2 daemons (via systemctl)
  → WebSocket → kiosk: {type:"maintenance", enabled:true}
  → Kiosk replaces page with static maintenance screen
  → RAM freed: ~10-30MB (no widget data caching, no DOM complexity)

Admin clicks "Resume Display"
  → Reverse: restart fetches/daemons, send {maintenance: false}
  → Kiosk reloads composed page
```

---

## Gap Analysis: UI Draft vs Production

| Feature | UI Draft Status | Production Spec | Gap |
|:---|:---|:---|:---|
| Widget renderers | Hardcoded in `widget-renderers.jsx` | Fragment HTML per widget package | Need fragment system |
| Widget data | `useWidgetData` polls `/api/widget-data/:name` | tmpfs JSON + WebSocket push | Need real pipeline |
| Manifest system | `manifest-field.jsx` renders `configSchema` ✅ | Full `manifest.json` per widget | Needs `entrypoints`, `tier`, `runner` |
| Canvas/Templates | Working save/load/apply via dummy API | File-based at `canvases/` | Need file-based storage |
| Layout editor | Drag-drop with resize, z-index, schedule ✅ | Same spec | ✅ Aligned |
| System stats | Polls dummy `/api/system/stats` | Read `/proc` directly (Phase 1) | Need real implementation |
| Service management | Polls dummy `/api/system/services` | `systemctl` integration | Need real implementation |
| Auth | Dummy cookie login | Argon2 hash + signed cookie | Need real implementation |
| Media manager | Dummy upload/browse/delete | File-based at `media/` | Need real file I/O |
| Theme system | CSS variables + dark/light ✅ | Bonus feature | ✅ Keep as-is |
| Display page | React SPA at `/display` | Bun-composed vanilla HTML | Needs full rework |
| WebSocket | Not implemented (uses polling) | 3-type protocol | Core new feature |
| Fragment injection | Not implemented | Bun reads `fragment/*.html` | Core new feature |
| Logging | Not implemented | Structured logging + crash analytics | Core new feature |
| Error handling | Basic try/catch | Tiered error system with recovery | Core new feature |

---

## Proposed Changes

### Phase A: Project Restructure & Directory Layout

#### [NEW] Production directory structure

```
f:\VSCodium\Github\PiDashboard\
├── docs/                          # Existing docs (keep)
├── src-anything/UI-Draft1/        # Original draft (keep as reference, do not modify)
│
├── core/
│   └── server/                    # Bun server — THE single process on the Pi
│       ├── index.ts               # Entry point: HTTP server + WebSocket + tmpfs watcher
│       ├── api/
│       │   ├── widgets.ts         # Widget registry, instances, config
│       │   ├── canvas.ts          # Canvas save/load/publish/delete
│       │   ├── media.ts           # File upload/list/delete
│       │   ├── system.ts          # System stats, services, state, maintenance
│       │   └── auth.ts            # Login/logout/session with argon2
│       ├── compositor/
│       │   └── compose.ts         # Read canvas JSON + fragments → single HTML response
│       ├── ws/
│       │   └── display.ts         # WebSocket server for kiosk connections
│       ├── ipc/
│       │   └── tmpfs-watcher.ts   # fs.watch on /tmp/widgets/*.json → push via WS
│       ├── fetch/
│       │   └── scheduler.ts       # Tier 1b fetch scheduler (runs fetch modules on interval)
│       ├── config/
│       │   └── manager.ts         # Read/write config.json, canvas JSONs, platform.json
│       ├── logging/
│       │   ├── logger.ts          # Structured logger (levels, rotation, categories)
│       │   └── crash-recorder.ts  # Crash/error event persistence
│       ├── errors/
│       │   └── handler.ts         # Global error handler, recovery strategies
│       └── package.json           # Bun-only deps: argon2, ws (minimal)
│
├── admin/                         # React admin panel (builds to static)
│   ├── src/
│   │   ├── App.jsx                # Simplified main (no __create scaffold)
│   │   ├── main.tsx               # ReactDOM.createRoot entry
│   │   ├── components/dashboard/  # Extracted from UI-Draft1 (same components)
│   │   └── index.css
│   ├── dist/                      # Built output → served by Bun as static files
│   ├── package.json               # Pruned: React, TanStack Query, Lucide, Tailwind, recharts
│   └── vite.config.ts
│
├── widgets/
│   ├── _base/
│   │   └── manifest.schema.json   # Canonical manifest schema
│   ├── clock/                     # Tier 1a — client-only
│   │   ├── manifest.json
│   │   └── fragment/
│   │       └── clock.html         # Self-contained HTML+CSS+JS snippet
│   ├── weather/                   # Tier 1b — Bun-fetched
│   │   ├── manifest.json
│   │   ├── fetch/weather.ts       # Fetch module loaded by Bun scheduler
│   │   └── fragment/
│   │       └── weather.html
│   ├── sysinfo/                   # Tier 2 — daemon (Go/Rust, future)
│   │   ├── manifest.json
│   │   ├── daemon/src/
│   │   └── fragment/
│   │       └── sysinfo.html
│   ├── music-player/
│   ├── image/
│   └── automation/
│
├── config/
│   ├── config.json                # Global: enabled widgets, secrets refs, settings
│   └── platform.json              # Auto-detected hardware profile
│
├── canvases/
│   ├── active.json                # Currently published canvas (source of truth for display)
│   └── saved/
│       ├── default.json           # Default canvas (ships with install)
│       ├── morning.json
│       └── night.json
│
├── media/
│   └── uploads/                   # User-uploaded images, videos, fonts
│
├── state/
│   ├── cache/                     # Last-known-good JSON per widget
│   ├── logs/                      # Application logs (rotated)
│   │   ├── server.log             # Main server log
│   │   ├── error.log              # Errors only (separate for quick scanning)
│   │   └── access.log             # HTTP request log (optional, off by default)
│   ├── crashlog/
│   │   └── events.jsonl           # Crash analytics events
│   └── config-backups/            # Auto-snapshots before config changes
│
├── secrets/
│   ├── admin.passhash             # Argon2 hash of admin password
│   └── widget-secrets.json        # API keys (weather, etc.)
│
├── installer/
│   ├── install.sh
│   ├── uninstall.sh
│   └── systemd/
│       ├── pi-dashboard.service
│       └── pi-dashboard-kiosk.service
│
└── package.json                   # Root workspace config
```

---

### Phase B: Bun Backend Server

#### [NEW] `core/server/index.ts`

Bun HTTP + WebSocket server. Single entry point:

```
Bun.serve({
  port: 3000,
  fetch(req) {
    /display/main    → compositor.compose(activeCanvas)  // composed HTML
    /api/*           → route to api handlers
    /media/*         → static file serve from media/uploads/
    /*               → static file serve from admin/dist/
  },
  websocket: {
    open(ws)    → register kiosk connection
    close(ws)   → unregister
    message()   → (kiosk sends nothing)
  }
})
```

#### [NEW] `core/server/api/canvas.ts`

```
GET    /api/canvas/active          → read canvases/active.json
GET    /api/canvas/saved           → list canvases/saved/*.json
POST   /api/canvas/publish         → write active.json + notify kiosk reload
POST   /api/canvas/save            → save named canvas to saved/
DELETE /api/canvas/saved/:name     → delete saved canvas
```

**Publish flow:**
1. Validate incoming canvas JSON against schema
2. Auto-snapshot current active.json to `state/config-backups/`
3. Write new active.json atomically (write to .tmp, rename)
4. Send `{type:"reload"}` to all connected kiosk WebSockets
5. Log: `[canvas] Published canvas "morning" (6 widgets, 1280×720)`

#### [NEW] `core/server/api/widgets.ts`

```
GET    /api/widgets/registry       → scan widgets/*/manifest.json
GET    /api/widget-data/:id        → read /tmp/widgets/<id>.json (for admin preview)
```

#### [NEW] `core/server/api/system.ts`

Real system stats by reading `/proc` directly (no daemon needed for Phase 1):

```typescript
// /proc/meminfo → RAM
// /proc/stat → CPU percentage (diff between reads)
// /sys/class/thermal/thermal_zone0/temp → CPU temp
// /proc/uptime → uptime
// systemctl list-units --type=service --output=json → services
```

#### [NEW] `core/server/api/auth.ts`

```
POST   /api/auth/login             → verify password against argon2 hash
POST   /api/auth/logout            → clear session cookie
GET    /api/auth/status            → check session validity
POST   /api/auth/setup             → first-run password setup
```

#### [NEW] `core/server/api/media.ts`

```
GET    /api/media                  → list files with metadata
POST   /api/media/upload           → multipart upload → media/uploads/
DELETE /api/media/:filename        → delete (with reference check against active canvas)
```

#### [NEW] `core/server/compositor/compose.ts`

The core compositor:

```
Input:  canvases/active.json + widgets/*/fragment/*.html
Output: Single HTML page string

Steps:
1. Read active canvas JSON (widget list + positions + configs)
2. For each widget in canvas:
   a. Read widgets/<id>/fragment/<entrypoint>.html
   b. Wrap in: <div data-widget="<id>" data-config='<json>'
              style="position:absolute; left:Xpx; top:Ypx; width:Wpx; height:Hpx;
                     z-index:Z; opacity:O;">
              <fragment HTML here>
              </div>
3. Wrap all in canvas container with background color + dimensions
4. Inject WebSocket client script (~2KB, hardcoded in compositor)
5. Inject maintenance mode handler
6. Return complete HTML string
```

#### [NEW] `core/server/ws/display.ts`

WebSocket server for kiosk connections:

```typescript
// Connection registry
const kiosks = new Set<WebSocket>();

// Called by tmpfs watcher when widget data changes
export function pushData(widgetId: string, data: object) {
  const msg = JSON.stringify({ type: "data", widget: widgetId, data });
  for (const ws of kiosks) ws.send(msg);
}

// Called by canvas.ts on publish
export function pushReload() {
  const msg = JSON.stringify({ type: "reload" });
  for (const ws of kiosks) ws.send(msg);
}

// Called by system.ts on maintenance toggle
export function pushMaintenance(enabled: boolean) {
  const msg = JSON.stringify({ type: "maintenance", enabled });
  for (const ws of kiosks) ws.send(msg);
}
```

#### [NEW] `core/server/ipc/tmpfs-watcher.ts`

```typescript
import { watch } from "fs";

// Watch /tmp/widgets/ for JSON changes
watch("/tmp/widgets/", (event, filename) => {
  if (!filename?.endsWith(".json")) return;
  const widgetId = filename.replace(".json", "");
  try {
    const data = JSON.parse(readFileSync(`/tmp/widgets/${filename}`, "utf8"));
    // Update last-known-good cache
    writeFileSync(`state/cache/${filename}`, JSON.stringify(data));
    // Push to kiosk
    pushData(widgetId, data);
    logger.debug(`[ipc] ${widgetId} data updated`);
  } catch (e) {
    logger.warn(`[ipc] Failed to read ${filename}: ${e.message}`);
    // Serve cached data — never blank the widget
  }
});
```

#### [NEW] `core/server/fetch/scheduler.ts`

Tier 1b fetch scheduler:

```typescript
// For each enabled Tier 1b widget:
// 1. Load its fetch module: widgets/<id>/fetch/<module>.ts
// 2. Call fetchData(config) on the manifest's pollIntervalSec
// 3. Write result to /tmp/widgets/<id>.json
// 4. Handle errors: backoff, cache last-known-good, log

const timers = new Map<string, Timer>();

export function startFetcher(widgetId: string, manifest: Manifest, config: object) {
  const mod = require(`../../widgets/${widgetId}/${manifest.entrypoints.fetchModule}`);
  const interval = manifest.polling.pollIntervalSec * 1000;
  
  async function tick() {
    try {
      const data = await mod.fetchData(config);
      writeFileSync(`/tmp/widgets/${widgetId}.json`, JSON.stringify(data));
      logger.debug(`[fetch] ${widgetId} updated`);
    } catch (e) {
      logger.warn(`[fetch] ${widgetId} failed: ${e.message}`);
      // Backoff logic, use cached data
    }
  }
  
  tick(); // immediate first fetch
  timers.set(widgetId, setInterval(tick, interval));
}

export function stopFetcher(widgetId: string) {
  clearInterval(timers.get(widgetId));
  timers.delete(widgetId);
}

export function pauseAll() { /* maintenance mode */ }
export function resumeAll() { /* exit maintenance */ }
```

---

### Phase C: Admin Panel Extraction

#### [MODIFY] Extract from UI-Draft1

Copy and clean these files:

| Source (UI-Draft1) | Destination | Changes |
|:---|:---|:---|
| `components/dashboard/*` | `admin/src/components/dashboard/` | Remove `__create` imports |
| `app/page.jsx` | `admin/src/App.jsx` | Remove SessionProvider, simplify to `ReactDOM.createRoot` |
| `app/display/page.jsx` | **Do not copy** — replaced by Bun compositor | — |
| `app/root.tsx` | **Do not copy** — scaffold artifact | — |
| `app/routes.ts` | **Do not copy** — replace with simple Vite SPA | — |
| `app/api/*` | **Do not copy** — replaced by Bun API handlers | — |

**Dependency pruning** — `package.json` goes from ~40 to ~12 deps:

```
Keep:     react, react-dom, @tanstack/react-query, lucide-react,
          tailwind-merge, recharts, react-colorful, zustand
Remove:   stripe, three, papaparse, pdfjs-dist, @vis.gl/react-google-maps,
          @neondatabase/serverless, @auth/core, @hono/auth-js, @chakra-ui/react,
          @emotion/*, cmdk, downshift, html-to-image, motion, vaul, ws,
          react-router, react-router-dom, react-router-hono-server, yup,
          styled-jsx, sonner, react-markdown, react-day-picker, react-hook-form,
          react-idle-timer, react-resizable-panels, @dnd-kit/*
```

**API base URL**: Configurable for remote access:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || "";
// Dev: VITE_API_URL=http://192.168.1.50:3000
// Prod: empty (same origin, served by Bun)
```

**Build output**: `npm run build` → `admin/dist/` → copy to Pi during install.

---

### Phase D: Widget Fragment System

#### [NEW] Widget fragment architecture

Each widget fragment is a self-contained HTML file. It does NOT know about React, Tailwind, or any framework. It uses raw DOM APIs.

**Pattern for Tier 1a (client-only, e.g., clock):**

```html
<!-- widgets/clock/fragment/clock.html -->
<style>
  [data-widget="clock"] .time { font-size: 64px; font-weight: 700; font-family: ui-monospace, monospace; }
  [data-widget="clock"] .date { font-size: 14px; opacity: 0.6; margin-top: 6px; }
</style>
<div class="time"></div>
<div class="date"></div>
<script>
(function() {
  const root = document.currentScript.closest('[data-widget]');
  const cfg = JSON.parse(root.dataset.config || '{}');
  const timeEl = root.querySelector('.time');
  const dateEl = root.querySelector('.date');
  
  function tick() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
      second: cfg.showSeconds ? '2-digit' : undefined,
      hour12: cfg.format === '12h'
    });
    if (cfg.showDate) {
      dateEl.textContent = now.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
    }
  }
  tick();
  setInterval(tick, 1000);
})();
</script>
```

**Pattern for Tier 1b (Bun-fetched, e.g., weather):**

```html
<!-- widgets/weather/fragment/weather.html -->
<style>
  [data-widget="weather"] .temp { font-size: 36px; font-weight: 700; }
  [data-widget="weather"] .condition { font-size: 13px; opacity: 0.8; margin-top: 8px; }
</style>
<div class="temp">--°</div>
<div class="condition">Loading...</div>
<script>
(function() {
  const root = document.currentScript.closest('[data-widget]');
  const cfg = JSON.parse(root.dataset.config || '{}');
  
  // Register updater — called by WebSocket listener when data arrives
  window.__widgetUpdaters = window.__widgetUpdaters || {};
  window.__widgetUpdaters[root.dataset.widget] = function(data) {
    const unit = cfg.units === 'imperial' ? 'F' : 'C';
    root.querySelector('.temp').textContent = data.temp + '°' + unit;
    root.querySelector('.condition').textContent = data.condition;
  };
})();
</script>
```

**WebSocket client (injected by compositor into every display page):**

```javascript
// ~2KB — the ONLY JavaScript the compositor adds
(function() {
  const WS_URL = 'ws://' + location.host + '/ws/display';
  let ws;
  
  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onmessage = function(event) {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'data') {
        const updater = window.__widgetUpdaters && window.__widgetUpdaters[msg.widget];
        if (updater) updater(msg.data);
      }
      
      if (msg.type === 'reload') {
        location.reload();
      }
      
      if (msg.type === 'maintenance') {
        if (msg.enabled) {
          document.getElementById('canvas').style.display = 'none';
          document.getElementById('maintenance').style.display = 'flex';
        } else {
          location.reload();
        }
      }
    };
    ws.onclose = function() { setTimeout(connect, 3000); };
    ws.onerror = function() { ws.close(); };
  }
  connect();
})();
```

---

### Phase E: Data Pipeline

#### Tier 1a (Client-only) — Clock, Image, Video, Countdown
```
Fragment JS runs in browser → setInterval / <img> / <video>
No server involvement. No JSON. No WebSocket.
```

#### Tier 1b (Bun-fetched) — Weather, RSS, Stocks, Calendar
```
Bun scheduler calls fetch module every N seconds
  → writes /tmp/widgets/<id>.json
  → fs.watch fires → WebSocket push to kiosk
  → kiosk JS calls widget updater function
```

#### Tier 2 (Daemon) — Sysinfo, MPD, GPIO
```
External daemon writes /tmp/widgets/<id>.json
  → same fs.watch → WebSocket pipeline as Tier 1b
```

---

### Phase F: Logging & Error Handling System

#### [NEW] `core/server/logging/logger.ts`

Structured, lightweight logging system designed for Pi constraints:

**Log Levels:**

| Level | Use | Where |
|:---|:---|:---|
| `ERROR` | Unrecoverable failures, crashes | `state/logs/error.log` + `server.log` |
| `WARN` | Recoverable issues (fetch timeout, stale cache used) | `server.log` |
| `INFO` | Significant events (canvas published, widget added, auth login) | `server.log` |
| `DEBUG` | Verbose tracing (every fetch tick, every WS message) | `server.log` (only if enabled) |

**Log Categories (prefixed):**

```
[server]    HTTP server lifecycle, port binding, shutdown
[api]       API request handling, validation errors
[canvas]    Canvas publish, switch, save, delete
[fetch]     Tier 1b fetch scheduler ticks, errors, backoff
[ipc]       tmpfs watcher events, JSON parse errors
[ws]        WebSocket connections, disconnections, message sends
[auth]      Login attempts (success/failure), session expiry
[media]     File uploads, deletes, orphan cleanup
[system]    System stats collection, service management
[widget]    Widget enable/disable, manifest validation
[daemon]    Tier 2 daemon start/stop/crash (from systemd journal)
```

**Log Format:**

```
2026-05-28T18:30:00.123Z [INFO]  [canvas]  Published "morning" (6 widgets, 1280×720)
2026-05-28T18:30:05.456Z [WARN]  [fetch]   weather: API timeout after 4000ms, using cached data
2026-05-28T18:30:10.789Z [ERROR] [daemon]   sysinfo: process exited with code 1, restarting in 2s
2026-05-28T18:35:00.000Z [DEBUG] [ipc]     weather.json updated (324 bytes)
```

**Log Rotation:**

```
- server.log:  max 5MB, keep last 3 files (server.log, server.1.log, server.2.log)
- error.log:   max 2MB, keep last 5 files
- access.log:  max 10MB, keep last 2 files (disabled by default)
- Total max disk: ~45MB worst case
```

**Implementation (zero-dependency, pure Bun):**

```typescript
// No external logging library — just file writes with rotation
const LOG_DIR = "/opt/pi-dashboard/state/logs";

enum Level { ERROR = 0, WARN = 1, INFO = 2, DEBUG = 3 }

class Logger {
  private level: Level;
  private serverFd: number;
  private errorFd: number;
  private serverSize: number = 0;
  
  constructor(level: Level = Level.INFO) {
    this.level = level;
    // Open file descriptors at startup — keep them open (no per-write open/close)
  }
  
  private write(level: Level, category: string, message: string, meta?: object) {
    const line = `${new Date().toISOString()} [${Level[level].padEnd(5)}] [${category.padEnd(8)}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}\n`;
    
    // Write to server.log
    Bun.write(this.serverFd, line);
    this.serverSize += line.length;
    
    // Also write to error.log if ERROR
    if (level === Level.ERROR) {
      Bun.write(this.errorFd, line);
    }
    
    // Check rotation
    if (this.serverSize > 5 * 1024 * 1024) this.rotate("server");
  }
  
  error(category: string, msg: string, meta?: object) { this.write(Level.ERROR, category, msg, meta); }
  warn(category: string, msg: string, meta?: object)  { this.write(Level.WARN, category, msg, meta); }
  info(category: string, msg: string, meta?: object)   { this.write(Level.INFO, category, msg, meta); }
  debug(category: string, msg: string, meta?: object)  { if (this.level >= Level.DEBUG) this.write(Level.DEBUG, category, msg, meta); }
}

export const logger = new Logger(Level.INFO);
```

**Config in `config.json`:**

```json
{
  "logging": {
    "level": "info",
    "enableAccessLog": false,
    "maxFileSizeMB": 5,
    "maxRotatedFiles": 3
  }
}
```

#### [NEW] `core/server/logging/crash-recorder.ts`

Persistent crash analytics (JSONL):

```typescript
// state/crashlog/events.jsonl — one JSON object per line
interface CrashEvent {
  timestamp: string;
  source: "server" | "fetch" | "daemon" | "compositor" | "websocket";
  widgetId?: string;
  tier?: "1a" | "1b" | "2";
  error: string;
  stack?: string;
  exitCode?: number;
  restartCount: number;
  resolved: boolean;
}

// Append-only — never rewrite the file
function recordCrash(event: CrashEvent) {
  appendFileSync("state/crashlog/events.jsonl", JSON.stringify(event) + "\n");
  logger.error(event.source, `Crash: ${event.error}`, { widgetId: event.widgetId });
}

// API for admin Overview tab
function getRecentCrashes(hours: number = 24): CrashEvent[] {
  // Read last N lines, filter by timestamp
}

function getCrashStats(): { total24h: number; topOffenders: {widgetId: string, count: number}[] } {
  // Aggregate for dashboard display
}
```

#### [NEW] `core/server/errors/handler.ts`

Tiered error handling with recovery strategies:

**Error Tiers:**

| Tier | Example | Recovery | Log Level |
|:---|:---|:---|:---|
| **Recoverable** | Weather API timeout | Use cached data, backoff, retry | WARN |
| **Widget-fatal** | Fetch module throws, daemon crashes | Disable widget, show fallback, restart daemon | ERROR |
| **Server-degraded** | tmpfs full, disk write failure | Reduce logging, alert admin via WS | ERROR |
| **Server-fatal** | Port bind failure, config corrupt | Log, exit (systemd restarts) | ERROR |

**Recovery strategies:**

```typescript
// Tier 1b fetch failure
function handleFetchError(widgetId: string, error: Error, attempt: number) {
  const backoff = Math.min(1800, 30 * Math.pow(2, attempt)); // 30s, 60s, 120s... max 30min
  logger.warn("fetch", `${widgetId} failed (attempt ${attempt}), retry in ${backoff}s`, {
    error: error.message
  });
  
  // Serve cached data to kiosk (never blank a widget)
  const cached = readCachedData(widgetId);
  if (cached) pushData(widgetId, { ...cached, _stale: true });
  
  // Record crash if repeated
  if (attempt >= 3) {
    recordCrash({
      source: "fetch", widgetId, tier: "1b",
      error: error.message, restartCount: attempt, resolved: false
    });
  }
  
  // Schedule retry with backoff
  setTimeout(() => fetchTick(widgetId), backoff * 1000);
}

// Tier 2 daemon crash
function handleDaemonCrash(widgetId: string, exitCode: number) {
  logger.error("daemon", `${widgetId} exited with code ${exitCode}`);
  recordCrash({
    source: "daemon", widgetId, tier: "2",
    error: `Exit code ${exitCode}`, exitCode, restartCount: 0, resolved: false
  });
  // systemd handles restart (Restart=on-failure, RestartSec=2)
  // After 5 rapid crashes, systemd stops the unit — admin sees it in Overview tab
}

// Uncaught server error
process.on("uncaughtException", (error) => {
  logger.error("server", `Uncaught: ${error.message}`, { stack: error.stack });
  recordCrash({ source: "server", error: error.message, stack: error.stack, restartCount: 0, resolved: false });
  // DO NOT exit — let Bun keep running. Only exit for truly fatal errors.
});

process.on("unhandledRejection", (reason) => {
  logger.error("server", `Unhandled rejection: ${String(reason)}`);
});
```

**Admin API for crash data:**

```
GET /api/system/crashes              → recent crashes (last 24h)
GET /api/system/crashes/stats        → aggregated crash stats for Overview tab
```

**Admin Overview tab integration:**
- "Last 24h crashes" counter with top offenders list
- Per-widget health indicator (green/yellow/red based on recent crash frequency)
- Click-to-view crash details with timestamp, error, stack trace

#### Error handling in API routes

Every API handler wrapped with consistent error responses:

```typescript
function apiHandler(handler: Function) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      logger.error("api", `${req.method} ${req.url}: ${error.message}`);
      return Response.json(
        { error: error.message, code: error.code || "INTERNAL_ERROR" },
        { status: error.status || 500 }
      );
    }
  };
}
```

**Standard error codes:**

| Code | Status | When |
|:---|:---|:---|
| `AUTH_REQUIRED` | 401 | No session cookie or expired |
| `AUTH_INVALID` | 401 | Wrong password |
| `NOT_FOUND` | 404 | Canvas/widget/media not found |
| `VALIDATION_ERROR` | 400 | Invalid manifest, bad canvas JSON |
| `CONFLICT` | 409 | Media file referenced by active canvas |
| `DISK_FULL` | 507 | Cannot write (tmpfs or disk full) |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Verification Plan

### Automated Tests

1. **Server API tests** (`bun test`):
   - Canvas CRUD (save, load, publish, delete)
   - Widget registry scanning
   - Auth flow (login, session check, logout)
   - Media upload/delete with reference protection
   - System stats parsing (mock `/proc` files)
   
2. **Admin build** (`npm run build`):
   - Verify clean build with no errors
   - Check bundle size < 500KB gzipped

3. **Widget manifest validation**:
   - All shipped widgets pass schema validation
   - Missing required fields rejected
   - Invalid tier/runner combos rejected

4. **Compositor tests**:
   - Compose with 0 widgets → valid HTML with empty canvas
   - Compose with 6 widgets → all fragments injected
   - WebSocket client script present in output
   - Maintenance overlay div present

### Manual Verification

1. Start Bun server → open admin in browser → all tabs functional
2. Create canvas with 3 widgets → publish → display page shows them
3. Edit canvas (move widgets) → publish again → display updates
4. Toggle maintenance mode → display shows maintenance screen
5. Check `state/logs/server.log` → proper structured log entries
6. Kill a fetch module → verify cached data served, error logged, crash recorded
7. View Overview tab → crash stats visible

### Integration Test (on Pi)

1. `install.sh` → all services start, kiosk opens display
2. Admin accessible from phone browser over WiFi
3. Real `/proc` stats in Overview tab
4. Weather widget fetches real data (with API key)
5. Canvas publish from phone → kiosk updates within 1 second
6. Logs rotating properly, not filling SD card
