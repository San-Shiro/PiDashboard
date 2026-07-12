# 01 — Tier System

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `manifest.json`, `scheduler.ts`

---

## Execution Tiers

### `static` — Client-Only Rendering

**Purpose:** Widgets that need zero server interaction after initial page load.

**Data flow:**
```
Canvas config → Compositor embeds data-config → Widget reads once → Self-managed loops
```

**Implementation notes:**
- Compositor sets `data-config` attribute with serialized `widget_config` JSON
- Widget uses `PiWidget.register()` and reads `ctx.config` at init
- For animations: return `onFrame` callback → central frame dispatcher handles timing
- No `__widgetUpdaters` registration needed
- No WebSocket messages consumed

**When to choose `static`:**
- Widget derives display from `new Date()`, `Math.random()`, or config values only
- No external API calls
- No daemon needed

**Examples with rationale:**
| Widget | Why static? |
|:---|:---|
| Analog/digital clock | Reads system time via `new Date()`, config only for timezone |
| Image display | `src` from config, no updates needed |
| Text overlay | Static text from config |
| CSS particle animation | Pure CSS keyframes, no data |
| Countdown timer | Target date from config, renders via `Date.now()` delta |

**Potential errors:**
- ❌ Widget tries to `fetch()` inside fragment → works for `core` trust but wastes Pi resources. Use `pull` tier instead.
- ❌ Widget creates its own `setInterval` → CPU waste. Use `onFrame` from SDK instead.

---

### `pull` — Server-Fetched Data

**Purpose:** Bun server fetches external API data on a schedule and writes JSON to the IPC directory. Widget receives data via WebSocket push.

**Data flow:**
```
Bun scheduler timer fires
  → import('widgets/<id>/fetch/<module>.ts')
  → mod.fetchData(widget_config) returns JSON
  → writeFileSync('/tmp/widgets/<id>.json', json)
  → fs.watch detects change
  → stateCache updated
  → WebSocket broadcast: { type: "data", widget: "<id>", data: {...} }
  → Widget's onData(data) callback fires
```

**Fetch module contract:**
```typescript
// widgets/weather/fetch/weather.ts
export async function fetchData(config: Record<string, any>): Promise<any> {
  // config contains the widget_config from the canvas instance
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=...`);
  const json = await res.json();
  
  // Return the data shape that the fragment's onData() expects
  return {
    temp: json.current.temperature_2m,
    humidity: json.current.relative_humidity_2m,
    condition: mapWeatherCode(json.current.weather_code),
    // ...
  };
}
```

**Scheduler behavior:**
- Base interval from `manifest.polling.intervalSec` (default: 60)
- Jitter: ±`manifest.polling.jitterSec` seconds to avoid thundering herd
- On fetch failure: exponential backoff (2x, 4x, 8x cap) with ±2s jitter
- On recovery: reset to base interval, log event
- `fetchData()` runs inside try/catch — failures never crash the scheduler

**When to choose `pull`:**
- Data comes from a public HTTP API
- Update interval ≥ 5 seconds
- The Pi (server) needs to do the fetching (kiosk browser may not have CORS access)

**Potential errors:**
| Error | Impact | Handling |
|:---|:---|:---|
| API rate limit (429) | Fetch fails | Backoff handles it automatically |
| DNS failure | Fetch fails | Backoff + recovery on reconnect |
| Malformed API response | `fetchData()` throws | Caught by scheduler, old data persists in stateCache |
| Fetch module missing | Widget skipped | Validator rejects at boot if `fetchModule` not found |
| API returns huge JSON (>1MB) | Memory spike | `fetchData` should return only needed fields, not raw API response |

**Code reminders:**
- Always destructure API responses in `fetchData()` — never write raw 3rd-party JSON to IPC
- Return consistent shapes — the fragment's `onData()` expects a stable contract
- Use `config` parameter for location, API keys, units, etc.
- Never hardcode secrets in fetch modules — use environment variables

---

### `push` — External Daemon IPC

**Purpose:** An external program (systemd daemon, Go binary, shell script) writes data to the IPC directory. Bun watches for changes and pushes to kiosks via WebSocket.

**Data flow:**
```
External daemon writes /tmp/widgets/sysinfo.json every 2 seconds
  → Bun fs.watch fires (100ms debounce)
  → File read + JSON.parse
  → stateCache.set("sysinfo", data)
  → WebSocket broadcast to all kiosks
  → Widget's onData(data) fires
```

**Daemon contract:**
```
RULE: Write valid JSON to /tmp/widgets/<name>.json at your own interval.
RULE: Use atomic writes (write to .tmp then rename) to avoid partial reads.
RULE: Keep JSON small (<10KB per update).
```

**When to choose `push`:**
- Data comes from a local system source (CPU stats, hardware sensors, MPD socket)
- Data changes 1-10 times per second
- You want the daemon in a different language (Go, Rust, C, Python)
- The daemon manages its own update interval

**Command file protocol (for interactive push widgets):**
```
/tmp/widgets/mpd.json       ← Daemon writes: state data (downlink)
/tmp/widgets/mpd.cmd.json   ← Server writes: user commands (uplink)
```
See [08-interactive-widgets.md](./08-interactive-widgets.md) for details.

**Potential errors:**
| Error | Impact | Handling |
|:---|:---|:---|
| Daemon crashes | IPC file goes stale | Widget shows last good data. Admin heartbeat shows stale timestamp |
| Daemon writes invalid JSON | Parse fails | `try/catch` in watcher — silently skip, old data persists |
| Daemon writes >10KB | Memory waste | Warn in validator if `estimatedRamKB` is high |
| Two daemons write same file | Race condition | Each widget type must have a unique IPC filename |
| File permissions wrong | Read fails | `initIpcDir()` sets correct permissions at boot |

---

### `stream` — High-Frequency Direct Channel

**Purpose:** Real-time data at frame rate (30-60fps). Too fast for file I/O. Uses a dedicated WebSocket channel or named pipe.

**Status:** Contract defined, implementation deferred to v2.

**Fallback:** If a widget declares `tier: "stream"`, the compositor logs a warning and treats it as `push`. The widget must gracefully handle lower update rates.

**Future data flow:**
```
Daemon connects to Bun's WS server on a special endpoint (/ws/stream/<widget-type>)
  → Sends binary/JSON frames at 30-60fps
  → Bun forwards frames to kiosk WS connections tagged for that widget
  → Widget's onData() fires at frame rate
```

**When to choose `stream`:**
- Audio FFT spectrum visualization
- Live camera/video feed frames
- Waveform rendering
- Any data >10 updates/sec

---

## Security Tiers

### How Trust Levels Map to Runtime Behavior

```
┌──────────────────────────────────────────────────────────┐
│                    Compositor                            │
│                                                          │
│  core / verified widget:                                 │
│  ┌─────────────────────────┐                             │
│  │ <div data-widget="..."> │                             │
│  │   ┌───── Shadow DOM ──┐ │                             │
│  │   │ <style> scoped    │ │                             │
│  │   │ <div> fragment    │ │                             │
│  │   │ <script> IIFE     │ │ ← Direct DOM, PiWidget SDK │
│  │   └───────────────────┘ │                             │
│  └─────────────────────────┘                             │
│                                                          │
│  community widget:                                       │
│  ┌─────────────────────────┐                             │
│  │ <div data-widget="..."> │                             │
│  │   <iframe sandbox="     │                             │
│  │     allow-scripts"      │                             │
│  │     srcdoc="...">       │ ← Isolated, postMessage     │
│  │   </iframe>             │                             │
│  └─────────────────────────┘                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Tier Combination Matrix

| Execution | + core | + verified | + community | + unsafe |
|:---|:---|:---|:---|:---|
| `static` | Clock, image | Community clock | Untrusted timer | Dev widget |
| `pull` | Weather | Community RSS reader | Untrusted news feed | API testing |
| `push` | Sysinfo, MPD | Community GPIO widget | — (rare) | Dev sensor |
| `stream` | Audio viz | — (rare) | — (blocked) | Dev camera |

**Code reminders:**
- `trust` and `tier` are independent fields in the manifest
- The validator checks valid combinations (e.g., `community` + `stream` is rejected — no iframe support for stream)
- The compositor reads `trust` to decide inline (Shadow DOM) vs iframe rendering
- The compositor reads `tier` to decide which data channel to wire up
