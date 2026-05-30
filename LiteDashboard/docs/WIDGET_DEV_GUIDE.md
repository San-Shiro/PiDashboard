# Widget Development Guide

> Build beautiful, self-contained widgets for PiDashboard's kiosk display.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Widget Types](#widget-types)
3. [Directory Structure](#directory-structure)
4. [Manifest Reference](#manifest-reference)
5. [Fragment HTML](#fragment-html)
6. [SDK API](#sdk-api)
7. [Config Schema](#config-schema)
8. [Canvas Themes](#canvas-themes)
9. [Daemon Integration](#daemon-integration)
10. [Examples](#examples)

---

## Quick Start

Create a widget in 3 steps:

```bash
# 1. Create widget folder
mkdir widgets/my-widget

# 2. Create manifest.json
# 3. Create the HTML fragment
```

**manifest.json**
```json
{
  "id": "my-widget",
  "name": "My Widget",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "A short description",
  "category": "General",
  "icon": "star",
  "tier": "native",
  "estimatedRamMb": 1,
  "trust": "verified",
  "permissions": { "network": false, "disk": false },
  "fragment": { "file": "my-widget.html", "format": "snippet" },
  "configSchema": [],
  "stateMode": "global",
  "persist": false,
  "defaults": { "width": 300, "height": 200 }
}
```

**my-widget.html**
```html
<style>
  .container {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-family: system-ui, sans-serif;
    color: var(--canvas-text);
    background: var(--canvas-surface);
    border-radius: 12px;
  }
</style>

<div class="container">
  <h1>Hello from My Widget!</h1>
</div>

<script>
(function() {
  // Widget is ready
  console.log('My widget loaded:', PiWidget.instanceId);
})();
</script>
```

Save, restart the server, and your widget appears in the admin panel's Widget Registry.

---

## Widget Types

### Standalone (No Daemon)
Runs entirely in the browser. Great for:
- Clocks, timers, calendars
- Greeting banners, quotes
- Photo frames, slideshows
- Any widget using browser APIs (Date, Canvas, etc.)

**No daemon field in manifest.**

### Daemon-Powered
Receives live data from a background process (systemd service, cron script, etc.) that writes JSON to `/tmp/widgets/{daemon_name}.json`. The server watches these files and pushes updates via WebSocket.

Great for:
- System stats (CPU, RAM, disk)
- Weather data (fetched server-side)
- Music player state (MPD, Spotify)
- IoT sensor readings

**Add `"daemon": "daemon_name"` to manifest.**

---

## Directory Structure

```
widgets/
  my-widget/
    manifest.json        # Required — widget metadata & config schema
    my-widget.html       # Required — single-file HTML fragment
    preview.png          # Optional — screenshot for admin panel
```

### Single-File vs Multi-File Fragments

**Single-file** (recommended for most widgets):
```json
"fragment": { "file": "my-widget.html", "format": "snippet" }
```

**Multi-file** (for complex widgets):
```json
"fragment": {
  "template": "template.html",
  "style": "style.css",
  "script": "script.js"
}
```

---

## Manifest Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier (lowercase, hyphens) |
| `name` | string | ✅ | Human-readable display name |
| `version` | string | ✅ | Semver version string |
| `author` | string | ✅ | Widget author name |
| `description` | string | ✅ | Short description for admin panel |
| `category` | string | ✅ | Category for filtering (Time, Weather, System, Media, etc.) |
| `icon` | string | ✅ | Lucide icon name (e.g. `clock`, `cpu`, `cloud-sun`) |
| `tier` | string | ✅ | Always `"native"` |
| `estimatedRamMb` | number | ✅ | Estimated RAM usage in MB |
| `trust` | string | ✅ | `"core"`, `"verified"`, or `"community"` |
| `permissions` | object | ✅ | `{ network: bool, disk: bool }` |
| `fragment` | object | ✅ | Fragment file reference (see above) |
| `configSchema` | array | ✅ | Array of config field definitions |
| `stateMode` | string | ✅ | `"global"` (shared state) or `"instance"` (per-instance) |
| `persist` | boolean | ✅ | Whether widget state persists across restarts |
| `daemon` | string | ❌ | Name of daemon that provides data |
| `defaults` | object | ❌ | `{ width, height }` — default size when added to canvas |

### Trust Levels

| Level | Description | Shadow DOM |
|-------|-------------|------------|
| `core` | Built-in PiDashboard widgets | ✅ Isolated |
| `verified` | Reviewed community widgets | ✅ Isolated |
| `community` | Unreviewed third-party widgets | ❌ Not isolated |

---

## Fragment HTML

Widgets render inside a positioned `<div>` container on the kiosk display. The compositor:

1. Reads your HTML fragment
2. Wraps it in a container div with absolute positioning
3. Applies layout properties (x, y, width, height, opacity, z-index, border-radius)
4. Isolates it in Shadow DOM (for `core` and `verified` trust levels)

### Rules

- **Self-contained**: No external dependencies. Inline all CSS and JS.
- **No `<html>`, `<head>`, `<body>`**: Your fragment is injected into an existing page.
- **Responsive**: Fill `100%` width and height of your container.
- **No `document.write()`**: Shadow DOM doesn't support it.
- **Use `$()` helper**: Instead of `document.querySelector()`, use the injected `$()` which scopes to your widget.

### Template Variables

The compositor replaces `{{ config.keyName }}` in your HTML/JS with the widget instance's config values:

```html
<div style="color: {{ config.textColor }}">
  Hello, {{ config.userName }}!
</div>
```

---

## SDK API

Every widget gets access to the `PiWidget` global object:

### Properties

```javascript
PiWidget.instanceId   // Unique instance ID (UUID)
PiWidget.widgetType   // Widget type ID (e.g. "my-widget")
PiWidget.config       // Current config values from the admin panel
PiWidget.context      // { timezone: "Asia/Kolkata" }
```

### Methods

```javascript
// Subscribe to daemon data updates
PiWidget.onState(function(state) {
  // state = parsed JSON from /tmp/widgets/{daemon}.json
  console.log('New data:', state);
});

// Clean up when widget is removed
PiWidget.destroy(function() {
  clearInterval(myTimer);
});
```

### Helper: `$(selector)`

Scoped query selector — finds elements only within your widget:

```javascript
var el = $(".temperature");
el.textContent = "25°C";
```

---

## Config Schema

Define configurable fields in `configSchema`. These render as form controls in the admin panel's widget edit panel.

### Field Types

| Type | Renders As | Extra Props |
|------|-----------|-------------|
| `text` | Text input | `placeholder`, `hint` |
| `number` | Number input | `min`, `max`, `step` |
| `boolean` | Toggle switch | — |
| `select` | Dropdown | `options: [{ label, value }]` |
| `radio` | Radio buttons | `options: [{ label, value }]` |
| `color` | Color picker | — |
| `slider` | Range slider | `min`, `max`, `step`, `unit` |
| `file` | Media file picker | `accept` (mime types) |

### Example

```json
"configSchema": [
  {
    "key": "location",
    "type": "text",
    "label": "City",
    "placeholder": "e.g. New York",
    "default": "London"
  },
  {
    "key": "units",
    "type": "radio",
    "label": "Temperature Units",
    "options": [
      { "label": "Celsius", "value": "C" },
      { "label": "Fahrenheit", "value": "F" }
    ],
    "default": "C"
  },
  {
    "key": "refreshRate",
    "type": "slider",
    "label": "Refresh Interval",
    "min": 5,
    "max": 60,
    "step": 5,
    "unit": "min",
    "default": 15
  },
  {
    "key": "showIcon",
    "type": "boolean",
    "label": "Show weather icon",
    "default": true
  },
  {
    "key": "bgImage",
    "type": "file",
    "label": "Background Image",
    "accept": "image/*"
  }
]
```

### Conditional Fields

Show a field only when another field has a specific value:

```json
{
  "key": "customColor",
  "type": "color",
  "label": "Custom color",
  "showIf": { "key": "theme", "value": "custom" }
}
```

---

## Canvas Themes

Canvas themes inject CSS custom properties into the kiosk display. **All widgets should use these variables** so they adapt to the user's chosen theme.

### Available Variables

| Variable | Purpose | Default (Midnight) |
|----------|---------|-------------------|
| `--canvas-bg` | Page background | `#0a0a0a` |
| `--canvas-text` | Primary text color | `#e0e0e0` |
| `--canvas-accent` | Accent / highlight color | `#6366f1` |
| `--canvas-surface` | Card / panel backgrounds | `#1a1a2e` |
| `--canvas-border` | Borders and dividers | `#2a2a3e` |
| `--canvas-muted` | Muted / secondary text | `#888888` |

### Using Theme Variables

```css
.my-widget {
  color: var(--canvas-text);
  background: var(--canvas-surface);
  border: 1px solid var(--canvas-border);
}

.my-widget h1 {
  color: var(--canvas-accent);
}

.my-widget .subtitle {
  color: var(--canvas-muted);
}
```

### Built-in Themes

| Theme | Background | Accent | Vibe |
|-------|-----------|--------|------|
| Midnight | `#0a0a0a` | `#6366f1` | Deep dark purple |
| Arctic | `#f0f4f8` | `#3b82f6` | Clean light blue |
| Forest | `#0d1f0d` | `#4caf50` | Dark green nature |
| Sunset | `#1a0a0a` | `#ff6b35` | Warm orange dark |
| Ocean | `#0a1628` | `#06b6d4` | Deep blue cyan |
| Rosé | `#1a0f14` | `#f43f5e` | Dark pink |
| Amber Glow | `#12100e` | `#f59e0b` | Warm amber dark |

Users can also create **custom themes** from the canvas settings panel.

---

## Daemon Integration

For widgets that need server-side data (weather API, system stats, hardware sensors), use the daemon pattern.

### How It Works

```
┌─────────────┐     writes JSON      ┌──────────────────────┐
│   Daemon     │────────────────────► │  /tmp/widgets/       │
│  (systemd)   │                      │  weather.json        │
└─────────────┘                       └──────────┬───────────┘
                                                 │ Bun watches
                                                 ▼
                                      ┌──────────────────────┐
                                      │   WebSocket push     │
                                      │   to kiosk browser   │
                                      └──────────┬───────────┘
                                                 │
                                                 ▼
                                      ┌──────────────────────┐
                                      │   PiWidget.onState() │
                                      │   callback in widget │
                                      └──────────────────────┘
```

### Daemon JSON Format

Write a JSON file to `/tmp/widgets/{daemon_name}.json`:

```json
{
  "temperature": 25.3,
  "humidity": 60,
  "condition": "Partly Cloudy",
  "icon": "cloud-sun",
  "updated_at": "2026-05-30T12:00:00Z"
}
```

### Manifest Setup

```json
{
  "daemon": "weather",
  "stateMode": "global"
}
```

### Widget Code

```html
<script>
(function() {
  PiWidget.onState(function(state) {
    if (!state) return;
    $(".temperature").textContent = state.temperature + "°C";
    $(".condition").textContent = state.condition;
  });
})();
</script>
```

### Creating a Daemon

Daemons are typically bash scripts or Python scripts run as systemd services:

```bash
#!/bin/bash
# daemons/weather.sh
while true; do
  # Fetch weather data
  DATA=$(curl -s "https://api.wttr.in/London?format=j1")
  
  # Write to tmpfs
  echo "$DATA" | python3 -c "
import json, sys
d = json.load(sys.stdin)
c = d['current_condition'][0]
print(json.dumps({
    'temperature': int(c['temp_C']),
    'humidity': int(c['humidity']),
    'condition': c['weatherDesc'][0]['value'],
}))
" > /tmp/widgets/weather.json
  
  sleep 300  # Update every 5 minutes
done
```

### Systemd Service

```ini
[Unit]
Description=PiDashboard Weather Daemon

[Service]
Type=simple
ExecStart=/path/to/daemons/weather.sh
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Examples

### Example 1: Standalone Widget — Digital Clock

```
widgets/clock/
  manifest.json
  clock.html
```

**manifest.json**
```json
{
  "id": "clock",
  "name": "Digital Clock",
  "version": "1.0.0",
  "author": "PiDashboard",
  "description": "A simple digital clock",
  "category": "Time",
  "icon": "clock",
  "tier": "native",
  "estimatedRamMb": 1,
  "trust": "verified",
  "permissions": { "network": false, "disk": false },
  "fragment": { "file": "clock.html", "format": "snippet" },
  "configSchema": [
    { "key": "showSeconds", "type": "boolean", "label": "Show Seconds", "default": true }
  ],
  "stateMode": "instance",
  "persist": false,
  "defaults": { "width": 300, "height": 120 }
}
```

**clock.html**
```html
<style>
  .clock {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-family: 'SF Mono', 'Cascadia Code', monospace;
    font-size: clamp(20px, 5vw, 48px);
    font-weight: 200;
    color: var(--canvas-text);
    letter-spacing: 2px;
  }
</style>

<div class="clock" id="time"></div>

<script>
(function() {
  var showSec = PiWidget.config.showSeconds !== false;
  function tick() {
    var now = new Date();
    var h = now.getHours().toString().padStart(2, '0');
    var m = now.getMinutes().toString().padStart(2, '0');
    var s = now.getSeconds().toString().padStart(2, '0');
    $('#time').textContent = showSec ? h + ':' + m + ':' + s : h + ':' + m;
  }
  tick();
  var t = setInterval(tick, 1000);
  PiWidget.destroy(function() { clearInterval(t); });
})();
</script>
```

### Example 2: Daemon-Powered Widget — System Stats

```
widgets/sysinfo/
  manifest.json
  sysinfo.html
```

**manifest.json**
```json
{
  "id": "sysinfo",
  "name": "System Stats",
  "version": "1.0.0",
  "author": "PiDashboard",
  "description": "Shows CPU and RAM usage",
  "category": "System",
  "icon": "cpu",
  "tier": "native",
  "estimatedRamMb": 1,
  "trust": "community",
  "permissions": { "network": false, "disk": false },
  "fragment": { "file": "sysinfo.html", "format": "snippet" },
  "configSchema": [],
  "stateMode": "global",
  "daemon": "sysinfo",
  "persist": false,
  "defaults": { "width": 300, "height": 200 }
}
```

The daemon writes to `/tmp/widgets/sysinfo.json`:
```json
{
  "cpu_percent": 23.5,
  "mem_percent": 67.2,
  "mem_used_mb": 344,
  "mem_total_mb": 512,
  "temp_c": 52.1,
  "uptime_hours": 120
}
```

The widget subscribes via `PiWidget.onState()` and renders the data.

---

## Best Practices

1. **Use theme variables** — Never hardcode colors. Always use `var(--canvas-text)`, `var(--canvas-accent)`, etc.
2. **Clean up** — Use `PiWidget.destroy()` to clear intervals, remove event listeners.
3. **Responsive** — Use `clamp()`, percentage widths, and flexbox to adapt to any container size.
4. **Performance** — Prefer CSS animations over JS. Use `will-change` for animated elements.
5. **No external deps** — Keep fragments self-contained. The kiosk runs on a Pi Zero 2W with limited RAM.
6. **Test with themes** — Verify your widget looks good with multiple canvas themes (dark and light).
