# Widget Development Guide

This guide details how to build and register custom widget fragments in PiDashboard. Widgets are completely decoupled and framework-free, designed to run with near-zero bundle overhead.

---

## 🏗️ 1. Widget Structure

Every widget package resides inside its own subdirectory under `/core/widgets/<id>/` and contains two essential components:

```
core/widgets/my-custom-widget/
├── manifest.json            # Configuration schemas and execution metadata
└── fragment/
    └── index.html           # Self-contained vanilla HTML/CSS/JS snippet
```

---

## 📝 2. The `manifest.json` Contract

The manifest defines the widget's capabilities, default layout bounds, execution tier, and dynamic configuration schema.

### Schema Fields
- **`id`**: Unique alphanumeric identifier (must match folder name).
- **`name`**: Descriptive display name shown in the layout editor.
- **`version`**: Current widget version.
- **`description`**: Brief explanation of widget functionality.
- **`tier`**: Execution tier (`1a` for client-only, `1b` for server-fetched, `2` for daemon-driven).
- **`entrypoints`**: Object specifying paths to component code files (e.g. `{"fragment": "fragment/index.html"}`).
- **`configSchema`**: Configuration variables array. The Admin Panel automatically renders corresponding UI controls (inputs, checkboxes, select menus, range sliders) for each field.

### Manifest Example (`manifest.json`)
```json
{
  "id": "countdown-timer",
  "name": "Countdown Timer",
  "version": "1.0.0",
  "description": "Displays a countdown timer to a specific calendar target date.",
  "tier": "1a",
  "entrypoints": {
    "fragment": "fragment/index.html"
  },
  "configSchema": [
    {
      "key": "targetDate",
      "label": "Target Date (YYYY-MM-DD)",
      "type": "text",
      "default": "2026-12-31"
    },
    {
      "key": "themeColor",
      "label": "Progress Color",
      "type": "select",
      "options": [
        {"label": "Vibrant Red", "value": "#ef4444"},
        {"label": "Neon Cyan", "value": "#06b6d4"},
        {"label": "Emerald Green", "value": "#10b981"}
      ],
      "default": "#06b6d4"
    },
    {
      "key": "showDaysOnly",
      "label": "Show days counter only",
      "type": "checkbox",
      "default": false
    }
  ]
}
```

---

## ✂️ 3. The `fragment/index.html` Snippet

The fragment file is a standalone snippet containing local styling, HTML nodes, and a script tag wrapped in an Immediately Invoked Function Expression (IIFE).

> [!WARNING]
> **No Global Scope Pollution:**
> Always wrap scripts in an IIFE and resolve the root component container dynamically using `document.currentScript`.

### Fragment Example (`fragment/index.html` - Tier 1a)
```html
<style>
  /* Use data-widget attribute selector to isolate widget styling entirely */
  [data-widget="countdown-timer"] .timer-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-family: 'Outfit', sans-serif;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 16px;
    box-sizing: border-box;
  }

  [data-widget="countdown-timer"] .days-number {
    font-size: 48px;
    font-weight: 800;
    line-height: 1;
    margin-bottom: 8px;
    text-shadow: 0 0 10px var(--glow-color, #06b6d4);
  }

  [data-widget="countdown-timer"] .label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.6;
  }
</style>

<div class="timer-box">
  <div class="days-number">--</div>
  <div class="label">Days Left</div>
</div>

<script>
(function() {
  // 1. Resolve root container uniquely using currentScript context
  const root = document.currentScript.closest('[data-widget]');
  const daysEl = root.querySelector('.days-number');
  
  // 2. Parse config variables passed down from active canvas dataset
  const cfg = JSON.parse(root.dataset.config || '{}');
  const targetDate = new Date(cfg.targetDate || '2026-12-31').getTime();
  
  // Apply dynamic color configuration variables
  root.style.setProperty('--glow-color', cfg.themeColor || '#06b6d4');
  daysEl.style.color = cfg.themeColor || '#06b6d4';

  function update() {
    const now = new Date().getTime();
    const distance = targetDate - now;
    
    if (distance < 0) {
      daysEl.textContent = '00';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    
    if (cfg.showDaysOnly) {
      daysEl.textContent = String(days).padStart(2, '0');
    } else {
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      daysEl.textContent = `${days}d ${hours}h`;
    }
  }

  update();
  // 3. Keep intervals bounded. Cleared automatically if page reloads
  setInterval(update, 60000);
})();
</script>
```

---

## 📡 4. Creating Tier 1b (Server-Fetched) Widgets

Tier 1b widgets perform HTTP fetches periodically. To implement a Tier 1b widget:
1. Specify `"tier": "1b"` and add `"polling": { "pollIntervalSec": 600 }` to `manifest.json`.
2. Add a `fetch/index.ts` script under your widget folder. The scheduler calls `fetchData(config)` inside this module periodically.
3. In `fragment/index.html`, register a window updater callback matching your widget ID:

```javascript
window.__widgetUpdaters = window.__widgetUpdaters || {};
window.__widgetUpdaters[root.dataset.widget] = function(data) {
  // Update your DOM nodes directly when new data push is received
  root.querySelector('.temp').textContent = data.temperature;
};
```
This is fully automated. The scheduler periodically fetches, writes the data to the RAM-disk, and the WebSocket pushes it directly to this updater callback.
