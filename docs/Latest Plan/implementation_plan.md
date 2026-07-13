# Widget Engine v2: Comprehensive Implementation Plan

## The Goal

Transform the engine so that:
- **Simple widgets** need **zero JavaScript** — just HTML + `data-bind` attributes
- **Complex widgets** get **standardised building blocks** (addons) instead of writing everything from scratch
- **Community authors** can create widgets safely without deep PiDashboard internals knowledge
- **All 33 existing widgets** migrate to the new standard
- **Multiple instances** of the same widget work correctly on the same page and across canvases

---

## Phase A: Declarative Binding Layer (`pi-bind.js`)

> *"We have to create a systematic system for this"*

### A.1 — Simple Bindings (Zero JS)

A ~2KB script (`pi-bind.js`) injected by the compositor. When a state update arrives for a widget, it scans that widget's container for `data-bind` attributes and updates the DOM automatically.

#### Core Binding Attributes

```html
<!-- Text content -->
<span data-bind="cpu">--</span>                        <!-- sets textContent to state.cpu -->

<!-- With formatting -->
<span data-bind="cpu" data-suffix="%">--</span>         <!-- "35%" -->
<span data-bind="price" data-prefix="$">--</span>       <!-- "$42.50" -->
<span data-bind="temp" data-format="fixed:1">--</span>  <!-- "45.5" -->

<!-- Attribute bindings -->
<img data-bind-attr="src:albumArt, alt:track" />         <!-- sets src and alt from state -->

<!-- CSS property bindings -->
<div data-bind-style="width:progress%; background:barColor">  <!-- templates CSS -->

<!-- Visibility -->
<div data-bind-show="isOnline">Connected</div>           <!-- display:'' when truthy -->
<div data-bind-hide="isOnline">Offline</div>             <!-- display:none when truthy -->

<!-- Class toggling -->
<div data-bind-class="playing:is-active, error:has-error">  <!-- toggles classes -->
```

#### Nested Key Access

State objects are often nested. The binding supports dot-notation:

```html
<!-- state = { weather: { current: { temp: 22 } } } -->
<span data-bind="weather.current.temp" data-suffix="°C">--</span>
```

#### Instance Scoping (Multiple Instances)

> *"There can be multiple instances of widget on same page and also on another page"*

Each widget container already has a unique `id` (the instance ID) and `data-widget` (the widget type). The binding layer **scopes all DOM scans to the container element**, not the whole document:

```javascript
// When state arrives for widget type "sysinfo":
function applyBindings(container, state) {
  // Only scans WITHIN this container (or its shadowRoot)
  const root = container.shadowRoot || container;
  root.querySelectorAll('[data-bind]').forEach(el => {
    const key = el.getAttribute('data-bind');
    const value = resolveKey(state, key); // handles dot-notation
    if (value !== undefined) {
      el.textContent = formatValue(el, value);
    }
  });
  // ... same for data-bind-attr, data-bind-style, data-bind-class, etc.
}
```

**Global vs instance dispatch** (already works in the current WS handler):
- Daemon writes to `/tmp/widgets/sysinfo.json` → broadcasts to ALL sysinfo instances
- Widget calls `widget.patchState({...})` → updates only THAT instance

### A.2 — Complex Bindings (For Complex Widgets)

> *"What if we need a complex updating system?"*

Simple `data-bind` handles 80% of cases. For the remaining 20%, the system is **layered, not exclusive**:

#### Layer 1: Declarative (data-bind) — handles text, attributes, visibility, classes
#### Layer 2: Template Repeaters — handles lists/arrays from JSON

```html
<!-- state = { tracks: [{title:"Song A", artist:"Band X"}, {title:"Song B", artist:"Band Y"}] } -->
<ul data-bind-list="tracks">
  <template>
    <li>
      <span data-bind="title">--</span>
      <span data-bind="artist" class="dim">--</span>
    </li>
  </template>
</ul>
```

The engine clones the `<template>` for each item in `state.tracks`, applying bindings within each clone. When the array changes, it diffs by index and adds/removes DOM nodes.

#### Layer 3: Conditional Blocks

```html
<!-- state = { playing: true } -->
<div data-bind-if="playing">
  <span>Now Playing</span>
</div>
<div data-bind-if="!playing">
  <span>Paused</span>
</div>
```

#### Layer 4: Custom `onState()` — full escape hatch

> *"How can we standardise without losing customisability?"*

The `onState(state)` callback still fires AFTER auto-binding completes. Widget authors can do anything custom there:

```html
<canvas id="viz"></canvas>
<script>
  // Auto-binding already updated all data-bind elements.
  // This onState only handles the truly custom canvas drawing.
  function onState(state) {
    if (!state.waveform) return;
    const ctx = $('#viz').getContext('2d');
    // ... custom canvas drawing from state.waveform array
  }
</script>
```

**Execution order per state update:**
1. Auto-binding layer applies all `data-bind` attributes → DOM updates
2. Template repeaters re-render lists → DOM updates
3. `onState(state)` callback fires → widget can do custom work on top

This means a complex widget like the music player can use `data-bind` for 90% of its fields (track title, artist, progress bar width) and only use `onState` for the one custom thing (e.g., animating vinyl disc rotation).

---

## Phase B: Script Addon System

> *"We can create script addons that other authors can inject by setting a property to include it"*

### B.1 — Addon Architecture

Addons are pre-built, security-reviewed JavaScript modules that provide standardised functionality. Widget authors declare them in `manifest.json`:

```json
{
  "id": "my-widget",
  "addons": ["pi-buttons", "pi-charts", "pi-animations"],
  "fragment": { "file": "my-widget.html", "format": "snippet" }
}
```

The compositor automatically includes the addon scripts and initialises them for each widget container.

### B.2 — Core Addon Library

| Addon | Purpose | What it provides |
|-------|---------|-----------------|
| `pi-buttons` | Standardised interactions | Safe daemon commands via HTML attributes |
| `pi-charts` | Data visualisation | Bar, line, gauge, sparkline from JSON arrays |
| `pi-animations` | Motion/transitions | Fade, slide, pulse, marquee via attributes |
| `pi-format` | Advanced formatting | Date/time, relative time, file size, etc. |
| `pi-theme` | Theme utilities | Canvas theme access, auto-color helpers |

### B.3 — `pi-buttons` Addon (Standardised Interactions)

> *"We can also create standardised scripts for creating buttons. This way we can ensure safety as well"*

Instead of writing custom JavaScript for every button:

```html
<!-- OLD (requires JS): -->
<button onclick="widget.callDaemon({action:'next'})">Next</button>

<!-- NEW (addon, no JS): -->
<button data-cmd="music-player:next">⏭ Next</button>
<button data-cmd="music-player:toggle">⏯</button>
<button data-cmd="music-player:prev">⏮ Prev</button>

<!-- With payload: -->
<button data-cmd="music-player:volume" data-payload='{"level":50}'>50%</button>

<!-- Toggle class on click (visual feedback): -->
<button data-cmd="music-player:toggle" data-toggle-class="active">⏯</button>
```

**Safety**: The addon validates `data-cmd` targets against the widget's manifest `daemon` field. A community widget cannot send commands to a daemon it doesn't own.

### B.4 — `pi-charts` Addon

```html
<!-- state = { cpuHistory: [12, 34, 56, 23, 45, 67, 34] } -->
<canvas data-chart="sparkline" data-chart-data="cpuHistory" 
        data-chart-color="var(--canvas-accent)" 
        data-chart-height="40"></canvas>

<!-- state = { disk: 65 } -->
<div data-gauge="disk" data-gauge-max="100" data-gauge-label="Disk"></div>
```

### B.5 — `pi-animations` Addon

```html
<!-- Marquee scroll when text overflows -->
<div data-animate="marquee" data-bind="track">--</div>

<!-- Fade transition on state change -->
<div data-animate="crossfade" data-bind="quote">--</div>

<!-- Pulse when value exceeds threshold -->
<span data-bind="cpu" data-animate="pulse-if" data-threshold="80">--</span>
```

### B.6 — Addon Registration API

Addons register themselves with the SDK. Community authors could even write custom addons:

```javascript
// pi-buttons.js
PiWidget.registerAddon('pi-buttons', {
  // Called once per widget container that declares this addon
  init(container, config) {
    const root = container.shadowRoot || container;
    root.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [daemon, action] = btn.dataset.cmd.split(':');
        const payload = btn.dataset.payload ? JSON.parse(btn.dataset.payload) : {};
        PiWidget.cmd(daemon, { action, ...payload });
      });
    });
  },
  // Called when widget is destroyed
  destroy(container) { /* cleanup listeners */ }
});
```

---

## Phase C: SDK Standardisation

> *"Create a plan to make this better" / "Let's standardise things here"*

### C.1 — Unify Callback Name

**Kill `onData`. Only `onState` exists.**

```diff
- if (api.onData) _stateHandlers.push(...); // fallback during migration
+ // onData is removed. Only onState is supported.
```

Migration: `grep -r "onData" widgets/` → rename all to `onState`. It's the same pipeline internally.

### C.2 — Unify Config Access

**One way to access config: `widget.config`.**

The compositor already injects `var widget = { config: ... }`. Remove the old `PiWidget.config` pattern.

```diff
- var cfg = (typeof PiWidget !== 'undefined' && PiWidget.config) || (typeof config !== 'undefined' ? config : {});
+ var cfg = widget.config;
```

### C.3 — Public SDK API (add `PiWidget.cmd()`)

Currently, sending daemon commands requires `widget.callDaemon()` which is only available inside the IIFE. Add a public method:

```javascript
// New public API:
PiWidget.cmd(daemon, payload)  // Send command to daemon
PiWidget.getState(widgetType)  // Get current cached state for a widget type
```

This lets `pi-buttons` addon and `onclick` handlers work without access to the IIFE-scoped `widget` object.

### C.4 — Standardise Manifest Schema v2

```json
{
  "schemaVersion": 2,
  "id": "my-widget",
  "name": "My Widget",
  "version": "1.0.0",
  "author": "Community Author",
  
  "trust": "community",
  "tier": "push",
  
  "fragment": { "file": "my-widget.html", "format": "snippet" },
  "daemon": "my-daemon",
  "dataChannel": { "type": "ipc_file", "ipcFilename": "my-daemon.json" },
  
  "addons": ["pi-buttons", "pi-charts"],
  
  "configSchema": [...],
  
  "defaults": { "width": 300, "height": 200 },
  "stateMode": "global",
  "persist": false,
  
  "resources": {
    "externalFonts": [],
    "estimatedRamKB": 50
  },
  "permissions": {
    "network": false,
    "persistence": false,
    "commands": ["toggle", "next", "prev"]
  }
}
```

New fields:
- `schemaVersion: 2` — for backward-compat detection
- `addons` — declared addon dependencies
- `permissions.commands` — whitelist of daemon commands this widget can send (safety)

---

## Phase D: Migrate Existing Widgets

> *"We can update the current widgets to use the standardised way"*

### Migration Tiers

| Tier | Widgets | Strategy |
|------|---------|----------|
| **Zero JS** (remove all script) | text-basic, text-title, text-paragraph, badge-label, icon-basic, icon-text-info, divider-basic, line-basic, shape-rectangle, shape-oval, shape-polygon, pen-shape, greeting, stat-kpi-card | Replace script with `data-bind` attributes only |
| **Minimal JS** (keep onState for 1-2 custom things) | daily-quote (crossfade animation), now-playing (marquee), weather, sysinfo, network-info, gpio-display | Use `data-bind` for text/values, keep `onState` only for animations |
| **Addon-powered** (use pi-buttons, pi-charts) | music-player (buttons), gauges (charts), ticker-marquee-text (animations) | Replace custom JS with addon attributes |
| **Custom JS** (keep script, just standardise access patterns) | clock (self-timer), analog-clock, world-clock, notepad (bidirectional), lottie, image-slideshow, photo-frame, quote-callout | Standardise to `widget.config` + `onState` naming only |

### Example Migration: sysinfo

**Before** (current — 131 lines of JS):
```html
<div id="sys-card">...</div>
<script>
  var config = ...;
  function onData(data) {
    if (data.cpu !== undefined) {
      $('#cpu-val').textContent = data.cpu + '%';
      $('#cpu-bar').style.transform = 'scaleX(' + (data.cpu / 100) + ')';
      // ... 40 more lines
    }
  }
</script>
```

**After** (v2 — 0 lines of JS):
```html
<div class="sys-card">
  <div class="metric">
    <span class="label">CPU</span>
    <span data-bind="cpu" data-suffix="%" class="value">--</span>
    <div class="bar"><div data-bind-style="transform:scaleX({{cpu/100}})" class="fill"></div></div>
  </div>
  <div class="metric">
    <span class="label">RAM</span>
    <span data-bind="ram" data-suffix="%" class="value">--</span>
    <div class="bar"><div data-bind-style="transform:scaleX({{ram/100}})" class="fill"></div></div>
  </div>
  <div class="metric">
    <span class="label">Temp</span>
    <span data-bind="temp" data-suffix="°C" data-format="fixed:1" class="value">--</span>
  </div>
  <div class="metric">
    <span class="label">Uptime</span>
    <span data-bind="uptime" data-format="duration" class="value">--</span>
  </div>
</div>

<style>/* ... pure CSS, no changes needed ... */</style>
<!-- No <script> tag at all -->
```

### Example Migration: weather (fix the self-fetch violation)

Currently the weather widget fetches its own data via HTTP. This violates the "dumb template" vision.

**Fix**: Create a `weather-fetcher.sh` daemon (or Node/Python script) that:
1. Reads the widget's config (location, units) from the canvas JSON
2. Fetches weather data from the API
3. Writes to `/tmp/widgets/weather.json`

The weather widget becomes a pure `push` tier template with `data-bind` attributes. No more HTTP calls from the kiosk browser.

---

## Phase E: Fix Compositor Script Handling

> *"No TypeScript support in widget code — let's standardise"*

### E.1 — Keep HTML Fragments (Don't Switch to ES Modules Yet)

The HTML fragment approach is what makes widgets accessible to community authors. Someone can write a widget in a single `.html` file with `<style>` + `data-bind` attributes and zero JavaScript. **This is the killer DX feature.** Don't lose it.

### E.2 — Fix the Regex Extraction

Replace the fragile regex with a proper HTML parser (Bun has `HTMLRewriter` or we can use a lightweight parser):

```typescript
// Instead of regex:
// const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;

// Use proper parsing:
import { parseHTML } from 'linkedom'; // or Bun's built-in
function separateFragmentScript(html: string) {
  const { document } = parseHTML(html);
  const scripts = document.querySelectorAll('script');
  // ...
}
```

### E.3 — TypeScript Widget Support (Optional, Additive)

For authors who want TypeScript, support an optional `.ts` file alongside the fragment:

```
widgets/my-widget/
  ├── my-widget.html        # Visual template (required)
  ├── my-widget.ts           # Optional TypeScript logic
  └── manifest.json
```

The build step (if present) compiles `.ts` → `.js` and the compositor injects the compiled JS. But the `.html`-only path still works for simple widgets.

---

## Phase F: Update Roadmap

> *"Fix the roadmap"*

### Proposed Updated Roadmap

```markdown
# PiDashboard Roadmap

## Milestone 1: Core Infrastructure (COMPLETE)
- [x] Phase 1: Canvas Config Schema, Validators, Compositor Engine
- [x] Phase 2: IPC tmpfs Watcher, State Store, WebSocket Pipeline
- [x] Phase 3: PiWidget SDK, Frame Loop, State Dispatch
- [x] Phase 4: Bun Server, HTTP Router, API Routes
- [x] Phase 5: Admin Panel (React 18 + Tailwind + Vite)
- [x] Phase 6: Auth System (Argon2, Cookie Sessions)
- [x] Phase 7: Widget Library (33 widgets, 4 bash daemons)

## Milestone 2: Widget Engine v2 — Standardisation ← WE ARE HERE
- [ ] Phase 8: Declarative Binding Layer (pi-bind.js)
- [ ] Phase 9: SDK Standardisation (unify onState, config, public API)
- [ ] Phase 10: Script Addon System (pi-buttons, pi-charts, pi-animations)
- [ ] Phase 11: Migrate Existing Widgets to v2 Patterns
- [ ] Phase 12: Fix Compositor Script Handling (proper parser)
- [ ] Phase 13: Convert Self-Fetching Widgets to Push Pattern (weather → daemon)

## Milestone 3: Community & Polish
- [ ] Phase 14: Widget Developer Guide & Template
- [ ] Phase 15: Widget Validator v2 (security audit for community widgets)
- [ ] Phase 16: Testing Harness (CLI tools, smoke tests)
- [ ] Phase 17: Documentation Overhaul (API ref, troubleshooting)
```

---

## Execution Order

> [!IMPORTANT]
> Phases 8 and 9 are the foundation — everything else depends on them.

```
Phase 8 (pi-bind.js)  ──┐
Phase 9 (SDK cleanup) ──┼──→ Phase 10 (Addons) ──→ Phase 11 (Migrate widgets)
                         │                         Phase 13 (Weather daemon)
                         └──→ Phase 12 (Compositor fix)
```

### Phase 8 deliverables:
1. `core/sdk/pi-bind.js` — the binding layer (~2KB)
2. Update compositor to inject `pi-bind.js` after `pi-widget.js`
3. Update `_dispatchState` to call binding layer BEFORE `onState` callbacks
4. Unit tests for all binding attributes
5. One widget fully converted as proof (e.g., sysinfo → zero JS)

### Phase 9 deliverables:
1. Remove `onData` from SDK, update all widgets to `onState`
2. Remove dual config access, standardise to `widget.config`
3. Add `PiWidget.cmd(daemon, payload)` public API
4. Add `PiWidget.getState(widgetType)` public API
5. Update all widgets to new patterns

### Phase 10 deliverables:
1. Addon registration system (`PiWidget.registerAddon`)
2. `pi-buttons.js` addon with `data-cmd` attributes
3. `pi-animations.js` addon with `data-animate` attributes
4. `pi-charts.js` addon with `data-chart` and `data-gauge` attributes
5. Manifest `addons` field support in compositor
6. Permission enforcement (command whitelisting)

---

## Open Questions

> [!IMPORTANT]
> **Expression evaluation in `data-bind-style`**: Should `data-bind-style="width:{{cpu/100}}%"` support division? Or should the daemon pre-compute percentage values? Pre-computing in the daemon is simpler and safer (no eval), but less flexible for the widget author.

> [!IMPORTANT]
> **List diffing strategy for `data-bind-list`**: Should we diff by index (simple, O(n)), by a `data-key` attribute (smarter, handles reordering), or just replace all children on every update (simplest, might flicker)?

> [!IMPORTANT]
> **Community addon safety**: Should community authors be allowed to create and distribute custom addons? Or should addons be limited to the official `pi-*` set? Custom addons would need a review/trust system.
