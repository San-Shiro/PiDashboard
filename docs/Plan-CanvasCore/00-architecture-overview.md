# Canvas Config Engine: Robust Architecture (v4)

## Background

We are rebuilding the canvas config engine from the ground up. All existing widgets will be deleted. The goal is a **rock-solid foundation** that handles complex multi-layer dashboards with animations, live data feeds, interactive controls, and community-contributed widgets — all running safely on a Pi Zero 2W with 512MB RAM.

---

## Part 1: Widget Tier System

### Execution Tiers (How data flows)

| Tier | Name | Update Frequency | Data Source | Examples |
|:---|:---|:---|:---|:---|
| `static` | **Static** | Never (config at load only) | None | Image, text overlay, decorative CSS animation |
| `pull` | **Pull** | Seconds to minutes | Bun fetch module → IPC file | Weather (5min), RSS (10min), stocks (30s), calendar (1hr) |
| `push` | **Push** | ~1–10 updates/sec | External daemon → IPC file → WS | Sysinfo (2s), MPD now-playing (1s), live lyrics (line-change ~1-3s), GPIO state |
| `stream` | **Stream** | 30–60fps | Named pipe or dedicated WS channel | Audio FFT visualizer, live camera feed, waveform display |

#### Why lyrics and media player are `push`, not `stream`

The distinction is **update frequency**, not importance:

- **Live lyrics**: Text changes when the song line changes — every 2-5 seconds. That's ~0.2-0.5 writes/sec to IPC. `push` handles this trivially.
- **Media player** (now-playing, progress bar): Updates ~1/sec for the progress position, plus instant events on play/pause/skip. Still well within `push` territory.
- **Audio visualizer**: Needs FFT spectrum data at 30-60fps — that's 30-60 JSON writes/sec. File I/O can't keep up, hence `stream` uses a direct WebSocket channel.

**Rule of thumb:** If your data updates ≤10 times/sec → `push`. If it needs real-time frame-rate data → `stream`.

### IPC Reliability Analysis

> "Is IPC read/write reliable when many widgets update per second?"

**tmpfs throughput on Pi Zero 2W:**

| Operation | Throughput | Notes |
|:---|:---|:---|
| tmpfs file write (1KB JSON) | ~50,000 writes/sec | RAM-backed, no disk I/O |
| `fs.watch` event delivery | ~100-500 events/sec | OS-dependent, Linux inotify is fast |
| JSON.parse (1KB) | ~200,000/sec | V8 is very fast at this |
| WebSocket broadcast (10 clients) | ~10,000 msgs/sec | Bun's WS is native C++ |

**Bottleneck:** `fs.watch` with 100ms debounce. Currently, if 10 widgets each write 1/sec, that's 10 file changes/sec. After debounce, that's 10 callbacks/sec — **no problem at all**.

**Stress scenario:** 20 widgets each writing every 500ms = 40 writes/sec. Still fine. The debouncer collapses rapid writes to the *same* file, not across files. Each widget's file has its own debounce timer.

**Where IPC breaks down:** 

| Scenario | Writes/sec | IPC viable? | Solution |
|:---|:---|:---|:---|
| 5 push widgets at 1/sec | 5 | ✅ Trivial | — |
| 15 push widgets at 2/sec | 30 | ✅ Fine | — |
| 1 audio visualizer at 30fps | 30 | ⚠️ Marginal | Use `stream` tier (direct WS) |
| 1 audio viz + 1 camera at 60fps | 90 | ❌ Too much for file I/O | `stream` tier required |

**Conclusion:** IPC via tmpfs is reliable for all realistic `push` workloads. The `stream` tier exists specifically for the cases where file I/O isn't fast enough.

#### Future optimization (not v1)

If we ever hit IPC limits with many `push` widgets, we can switch from file-per-widget to a **single Unix domain socket** where all daemons send JSON frames. Bun reads one socket instead of watching N files. But this is premature optimization — file-per-widget works fine for the foreseeable future.

---

## Part 2: Interactive Widgets

> This was a critical gap in v1-v3. Widgets aren't just display surfaces — some accept user input.

### Use Cases

| Widget | Interaction | State Persistence |
|:---|:---|:---|
| **Music player** | Play/pause/seek/skip buttons, volume slider | No — controls send commands to MPD daemon, state reflects in next push update |
| **Quick tasks / notepad** | Text input, checkboxes | **Yes** — typed notes must survive restarts |
| **Home automation** | Toggle switches (lights on/off) | No — toggles send commands to automation daemon, state reflects back |
| **Timer / stopwatch** | Start/stop/reset buttons | Optional — nice if timer survives accidental page reload |
| **Photo slideshow** | Next/prev, pause | No — navigation state is ephemeral |

### Architecture: The Uplink Channel

Interactive widgets need a **bidirectional** data path:

```
                    DOWNLINK (data TO widget)
Daemon → IPC file → Bun fs.watch → WebSocket → Widget renders state
                    
                    UPLINK (commands FROM widget)
Widget button click → PiWidget.sendCommand() → WebSocket → Bun server
  → Route to handler → Write command to daemon's IPC command file
  → OR call daemon's REST API
  → OR write to a shared command queue
```

#### PiWidget SDK Additions

```javascript
// In the SDK
PiWidget = {
  // ... existing register, _dispatch, _startFrameLoop ...
  
  // NEW: Send a command from widget to server
  sendCommand: function(widgetType, action, payload) {
    if (window.__piWs && window.__piWs.readyState === 1) {
      window.__piWs.send(JSON.stringify({
        type: 'widget_command',
        widget: widgetType,
        action: action,      // e.g. "play", "pause", "seek", "toggle"
        payload: payload     // e.g. { position: 0.75 } for seek
      }));
    }
  },
  
  // NEW: Persist widget state (survives restarts)
  saveState: function(instanceId, state) {
    // Sends to server which writes to state/widgets/<instanceId>.json
    if (window.__piWs && window.__piWs.readyState === 1) {
      window.__piWs.send(JSON.stringify({
        type: 'widget_state_save',
        instance: instanceId,
        state: state
      }));
    }
  },
  
  // NEW: Load persisted state (called at init)
  // Returns null if no saved state
  loadState: function(instanceId) {
    // State is pre-loaded by compositor and embedded in data-state attribute
    var el = document.querySelector('[data-instance="' + instanceId + '"]');
    if (el && el.dataset.state) {
      try { return JSON.parse(el.dataset.state); } catch(e) {}
    }
    return null;
  }
};
```

#### Music Player Example

```html
<style>
  .player-controls { display: flex; gap: 8px; align-items: center; }
  .btn { background: rgba(255,255,255,0.1); border: none; color: white; 
         padding: 8px 16px; border-radius: 8px; cursor: pointer; }
  .btn:active { background: rgba(255,255,255,0.2); }
  .progress { width: 100%; height: 4px; background: rgba(255,255,255,0.1); 
              border-radius: 2px; cursor: pointer; }
  .progress-fill { height: 100%; background: #10b981; border-radius: 2px; 
                   transition: width 0.3s; }
</style>

<div class="now-playing">
  <div class="title">—</div>
  <div class="artist">—</div>
</div>
<div class="progress" id="progress-bar">
  <div class="progress-fill" id="progress-fill"></div>
</div>
<div class="player-controls">
  <button class="btn" id="btn-prev">⏮</button>
  <button class="btn" id="btn-play">▶</button>
  <button class="btn" id="btn-next">⏭</button>
</div>

<script>
PiWidget.register(document.currentScript.parentElement, function(ctx) {
  var titleEl = ctx.root.querySelector('.title');
  var artistEl = ctx.root.querySelector('.artist');
  var playBtn = ctx.root.querySelector('#btn-play');
  var progressFill = ctx.root.querySelector('#progress-fill');
  var progressBar = ctx.root.querySelector('#progress-bar');
  
  // Interactive: button clicks send commands to MPD daemon via server
  playBtn.addEventListener('click', function() {
    PiWidget.sendCommand(ctx.widgetType, 'toggle_play', {});
  });
  ctx.root.querySelector('#btn-prev').addEventListener('click', function() {
    PiWidget.sendCommand(ctx.widgetType, 'prev', {});
  });
  ctx.root.querySelector('#btn-next').addEventListener('click', function() {
    PiWidget.sendCommand(ctx.widgetType, 'next', {});
  });
  progressBar.addEventListener('click', function(e) {
    var pct = e.offsetX / progressBar.offsetWidth;
    PiWidget.sendCommand(ctx.widgetType, 'seek', { position: pct });
  });
  
  return {
    // Downlink: receive now-playing state from MPD daemon via push
    onData: function(data) {
      titleEl.textContent = data.title || '—';
      artistEl.textContent = data.artist || '—';
      playBtn.textContent = data.playing ? '⏸' : '▶';
      progressFill.style.width = (data.progress * 100) + '%';
    }
  };
});
</script>
```

#### Notepad / Quick Tasks Example (With Persistence)

```html
<textarea id="notes" placeholder="Quick notes..."></textarea>

<script>
PiWidget.register(document.currentScript.parentElement, function(ctx) {
  var textarea = ctx.root.querySelector('#notes');
  
  // Load persisted state
  var saved = PiWidget.loadState(ctx.instanceId);
  if (saved && saved.text) {
    textarea.value = saved.text;
  }
  
  // Auto-save on change (debounced)
  var saveTimer;
  textarea.addEventListener('input', function() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      PiWidget.saveState(ctx.instanceId, { text: textarea.value });
    }, 1000);  // Save 1 second after user stops typing
  });
  
  return {};
});
</script>
```

#### Server-Side Command Routing

```typescript
// In server websocket.message handler
message(ws, msg) {
  const parsed = JSON.parse(msg);
  
  if (parsed.type === 'widget_command') {
    // Route command to the appropriate handler
    routeWidgetCommand(parsed.widget, parsed.action, parsed.payload);
  }
  
  if (parsed.type === 'widget_state_save') {
    // Persist to state/widgets/<instanceId>.json
    const stateDir = join(process.cwd(), 'state', 'widgets');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      join(stateDir, `${parsed.instance}.json`),
      JSON.stringify(parsed.state),
      'utf8'
    );
  }
  
  if (parsed.type === 'heartbeat') {
    // ... existing heartbeat handling
  }
}

function routeWidgetCommand(widgetType: string, action: string, payload: any) {
  // Option A: Write to daemon's command file
  const cmdPath = join(getIpcDir(), `${widgetType}.cmd.json`);
  writeFileSync(cmdPath, JSON.stringify({ action, payload, timestamp: Date.now() }));
  
  // Option B: Call daemon's local REST API (if daemon exposes one)
  // Option C: Write to a shared command queue file
  
  // The daemon watches for .cmd.json files and executes the command
}
```

#### Command File Contract

Daemons that support interactive control watch for `.cmd.json` files:

```
/tmp/widgets/mpd.json       ← daemon writes: now-playing state (downlink)
/tmp/widgets/mpd.cmd.json   ← server writes: user commands (uplink)
```

The daemon reads and deletes `mpd.cmd.json` after processing. Simple, file-based, no extra sockets needed.

### Manifest Declaration for Interactive Widgets

```json
{
  "id": "mpd-player",
  "tier": "push",
  "trust": "core",
  
  "interactive": {
    "commands": [
      { "action": "toggle_play", "description": "Play or pause playback" },
      { "action": "next", "description": "Skip to next track" },
      { "action": "prev", "description": "Go to previous track" },
      { "action": "seek", "description": "Seek to position", "payload": { "position": "number 0-1" } }
    ],
    "persistence": false
  }
}
```

```json
{
  "id": "quick-notes",
  "tier": "static",
  "trust": "core",
  
  "interactive": {
    "commands": [],
    "persistence": true,
    "stateSchema": {
      "text": { "type": "string", "maxLength": 10000 }
    }
  }
}
```

---

## Part 3: Viewer Context Variables

> "What if we want the clock to show the time of the viewer and not the machine server?"

### The Problem

Some values depend on **who is viewing the page**, not the server or widget config:
- **Timezone**: Viewer in India sees IST, viewer in London sees GMT
- **Locale**: Date formatting, number formatting
- **Device type**: Phone viewer vs kiosk display (touch vs no-touch)
- **Screen dimensions**: For responsive widget behavior
- **Theme preference**: System dark/light mode

These can't be baked into the canvas config because they change per viewer.

### Design: `PiWidget.context`

The compositor injects a client-side context object that's auto-populated from the viewer's browser:

```javascript
// Injected by compositor before any widget loads
window.PiWidget.context = {
  // Auto-detected from browser
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,  // e.g. "Asia/Kolkata"
  locale: navigator.language,                                   // e.g. "en-IN"
  is24h: !(new Date().toLocaleTimeString().match(/AM|PM/)),    // Auto-detect 12/24h
  deviceType: ('ontouchstart' in window) ? 'touch' : 'pointer',
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  
  // Server-provided (injected by compositor at render time)
  serverTimezone: 'UTC',           // Pi's timezone
  canvasId: 'morning-dashboard',
  piModel: 'Pi Zero 2W',
  
  // User-overridable (from canvas config, falls back to auto-detected)
  // These allow the admin to force specific values
  overrides: {}
};
```

#### How Widgets Use Context

```javascript
PiWidget.register(document.currentScript.parentElement, function(ctx) {
  // ctx.config = widget-specific config from canvas
  // PiWidget.context = viewer/environment context
  
  var tz = ctx.config.timezone                  // Widget-specific override (if set in admin)
        || PiWidget.context.timezone;           // Fallback to viewer's timezone
  
  function tick() {
    var now = new Date();
    var timeStr = now.toLocaleTimeString(PiWidget.context.locale, {
      timeZone: tz,
      hour12: !PiWidget.context.is24h
    });
    ctx.root.querySelector('.time').textContent = timeStr;
  }
  
  return { onFrame: tick };
});
```

#### Fallback Chain

For any context-dependent value, the resolution order is:

```
1. Widget config override  (admin explicitly set timezone = "America/New_York")
2. Canvas config override  (admin set a canvas-level default timezone)
3. Viewer auto-detected    (PiWidget.context.timezone from browser)
4. Server default          (PiWidget.context.serverTimezone from Pi)
```

This means:
- **Kiosk display** on the Pi itself → viewer timezone = Pi's timezone (same machine)
- **Admin viewing remotely** from phone in India → viewer timezone = Asia/Kolkata
- **Widget with explicit timezone** set in config → ignores viewer, uses configured value

#### Schedule Uses Viewer Timezone

```javascript
// Schedule checker uses PiWidget.context.timezone for comparisons
function checkSchedule(sched) {
  var now = new Date();
  // Convert to viewer's local time for the schedule check
  var localTime = now.toLocaleTimeString('en-US', {
    timeZone: PiWidget.context.timezone,
    hour12: false, hour: '2-digit', minute: '2-digit'
  });
  // ... midnight wrap logic using localTime
}
```

If you open the dashboard on your phone in India at 14:30 IST, and a widget is scheduled `09:00 → 18:00`, it checks against 14:30 → visible. ✅

If someone in London opens the same dashboard at 10:00 GMT (14:30 IST), it checks against their 10:00 → also visible, because the schedule is relative to **their** clock.

---

## Part 4: Security & Permissions Model

> "Don't focus on security now but think about a permission list system."

### Current Approach: Define the Model, Implement Core Only

We define the permission categories now and enforce only `core` and `unsafe` in v1. `verified` and `community` enforcement comes in a future security phase.

### Permission Categories

```typescript
interface WidgetPermissions {
  // Network
  canFetch: boolean;           // Can the fragment make HTTP requests?
  canLoadExternalScripts: boolean;  // Can it load <script src="...">?
  canLoadExternalStyles: boolean;   // Can it load <link href="...">?
  
  // DOM
  canAccessParentDOM: boolean;  // Can it reach outside its container?
  canUseEval: boolean;          // eval(), new Function(), setTimeout(string)
  
  // Storage
  canUsePersistence: boolean;   // PiWidget.saveState()
  canUseLocalStorage: boolean;  // Direct localStorage/sessionStorage
  canUseCookies: boolean;       // document.cookie
  
  // Data
  canSendCommands: boolean;     // PiWidget.sendCommand() (uplink)
  canReceiveData: boolean;      // onData handler (downlink)
  
  // System
  canAccessContext: boolean;    // PiWidget.context (viewer info)
  canUseCanvas2D: boolean;      // <canvas> API (heavy on Pi)
  canUseLottie: boolean;        // Lottie animations
  
  // Outbound (the key security concern)
  canSendOutboundData: boolean; // Can the widget exfiltrate data to external servers?
}
```

### Default Permission Sets Per Trust Level

| Permission | `core` | `verified` | `community` | `unsafe` |
|:---|:---|:---|:---|:---|
| canFetch | ✅ | ✅ | ❌ (iframe sandbox) | ✅ |
| canLoadExternalScripts | ✅ | ✅ | ❌ | ✅ |
| canAccessParentDOM | ✅ | ❌ (Shadow DOM) | ❌ (iframe) | ✅ |
| canUseEval | ✅ | ❌ | ❌ | ✅ |
| canSendCommands | ✅ | ✅ | ❌ | ✅ |
| canReceiveData | ✅ | ✅ | ✅ (via postMessage) | ✅ |
| canUsePersistence | ✅ | ✅ | ❌ | ✅ |
| canSendOutboundData | ✅ | ❌ | ❌ | ✅ |

> [!NOTE]
> **`verified` can fetch but cannot send outbound.** A weather widget needs `fetch()` to call an API. But we don't want it secretly POSTing your sysinfo to an external server. `canFetch: true` + `canSendOutboundData: false` means: GET requests to allowlisted APIs = OK. POST to arbitrary URLs = blocked. The allowlist comes from the manifest's declared API endpoints. This is a future enforcement mechanism — for v1, `verified` acts like `core`.

### Manifest Permission Declaration

```json
{
  "id": "custom-weather",
  "trust": "verified",
  
  "permissions": {
    "network": ["GET https://api.open-meteo.com/*"],
    "persistence": true,
    "commands": ["refresh"]
  }
}
```

The permission declaration is informational in v1. In a future security phase, the server validates that the widget only uses declared permissions.

---

## Part 5: Canvas Config Schema

### Design Principles

1. **`widget_count` computed, never stored.** Stripped on write, computed on read.
2. **`schemaVersion` from day one.**
3. **Schedule in 24h format, compared against viewer timezone** via `PiWidget.context`.
4. **`blendMode` enum-restricted.** `filter` is a structured object.
5. **`layout` replaces `base_config`.** `config` replaces `widget_config`.

### TypeScript Interface

```typescript
interface CanvasConfig {
  schemaVersion: 2;
  id: string;
  name: string;
  description?: string;
  
  canvas: {
    width: number;               // 320–7680
    height: number;              // 240–4320
    background: string;          // CSS color
    displayTarget: "primary" | "secondary" | "all";
    pixelRatio: 1 | 2;
    fps: 30 | 60;
    
    // Canvas-level context overrides (optional)
    defaultTimezone?: string;    // Override viewer auto-detect for this canvas
    defaultLocale?: string;
  };
  
  widgets: WidgetInstance[];
  // No widget_count field
  
  updated_at: string;
}

interface WidgetInstance {
  id: string;
  widget_id: string;
  label: string;
  enabled: boolean;
  
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;              // 1–999
    opacity: number;             // 0.0–1.0
    borderRadius?: number;
    overflow: "hidden" | "visible";
    
    blendMode?: "normal" | "multiply" | "screen" | "overlay" | "darken" 
              | "lighten" | "color-dodge" | "color-burn" | "hard-light" 
              | "soft-light" | "difference" | "exclusion";
    
    filter?: {
      blur?: string;
      brightness?: number;
      contrast?: number;
      grayscale?: number;
      saturate?: number;
      sepia?: number;
      opacity?: number;
    };
    
    transition?: string;
  };
  
  schedule?: {
    activeFrom: string;          // "HH:MM" 24h format, checked against VIEWER timezone
    activeTo: string;            // Wraps past midnight if activeFrom > activeTo
    days?: ("mon"|"tue"|"wed"|"thu"|"fri"|"sat"|"sun")[];
  };
  
  config: Record<string, any>;
}
```

---

## Part 6: Widget Manifest v2

```json
{
  "id": "my-widget",
  "name": "My Widget",
  "version": "1.0.0",
  "author": "PiDashboard",
  "description": "A widget",
  
  "tier": "static | pull | push | stream",
  "trust": "core | verified | community | unsafe",
  
  "fragment": {
    "file": "fragment/my-widget.html",
    "format": "snippet"
  },
  
  "dataChannel": {
    "type": "none | websocket | ipc_file",
    "ipcFilename": "my-widget.json",
    "fetchModule": "fetch/my-widget.ts"
  },
  
  "interactive": {
    "commands": [
      { "action": "string", "description": "string", "payload": {} }
    ],
    "persistence": false,
    "stateSchema": {}
  },
  
  "polling": {
    "intervalSec": 60,
    "jitterSec": 5
  },
  
  "animations": {
    "type": ["css", "lottie", "canvas2d", "gif"],
    "lottieFiles": [],
    "lottieRenderer": "canvas | svg | html",
    "targetFps": 60
  },
  
  "resources": {
    "estimatedRamKB": 50,
    "requiresNetwork": false,
    "externalFonts": ["Inter"],
    "externalScripts": []
  },
  
  "permissions": {
    "network": ["GET https://api.example.com/*"],
    "persistence": true,
    "commands": ["play", "pause"]
  },
  
  "configSchema": [
    {
      "key": "timezone",
      "type": "timezone",
      "label": "Timezone (leave empty to use viewer's timezone)",
      "default": "",
      "required": false,
      "validation": { "pattern": "^[A-Za-z]+/[A-Za-z_]+$" }
    }
  ],
  
  "defaults": {
    "width": 320,
    "height": 240,
    "minWidth": 100,
    "minHeight": 80
  }
}
```

---

## Part 7: PiWidget SDK

### Complete SDK (~50 lines)

```javascript
(function() {
  var _dataHandlers = [];
  var _frameCallbacks = [];
  var _targetFps = 60;
  var _frameInterval = 1000 / _targetFps;
  var _lastFrameTime = 0;
  
  window.PiWidget = {
    // ── Viewer Context (populated by compositor at page load) ──
    context: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
      is24h: !(new Date().toLocaleTimeString().match(/AM|PM/)),
      deviceType: ('ontouchstart' in window) ? 'touch' : 'pointer',
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      serverTimezone: 'UTC',
      canvasId: '',
      overrides: {}
    },
    
    // ── Widget Registration ──
    register: function(widgetEl, factory) {
      var config = JSON.parse(widgetEl.getAttribute('data-config') || '{}');
      var instanceId = widgetEl.getAttribute('data-instance');
      var widgetType = widgetEl.getAttribute('data-widget');
      
      var api = factory({
        root: widgetEl,
        config: config,
        instanceId: instanceId,
        widgetType: widgetType,
        context: PiWidget.context
      });
      
      if (api && api.onData) {
        _dataHandlers.push({ type: widgetType, handler: api.onData });
      }
      if (api && api.onFrame) {
        _frameCallbacks.push(api.onFrame);
      }
    },
    
    // ── Data Dispatch (called by WS client) ──
    _dispatch: function(widgetType, data) {
      _dataHandlers.forEach(function(entry) {
        if (entry.type === widgetType) {
          try { entry.handler(data); } catch(e) {
            console.error('[PiWidget] onData error in ' + widgetType + ':', e);
            window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
          }
        }
      });
    },
    
    // ── Central Frame Loop ──
    _startFrameLoop: function(fps) {
      _targetFps = fps || 60;
      _frameInterval = 1000 / _targetFps;
      function tick(timestamp) {
        if (timestamp - _lastFrameTime >= _frameInterval) {
          _lastFrameTime = timestamp;
          _frameCallbacks.forEach(function(cb) {
            try { cb(timestamp); } catch(e) {
              window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
            }
          });
        }
        requestAnimationFrame(tick);
      }
      if (_frameCallbacks.length > 0) requestAnimationFrame(tick);
    },
    
    // ── Interactive: Send Command to Server ──
    sendCommand: function(widgetType, action, payload) {
      if (window.__piWs && window.__piWs.readyState === 1) {
        window.__piWs.send(JSON.stringify({
          type: 'widget_command',
          widget: widgetType,
          action: action,
          payload: payload || {}
        }));
      }
    },
    
    // ── Persistence ──
    saveState: function(instanceId, state) {
      if (window.__piWs && window.__piWs.readyState === 1) {
        window.__piWs.send(JSON.stringify({
          type: 'widget_state_save',
          instance: instanceId,
          state: state
        }));
      }
    },
    
    loadState: function(instanceId) {
      var el = document.querySelector('[data-instance="' + instanceId + '"]');
      if (el && el.dataset.state) {
        try { return JSON.parse(el.dataset.state); } catch(e) {}
      }
      return null;
    }
  };
})();
```

### Generic Library Injection System

> "We will in future think about adding more .js libraries."

The compositor supports a generic `externalScripts` array in the manifest. For v1, we handle Lottie. For future, any declared library:

```typescript
// Compositor logic
const scripts = new Set<string>();

// Always inject SDK
scripts.add('/media/libs/pi-widget-sdk.js');

// Scan active widget manifests
for (const w of activeWidgets) {
  // Built-in library detection
  if (w.manifest.animations?.type?.includes('lottie')) {
    scripts.add('/media/libs/lottie.min.js');
  }
  
  // Generic external scripts from manifest
  if (w.manifest.resources?.externalScripts) {
    for (const src of w.manifest.resources.externalScripts) {
      // Only allow scripts from /media/libs/ (local) for security
      if (src.startsWith('/media/libs/')) {
        scripts.add(src);
      }
    }
  }
}

// Inject in <head>
for (const src of scripts) {
  head += `<script src="${src}"></script>\n`;
}
```

Widget authors bundle their dependencies in `media/libs/` and declare them in the manifest. The compositor deduplicates and injects them once. No CDN dependency.

---

## Part 8: Shadow DOM Style Isolation

Each `core`/`verified` widget gets its own Shadow DOM. Fonts injected per shadow root. `community` widgets use iframe isolation instead.

```typescript
// Compositor injects this after all widget containers are in the DOM
document.querySelectorAll('[data-widget]').forEach(function(container) {
  if (container.dataset.trust === 'community') return; // iframed separately
  
  var shadow = container.attachShadow({ mode: 'open' });
  
  // Inject fonts declared by this widget's manifest
  var fonts = container.dataset.fonts;
  if (fonts) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + fonts + '&display=swap';
    shadow.appendChild(link);
  }
  
  // Move fragment content into shadow
  while (container.firstChild) {
    shadow.appendChild(container.firstChild);
  }
});
```

---

## Part 9: Compositor Engine

### Key Behaviors

1. **Pure function** — `composeHTML(canvas, registry)` receives validated data, returns HTML string
2. **z-index sorted rendering** — lowest zIndex first in DOM
3. **Client-side schedule filtering** — all widgets rendered, JS shows/hides based on viewer timezone
4. **Per-widget error boundaries** — try/catch wrapping around each fragment's `<script>`
5. **Shadow DOM for core/verified, iframe for community**
6. **Conditional resource injection** — Lottie, fonts, future libs injected only when needed
7. **Context variables injected** — `PiWidget.context` auto-populated from browser + server data
8. **Persistent state embedding** — widgets with saved state get `data-state` attribute
9. **Interactive command support** — WS client forwards uplink commands from `PiWidget.sendCommand()`

### Display Heartbeat

Kiosk sends WS ping every 30s:
```json
{
  "type": "heartbeat",
  "canvas_id": "morning",
  "uptime": 8250,
  "widget_errors": 0,
  "timestamp": 1716990000000
}
```

Server exposes `GET /api/system/displays` for admin panel.

---

## Part 10: Widget Validator

### Block, Don't Sanitize

Validation at server boot and widget install. Invalid widgets excluded from registry.

**Phase 1:** Manifest structure (required fields, valid tier/trust values)
**Phase 2:** Fragment structure (no `<!DOCTYPE>`, no `<html>`/`<head>`/`<body>`, size < 100KB)
**Phase 3:** Security checks (based on trust level — `eval`, external scripts, etc.)
**Phase 4:** SDK compliance (warn if missing `PiWidget.register`)

**`document.currentScript` constraint documented prominently** in Widget Development Guide with ❌/✅ examples.

---

## Part 11: Canvas Validator (Lightweight)

Pure arithmetic + string comparisons. Runs on publish and boot only. <1ms on Pi.

- Required field checks
- Dimension clamping (auto-fix, not reject)
- Widget reference validation against registry
- Duplicate instance ID detection
- Layout value clamping
- blendMode enum validation
- `widget_count` stripped (computed on read)
- `schemaVersion` stamped

---

## Part 12: Architectural Cleanup

### Per-Canvas Widget Management Only

Delete global widget instance CRUD endpoints. Keep `GET /api/widgets/registry` (read-only).

### Delete All Existing Widgets

Remove clock-analog, clock-digital, image, sysinfo, weather. Keep `_base/` and `README.md`.

### Rename Fields

`base_config` → `layout`, `widget_config` → `config` throughout codebase.

---

## Execution Order

| Step | Component | Depends On |
|:---|:---|:---|
| 1 | Manifest v2 schema + `_base/manifest.schema.json` | Nothing |
| 2 | Widget validator | Manifest v2 |
| 3 | Canvas validator | Manifest v2 |
| 4 | PiWidget SDK (`pi-widget-sdk.js`) | Nothing |
| 5 | Delete existing widgets | Nothing |
| 6 | Compositor rewrite (Shadow DOM, error boundaries, SDK injection, schedule, context, state, commands) | SDK, validators |
| 7 | Clean widgets.ts → registry-only | Compositor |
| 8 | Clean canvas.ts → add validation | Canvas validator |
| 9 | Clean index.ts → remove global widget CRUD, add command routing, heartbeat, state persistence | All above |
| 10 | Test suite (6 layers) | All above |
| 11 | CLI tools (preview, validate) | Compositor, validators |

---

## Open Questions

> [!IMPORTANT]
> **Admin panel updates**: The React admin needs changes for per-canvas widget management, new config schema (`layout`/`config`), interactive widget UI (showing command buttons in preview), and display health status. Handle in this phase or defer?

> [!IMPORTANT]
> **Command routing extensibility**: For v1, widget commands are routed by writing `.cmd.json` files to the IPC directory. Should we also support a plugin/hook system where widget authors can register server-side command handlers in their `fetch/` module? Example: a home automation widget's fetch module could export a `handleCommand(action, payload)` function that the server calls directly instead of writing a file.
