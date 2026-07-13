# PiDashboard Widget SDK Specification v1.0

> Formal specification for developing widgets on the PiDashboard engine.
> All design decisions in this document were collaboratively approved.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Bun Server                               │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │  Compositor  │   │  State Store │   │   Daemon Bridge      │ │
│  │  (template   │   │  (per-canvas │   │   (stdin → WS push)  │ │
│  │   engine)    │   │   isolation) │   │                      │ │
│  └──────┬───────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                  │                      │             │
│         │    ┌─────────────┴──────────────┐       │             │
│         └────►     WebSocket Hub          ◄───────┘             │
│              │  (display.ts)              │                     │
│              └─────────────┬──────────────┘                     │
└────────────────────────────┼────────────────────────────────────┘
                             │ ws://host/ws/display
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Kiosk Browser                               │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Widget A     │  │  Widget B     │  │  Widget C            │ │
│  │  (Shadow DOM) │  │  (Shadow DOM) │  │  (Shadow DOM)        │ │
│  │  ┌──────────┐ │  │  ┌──────────┐ │  │  ┌────────────────┐ │ │
│  │  │ <style>  │ │  │  │ <style>  │ │  │  │ <style>        │ │ │
│  │  │ <html>   │ │  │  │ <html>   │ │  │  │ <html>         │ │ │
│  │  │ <script> │ │  │  │ <script> │ │  │  │ <script>       │ │ │
│  │  └──────────┘ │  │  └──────────┘ │  │  └────────────────┘ │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│                                                                │
│  pi-widget.js SDK  ────────────────────────────────────────── │
│  (routes WS messages → onState, provides $, widget.* API)     │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Widget File Structure

A widget is a self-contained folder under `widgets/<widget-id>/`.

### Minimal widget (single file):
```
widgets/
  my-widget/
    manifest.json
    my-widget.html        ← contains <style>, HTML, <script>
```

### Split widget (multi-file):
```
widgets/
  my-widget/
    manifest.json
    style.css
    template.html
    script.js
    preview.png           ← optional screenshot for admin panel
    README.md             ← optional data contract documentation
```

---

## 3. Manifest Schema

Every widget MUST provide a `manifest.json`. This is the contract between the widget and the engine.

```jsonc
{
  // REQUIRED fields
  "id": "weather",                    // Unique identifier (kebab-case)
  "name": "Weather Widget",           // Human-readable display name
  "sdkVersion": "1.0",               // Semantic version of the SDK this widget targets
  "fragment": {
    // Single-file mode:
    "file": "weather.html"
    // OR multi-file mode:
    // "style": "style.css",
    // "template": "template.html",
    // "script": "script.js"
  },

  // OPTIONAL fields
  "category": "system",               // One of: system, media, productivity, decoration, utility
  "icon": "☀️",                       // Emoji or SVG path for admin panel sidebar
  "author": "PiDashboard Team",
  "version": "1.0.0",                 // Widget version (independent of SDK version)
  "license": "MIT",
  "preview": "preview.png",           // Screenshot for widget picker
  "refreshRate": 10,                  // Suggested daemon poll interval in seconds

  // State behavior
  "persist": false,                   // Should state survive page refreshes?
  "stateMode": "global",              // "global" (one state for all instances) or "instance" (per-instance state)

  // Configuration schema (auto-generates Admin Panel settings UI)
  "configSchema": {
    "city": {
      "type": "string",
      "label": "City Name",
      "default": "Kanpur",
      "description": "City for weather data"
    },
    "units": {
      "type": "select",
      "label": "Temperature Units",
      "options": ["celsius", "fahrenheit"],
      "default": "celsius"
    },
    "refreshInterval": {
      "type": "number",
      "label": "Refresh Interval (seconds)",
      "default": 60,
      "min": 10,
      "max": 3600
    },
    "showHumidity": {
      "type": "boolean",
      "label": "Show Humidity",
      "default": true
    },
    "accentColor": {
      "type": "color",
      "label": "Accent Color",
      "default": "#00e5ff"
    }
  },

  // Network permissions (required for marketplace widgets; local widgets unrestricted)
  "network": [
    "api.openweathermap.org"
  ],

  // Daemon definition (optional — only if widget needs background data)
  "daemon": {
    "command": "./scripts/weather-daemon.sh",
    "args": ["--city", "{{ config.city }}"]
  }
}
```

### Config Schema Field Types

| Type | Admin Panel Renders | Properties |
|---|---|---|
| `string` | Text input | `default`, `placeholder`, `maxLength` |
| `number` | Number input with stepper | `default`, `min`, `max`, `step` |
| `boolean` | Toggle switch | `default` |
| `select` | Dropdown menu | `options[]`, `default` |
| `color` | Color picker | `default` |
| `range` | Slider | `default`, `min`, `max`, `step` |
| `text` | Multi-line textarea | `default`, `rows` |

---

## 4. SDK API Reference

The SDK injects the following into every widget's execution scope:

### 4.1 Global Functions

#### `$(selector)` → `Element | null`
Query an element within THIS widget's Shadow DOM. Equivalent to `shadowRoot.querySelector(selector)`. Never collides with other widgets.

```js
$('#temperature').textContent = '35°C';
$('.status-bar').style.width = '50%';
```

### 4.2 The `widget` Object

| Property / Method | Type | Description |
|---|---|---|
| `widget.id` | `string` | Widget type ID (e.g., `"weather"`) |
| `widget.instanceId` | `string` | Unique instance ID (e.g., `"weather_1"`) |
| `widget.config` | `object` | Read-only config from canvas JSON, merged with manifest defaults |
| `widget.state` | `object \| null` | Current state snapshot (may be `null` on first load) |
| `widget.canvas` | `object` | Canvas metadata: `{ width, height, theme }` |
| `widget.setState(delta)` | `function` | Write partial state update back to the server |
| `widget.log(msg)` | `function` | Debug logging (routed to server console, stripped in production) |
| `widget.destroy(callback)` | `function` | Register a cleanup function called when this widget is removed |
| `widget.fetch(url, options)` | `function` | Proxied HTTP request through Bun server (respects `network[]` in manifest) |

### 4.3 Lifecycle Hooks

Widgets expose functions in their `<script>` scope. The SDK auto-detects and calls them:

| Hook | When Called | Argument |
|---|---|---|
| `onState(state)` | Every time new data arrives from the daemon or state store | `{ key: value, ... }` |

> **Note:** `onState` is the only lifecycle hook in v1.0. Future versions may add `onResize`, `onThemeChange`, etc. The `widget.destroy()` registration pattern handles cleanup.

### 4.4 Global `PiWidget` Utilities

The global `PiWidget` object provides helper methods for inter-widget communication and touch gestures:

| Method | Description |
|---|---|
| `PiWidget.getInstanceState(widgetId, instanceId)` | Retrieve the current state of any widget instance on the dashboard. Useful for background scripts orchestrating inter-widget communication. |
| `PiWidget.onSwipe(element, callback)` | Attach a swipe listener to an element. Callback receives `'up'`, `'down'`, `'left'`, or `'right'`. |
| `PiWidget.onLongPress(element, callback, [duration=800])` | Attach a long-press listener to an element. |

> **Touch Architecture Note:** The kiosk compositor automatically applies `touch-action: pan-y pinch-zoom;` to all widgets. To capture raw gestures (like swiping or dragging a map) without scrolling the page, add `data-touch="none"` to your widget's `:host` or wrapper element.

---

## 5. Theming System

### 5.1 Theme Variable Hierarchy

```
Admin Panel Global Theme
    ↓ (overridden by)
Canvas-Level Theme (defined in canvas JSON)
    ↓ (overridden by)
Widget Instance Config (via configSchema color fields)
```

### 5.2 CSS Custom Properties

The compositor injects these CSS variables into every widget's Shadow DOM `:host`:

```css
/* Available in all widgets automatically */
:host {
  --pi-bg-primary: #0d1117;
  --pi-bg-secondary: #161b22;
  --pi-bg-surface: #21262d;
  --pi-text-primary: rgba(255, 255, 255, 0.95);
  --pi-text-secondary: rgba(255, 255, 255, 0.7);
  --pi-text-muted: rgba(255, 255, 255, 0.4);
  --pi-accent: #00e5ff;
  --pi-accent-hover: #00b8d4;
  --pi-border: rgba(255, 255, 255, 0.1);
  --pi-radius: 12px;
  --pi-font: 'Inter', -apple-system, sans-serif;
  --pi-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}
```

### 5.3 Using Theme Variables in Widgets

Widgets CAN use these variables but are NOT required to. This allows themed widgets to stay consistent with the dashboard, while decorative widgets can be fully custom:

```html
<style>
  .card {
    background: var(--pi-bg-surface);
    color: var(--pi-text-primary);
    font-family: var(--pi-font);
    border-radius: var(--pi-radius);
    border: 1px solid var(--pi-border);
  }
  .accent { color: var(--pi-accent); }
</style>
```

### 5.4 Canvas-Level Theme Override

```jsonc
// In canvas JSON:
{
  "canvas": {
    "width": 1920,
    "height": 1080,
    "background": "#0d1117",
    "theme": {
      "--pi-accent": "#ff6b6b",
      "--pi-bg-surface": "rgba(255,255,255,0.05)",
      "--pi-font": "'Outfit', sans-serif"
    }
  }
}
```

---

## 6. State Management

### 6.1 Data Flow

```
Daemon (bash/systemd)
    │  stdout: JSON line
    ▼
Daemon Bridge (daemon-bridge.ts)
    │  parse → stateStore.patch(widgetId, delta)
    ▼
State Store (state-store.ts)
    │  merge state → broadcast via WebSocket
    ▼
pi-widget.js SDK
    │  route by widgetId → match instanceId or global
    ▼
Widget's onState(state) handler
```

### 6.2 Writing State

Widgets can write state back to the server. This is how the notepad saves its text, and how button clicks propagate:

```js
// In a notepad widget
textarea.addEventListener('input', function() {
  widget.setState({ text: textarea.value });
});
```

The server persists this state (if `manifest.persist === true`) and can broadcast it to other listeners.

### 6.3 Canvas-Level Isolation

When the user switches from Canvas A to Canvas B:
- All widget states from Canvas A are flushed/saved
- Canvas B loads with fresh default states
- States do NOT leak between canvases

---

## 7. Error Handling

### 7.1 Error Boundary + Auto-Restart

If a widget's JavaScript throws an unhandled error:

1. The error is caught by the SDK's `try/catch` wrapper around `onState`
2. The widget area displays a subtle error icon overlay
3. After a 5-second cooldown, the engine tears down the Shadow DOM and re-injects a fresh widget instance
4. The error is logged to `widget.log()` for server-side debugging

### 7.2 Widget authors should defensively code:

```js
function onState(state) {
  // Always guard against missing data
  if (state.temperature !== undefined) {
    $('#temp').textContent = state.temperature + '°C';
  }
}
```

---

## 8. Network Access

### 8.1 Proxied Fetch

Widgets use `widget.fetch()` instead of raw `fetch()`. This proxies through the Bun server, avoiding CORS issues and allowing the engine to enforce the `network[]` allowlist:

```js
// In manifest.json: "network": ["api.openweathermap.org"]

async function fetchWeather() {
  var res = await widget.fetch('https://api.openweathermap.org/data/2.5/weather?q=Kanpur');
  var data = await res.json();
  onState({ temperature: data.main.temp, condition: data.weather[0].main });
}
```

### 8.2 Permission Model

| Widget Source | Network Rules |
|---|---|
| Local (`widgets/` folder) | Unrestricted — all domains allowed |
| Marketplace (downloaded `.zip`) | MUST declare `network[]` in manifest; only listed domains allowed |

---

## 9. Developer Tooling

### 9.1 Widget Dev Server

```bash
bun run widget:dev <widget-id>
```

This spins up a minimal development harness at `http://localhost:3001` with:

- **Live preview** of the widget in an isolated Shadow DOM container
- **Mock data injection** panel — paste or edit JSON to simulate `onState` calls
- **Config editor** sidebar — auto-generated from `configSchema` in manifest
- **Manual refresh** button to reload the widget after file changes
- **Console output** panel showing `widget.log()` messages

### 9.2 Mock State File

Place a `mock-state.json` in your widget folder for automatic dev data:

```json
{
  "temperature": 38,
  "condition": "Sunny",
  "humidity": 45,
  "wind": 15
}
```

---

## 10. Performance Guidelines

> These are soft guidelines. The engine does NOT enforce them at runtime.

| Guideline | Recommendation |
|---|---|
| Fragment total size | < 50KB (HTML + CSS + JS combined) |
| `setInterval` timers | ≤ 2 active timers; always clear in `widget.destroy()` |
| DOM operations | Batch updates; avoid layout thrashing |
| External CDN loads | Avoid — inline dependencies or use `widget.fetch()` |
| CSS animations | Prefer `transform` and `opacity` (GPU-accelerated) |
| Images | Compress to WebP; keep under 100KB per image |
| Memory | Target < 5MB per widget instance in heap |
| Shadow DOM queries | Cache `$()` results in variables; don't query on every frame |

---

## 11. Complete Widget Example

### `widgets/weather/manifest.json`
```json
{
  "id": "weather",
  "name": "Weather",
  "sdkVersion": "1.0",
  "category": "system",
  "icon": "☀️",
  "version": "1.0.0",
  "author": "PiDashboard Team",
  "preview": "preview.png",
  "refreshRate": 600,
  "persist": false,
  "stateMode": "global",
  "fragment": { "file": "weather.html" },
  "configSchema": {
    "city": { "type": "string", "label": "City", "default": "Kanpur" },
    "units": { "type": "select", "label": "Units", "options": ["celsius", "fahrenheit"], "default": "celsius" }
  },
  "network": ["api.openweathermap.org"],
  "daemon": {
    "command": "./scripts/weather-daemon.sh",
    "args": ["--city", "{{ config.city }}"]
  }
}
```

### `widgets/weather/weather.html`
```html
<style>
  :host { display: block; width: 100%; height: 100%; }
  .card {
    background: var(--pi-bg-surface, rgba(30,136,229,0.8));
    border-radius: var(--pi-radius, 16px);
    color: var(--pi-text-primary, white);
    font-family: var(--pi-font, 'Inter', sans-serif);
    padding: 24px;
    width: 100%; height: 100%;
    box-sizing: border-box;
  }
  .temp { font-size: 72px; font-weight: 800; }
  .unit { font-size: 32px; opacity: 0.8; }
  .condition { font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
</style>

<div class="card">
  <div>
    <span class="temp" id="temp">--</span>
    <span class="unit" id="unit">°C</span>
  </div>
  <div class="condition" id="cond">Loading...</div>
</div>

<script>
  // Read config injected by the compositor
  var units = widget.config.units || 'celsius';
  $('#unit').textContent = units === 'celsius' ? '°C' : '°F';

  function onState(state) {
    if (state.temperature !== undefined) {
      $('#temp').textContent = Math.round(state.temperature);
    }
    if (state.condition) {
      $('#cond').textContent = state.condition;
    }
  }

  // Cleanup example
  var refreshTimer = setInterval(function() {
    widget.log('Weather tick');
  }, 60000);

  widget.destroy(function() {
    clearInterval(refreshTimer);
  });

  // Hydrate from existing state on load
  if (widget.state && widget.state.temperature !== undefined) {
    onState(widget.state);
  }
</script>
```
