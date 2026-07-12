# Widget Engine v2: Implementation Plan

> **Date:** 2026-07-09
> **Status:** Under Review
> **Scope:** Core engine standardisation for community widget ecosystem

---

## The Goal

Transform the engine so that:
- **Simple widgets** need **zero JavaScript** — just HTML + `data-bind` attributes
- **Complex widgets** get **standardised building blocks** (addons) instead of writing from scratch
- **Community authors** can create widgets safely without deep PiDashboard internals knowledge
- **All 33 existing widgets** migrate to the new standard
- **Multiple instances** of the same widget work correctly on the same page and across canvases

---

## Phase A: Declarative Binding Layer (`pi-bind.js`)

A ~2KB script injected by the compositor. When a state update arrives, it scans the widget container for `data-bind` attributes and updates the DOM automatically.

### Core Binding Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-bind="key"` | Sets `textContent` | `<span data-bind="cpu">--</span>` → `35` |
| `data-suffix="%"` | Appends suffix | → `35%` |
| `data-prefix="$"` | Prepends prefix | → `$42.50` |
| `data-format="fixed:1"` | Format number | `45.523` → `45.5` |
| `data-bind-attr="src:key"` | Sets attribute | `<img data-bind-attr="src:albumArt">` |
| `data-bind-style="prop:template"` | Templates CSS | `data-bind-style="width:progress%"` |
| `data-bind-show="key"` | Shows when truthy | Visibility toggle |
| `data-bind-hide="key"` | Hides when truthy | Inverse visibility |
| `data-bind-class="key:cls"` | Toggles class | Conditional class |
| `data-bind-list="key"` | Repeats template | List rendering |
| `data-bind-if="key"` | Conditional block | Show/hide block |

### Nested Keys: `data-bind="weather.current.temp"` (dot-notation)

### Instance Scoping
- Binding scans only within the widget container's subtree (or shadowRoot)
- Multiple instances of same widget type each get independent state dispatch
- Global dispatch (from IPC) hits all instances; instance dispatch hits only one

### Layered Complexity
1. **Layer 1: data-bind** — text, attributes, visibility, classes (zero JS)
2. **Layer 2: data-bind-list** — array rendering from JSON (zero JS)
3. **Layer 3: data-bind-if** — conditional blocks (zero JS)
4. **Layer 4: onState()** — full escape hatch for custom behaviour

Execution order per state update: auto-bind first → then onState() callback

---

## Phase B: Script Addon System

Widget authors declare addons in manifest.json: `"addons": ["pi-buttons", "pi-charts"]`

### Core Addon Library

| Addon | Purpose |
|-------|---------|
| `pi-buttons` | Safe daemon commands via `data-cmd="daemon:action"` attributes |
| `pi-charts` | Bar, line, gauge, sparkline from JSON arrays |
| `pi-animations` | Fade, slide, pulse, marquee via attributes |
| `pi-format` | Date/time, relative time, file size formatting |
| `pi-theme` | Canvas theme access, auto-color helpers (REQUIRED for all widgets) |

### pi-theme (Required)
Theme is a colour management system. Widgets inherit canvas-level theme variables and can override per-instance. Ensures visual consistency across the dashboard.

### Addon Registration API
```javascript
PiWidget.registerAddon('pi-buttons', {
  init(container, config) { /* setup */ },
  destroy(container) { /* cleanup */ }
});
```

### Decision: pi-animations
Animation logic can be complex. Consider keeping simple animations (fade, marquee) in the addon and delegating complex custom animations to onState() handlers.

---

## Phase C: SDK Standardisation

1. **Kill `onData`** → Only `onState` exists
2. **Unify config access** → Always `widget.config`
3. **Add public API**: `PiWidget.cmd(daemon, payload)`, `PiWidget.getState(widgetType)`
4. **Manifest schema v2**: Add `schemaVersion: 2`, `addons` field, `permissions.commands` whitelist

---

## Phase D: Migrate Existing Widgets

| Tier | Widgets | Strategy |
|------|---------|----------|
| Zero JS | text-*, badge, icon-*, divider, line, shapes, greeting, stat-kpi | data-bind only |
| Minimal JS | daily-quote, now-playing, weather, sysinfo, network, gpio | data-bind + onState for animations |
| Addon-powered | music-player, gauges, ticker-marquee | data-bind + pi-buttons/pi-charts |
| Custom JS | clock, analog-clock, world-clock, notepad, lottie, slideshow, photo-frame | Standardise access patterns only |

---

## Phase E: Fix Compositor Script Handling

1. Replace regex extraction with proper HTML parser
2. Optional TypeScript support (`.ts` file alongside `.html`)
3. Keep HTML fragment approach for community DX

---

## Phase F: Update Roadmap

See updated ROADMAP.md (to be written after plan approval)

---

*This plan is a living document. See core-engine-analysis.md for the baseline architecture.*
