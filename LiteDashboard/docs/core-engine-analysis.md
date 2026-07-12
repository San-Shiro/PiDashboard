# Core Engine Architecture Analysis

> **Date:** 2026-07-09
> **Scope:** `LiteDashboard/core/` — Engine, SDK, IPC, WebSocket, State Store, Compositor
> **Purpose:** Permanent reference for the current engine state before the standardisation overhaul.

---

## 1. Architecture Overview

The PiDashboard kiosk display runs on a **Server-Side String Compositor + Vanilla JS snippet** architecture.

### Data Flow (End-to-End)

```
Daemon (any language) writes /tmp/widgets/<type>.json
  → fs.watch detects change (50ms debounce per file)
  → tmpfs-watcher parses JSON → stateStore.patch() (deep merge, 50KB cap)
  → WS display handler: scheduleBroadcast (150ms debounce per key)
  → WS broadcast { type: "state", widget: "<type>", instance: "global", data: {...} }
  → Browser: PiWidget._dispatchState("<type>", "global", data)
  → All registered onState/onData handlers for "<type>" fire
  → Widget JavaScript manually updates DOM
```

### Key Files

| File | Role | Size |
|------|------|------|
| `core/engine/compositor.ts` | Server-side HTML generation | 433 lines |
| `core/engine/schema.ts` | TypeScript type definitions | 142 lines |
| `core/engine/validators/canvas-validator.ts` | Canvas JSON validation | ~150 lines |
| `core/engine/validators/widget-validator.ts` | Widget manifest validation | ~170 lines |
| `core/sdk/pi-widget.js` | Client-side widget SDK (IIFE) | 79 lines |
| `core/server/ipc/tmpfs-watcher.ts` | Filesystem watcher for IPC | 70 lines |
| `core/server/state/state-store.ts` | In-memory state with persistence | 120 lines |
| `core/server/ws/display.ts` | WebSocket handler | 155 lines |
| `core/server/router.ts` | HTTP router | 87 lines |
| `core/tools/server.ts` | Main Bun server entry | 500+ lines |

---

## 2. Compositor (Server-Side)

### What it does
Takes a `CanvasConfig` JSON + widget registry (manifests + HTML fragments) and produces a **single composited HTML page**.

### How widget fragments are processed

1. **Load fragment HTML** from `widgets/<id>/<file>.html`
2. **Regex script extraction** (`separateFragmentScript`): Rips the last `<script>` tag out of the HTML using regex
3. **IIFE wrapping**: Injects the extracted script into a generated IIFE that provides:
   - `instanceId`, `widgetType` — identity strings
   - `config` — parsed from `data-config` attribute
   - `state` — parsed from `data-state` attribute (initial persisted state)
   - `$()` / `$$()` — scoped querySelector helpers (shadow-root aware)
   - `widget.patchState(delta)` — debounced (100ms) WebSocket state push
   - `widget.callDaemon(payload)` — sends `{ type: 'cmd', daemon: ... }` via WS
4. **Registration**: After widget code runs, calls `PiWidget._registerAPI(instanceId, widgetType, { onData, onState, onFrame, onDestroy })`
5. **Trust-level rendering**:
   - `core` / `verified` → inline HTML + Shadow DOM injection
   - `community` → sandboxed `<iframe>` with `postMessage` data channel

### Generated page structure
```html
<!DOCTYPE html>
<html>
<head>
  <!-- CSS custom properties from canvas theme -->
  <!-- Google Fonts links (from widget manifest resources.externalFonts) -->
  <!-- External scripts (pi-widget.js, lottie.min.js if needed) -->
</head>
<body>
  <div id="kiosk-viewport" data-canvas-id="...">
    <!-- Widget containers (absolute positioned, z-index sorted) -->
    <div data-widget="clock" data-instance="inst-123" data-config='...' id="inst-123">
      <!-- Fragment HTML (script extracted) -->
      <script>/* IIFE-wrapped widget code */</script>
    </div>
    ...
  </div>
  <!-- Schedule checker (30s interval, day/time visibility) -->
  <!-- Shadow DOM injection script (moves children into shadowRoot) -->
  <!-- Viewport auto-scaler (ResizeObserver, transform: scale) -->
  <!-- WebSocket client (reconnect with exponential backoff) -->
  <!-- Frame loop starter (requestAnimationFrame at canvas FPS) -->
</body>
</html>
```

---

## 3. PiWidget SDK (`core/sdk/pi-widget.js`)

79-line IIFE that exposes `window.PiWidget`.

### API Surface

```javascript
window.PiWidget = {
  context: { timezone, locale, is24h, deviceType, screenWidth, screenHeight, colorScheme, serverTimezone, canvasId, overrides },
  _registerAPI(instanceId, widgetType, { onState, onData, onFrame, onDestroy }),
  _dispatchState(widgetType, instanceId, data),
  _startFrameLoop(fps),
  _destroyAll()
};
```

### State Dispatch Logic
- Matches by `widgetType` AND (`instanceId === 'global'` OR exact instance match)
- Both `onState` and `onData` register into the same `_stateHandlers` array
- `onData` is labeled "fallback during migration" in comments

---

## 4. IPC Pipeline

### tmpfs-watcher.ts
- Watches a directory (default `/tmp/widgets/` on Linux, `state/cache/widgets/` on Windows)
- Ignores non-`.json` files and `.cmd.json` files (command files)
- 50ms debounce per filename
- Parses JSON, calls `stateStore.patch(type, data)`
- Triggers WS broadcast via synthetic patch message to `websocketHandler.message()`

### state-store.ts
- In-memory `Map<string, any>` with 50KB per-key limit
- `patch(key, delta)` — deep-merges delta into existing state
- `registerPersistable(key)` — enables 2-second debounced disk persistence
- `hydrate()` — loads all persistable states from disk on startup
- `flushAll()` — synchronous persist for clean shutdown

### WebSocket display.ts
- Manages display connections (`Set<ServerWebSocket>`) and daemon connections (`Map<string, ServerWebSocket>`)
- On `hello` from display: hydrates with all stored states
- On `patch`: stores + broadcasts (150ms debounce)
- On `cmd`: forwards to named daemon WebSocket
- Broadcast debounce: 150ms per state key

---

## 5. Widget Patterns (Current State)

### Widget Tiers
| Tier | Data Source | Widgets |
|------|-----------|---------|
| `static` | Self-driven (timers, no external data) | clock, notepad |
| `fetch` | HTTP polling from widget JS | weather |
| `push` | IPC → WS → onState/onData callback | sysinfo, music-player, now-playing, daily-quote, network-info, gpio-display |

### Config Access (two competing patterns)
```javascript
// Pattern A (clock, weather): Defensive dual-access
var cfg = (typeof PiWidget !== 'undefined' && PiWidget.config) || (typeof config !== 'undefined' ? config : {});

// Pattern B (now-playing, notepad): Compositor-injected widget object
widget.config.showAlbumArt
```

### State Callback (two names, same pipeline)
- `onState(state)` — preferred (now-playing, notepad, daily-quote, music-player)
- `onData(data)` — legacy (sysinfo)

### Daemons in Production
| Daemon | Language | IPC File | Update Interval |
|--------|----------|----------|-----------------|
| daily-quote.sh | Bash | quotes.json | Hourly |
| music-player.sh | Bash | music-player.json | 5s while playing |
| network-info.sh | Bash | network.json | 10s |
| gpio-daemon.sh | Bash | gpio.json | 2s |

---

## 6. Identified Weaknesses

1. **Manual DOM manipulation required**: Every widget must write `element.textContent = data.foo` for every JSON field. No declarative binding.
2. **Regex script extraction**: Fragile, no TypeScript support, no ES modules, poor error tracing.
3. **Inconsistent patterns**: Two config access patterns, two callback names, some widgets self-fetch instead of using IPC.
4. **Heavy iframe isolation**: Community widgets get full iframe contexts — very expensive on 512MB Pi.
5. **No addon/library system**: Widgets cannot share utility code without duplicating it inline.
6. **No standardised interactions**: Buttons, sliders, toggles all require custom JavaScript per widget.

---

## 7. Design Intent (Reference)

The intended architecture is **"dumb template + smart producer"**:
- **Widgets** = purely visual HTML/CSS templates whose DOM is driven by a JSON state file
- **Scripts/Daemons** = external programs in any language that do the heavy computation and write JSON
- **Engine** = bridges the two automatically (JSON changes → DOM updates)

The critical missing piece is a **declarative data-binding layer** that eliminates the need for manual DOM manipulation JavaScript in simple-to-medium widgets.

---

*This document should be updated whenever the core engine architecture changes.*
