# PiDashboard Core Engine: Reality vs Vision

## Your Vision (Restated)

> **Widgets are dumb visual templates.** Their content is driven entirely by a JSON state file.
> **Scripts are smart producers.** They do the heavy lifting (API calls, hardware reads, computations) in any language, then write a JSON file.
> **The engine bridges the two.** When the JSON file changes, the widget's DOM updates automatically.
> **Community story:** Anyone can create a widget — write an HTML skin + a script in Python/Go/Bash/Rust/whatever.

---

## What Already Works (The Pipeline is Solid)

The good news: the **data pipeline** from "script writes JSON" to "browser receives it" is fully built and working.

```
Daemon (any language) writes /tmp/widgets/sysinfo.json
  → fs.watch detects (50ms debounce)
  → tmpfs-watcher parses JSON → stateStore.patch() (deep merge, 50KB cap)
  → WS broadcast (150ms debounce) → { type: "state", widget: "sysinfo", data: {...} }
  → Browser: PiWidget._dispatchState("sysinfo", "global", data)
  → Widget's onState(data) fires
```

**Working examples of this pattern today:**

| Widget | Daemon | IPC File | Pattern |
|--------|--------|----------|---------|
| sysinfo | systemd service | `sysinfo.json` | `onData(data)` → manual DOM writes |
| daily-quote | `daily-quote.sh` | `daily-quote.json` | `onState(state)` → manual DOM writes |
| now-playing | media daemon | `now-playing.json` | `onState(state)` → manual DOM writes |
| music-player | `music-player.sh` | `music-player.json` | `onState(state)` → manual DOM writes + `callDaemon()` for commands |
| network-info | `network-info.sh` | `network.json` | Push pattern |
| gpio-display | `gpio-daemon.sh` | `gpio.json` | Push pattern |

**4 bash daemons already exist.** The "write JSON from any language" pattern is proven.

---

## What's Broken: The "Last Mile" Problem

The pipeline gets JSON to the browser perfectly. **The problem is what happens next.** Every single widget has to manually write JavaScript to bridge JSON → DOM. This is the bottleneck for community widget authors.

### Problem 1: Every Widget Requires Manual DOM Manipulation

Here's what the `sysinfo` widget does when it receives JSON:

```javascript
// sysinfo receives: {"cpu":35,"ram":43,"temp":45.5,"disk":65,"uptime":5253}
function onData(data) {
  if (data.cpu !== undefined) {
    $('#cpu-val').textContent = data.cpu + '%';
    $('#cpu-bar').style.transform = 'scaleX(' + (data.cpu / 100) + ')';
    $('#cpu-bar').style.backgroundColor = data.cpu > 80 ? accentColor : barColor;
  }
  if (data.ram !== undefined) {
    $('#ram-val').textContent = data.ram + '%';
    $('#ram-bar').style.transform = 'scaleX(' + (data.ram / 100) + ')';
  }
  if (data.temp !== undefined) {
    $('#temp-val').textContent = data.temp + '°C';
    // ... more manual style calculations
  }
  // ... 40+ more lines of this
}
```

**For a "dumb template" vision, this is way too much JavaScript.** A community author who just wants to show `cpu: 35%` shouldn't need to write 100+ lines of DOM manipulation code.

### Problem 2: Inconsistent Widget Patterns

The codebase has **three competing patterns** for how widgets get their data:

| Pattern | Widgets | Aligns with Vision? |
|---------|---------|-------------------|
| **Push (IPC → onState)** | sysinfo, daily-quote, now-playing, music-player | ✅ Yes |
| **Self-fetch (HTTP polling)** | weather (fetches `/weather/current`) | ❌ No — widget does its own API calls |
| **Self-driven (timers)** | clock (internal `setInterval`) | ⚠️ Partially — no external data needed |

The weather widget is the clearest violation: it has an IPC file (`tmp_widgets/weather.json`) that exists but **the widget ignores it** and does its own HTTP fetch instead.

### Problem 3: Two Competing Callback Names

```javascript
// Some widgets use:
function onData(data) { ... }   // sysinfo

// Others use:
function onState(state) { ... } // now-playing, notepad, daily-quote
```

Both route through the same `_stateHandlers` array in the SDK. This is confusing for community authors — which one do I use?

### Problem 4: Two Competing Config Access Patterns

```javascript
// Pattern A (clock, weather):
var cfg = (typeof PiWidget !== 'undefined' && PiWidget.config) || 
          (typeof config !== 'undefined' ? config : {});

// Pattern B (now-playing, notepad):
widget.config.showAlbumArt
```

### Problem 5: The Compositor's Script Extraction is Fragile

The compositor uses a **regex** to rip `<script>` tags out of HTML fragments, then injects the script content into a giant string-template IIFE. This means:
- No TypeScript support in widget code
- No ES modules / `import` statements
- Error stack traces point to generated blobs, not source files
- Multi-script fragments only extract the **last** `<script>` tag

---

## The Gap: What's Missing for the "Dumb Template" Vision

The single biggest missing piece is a **declarative data-binding layer**. Today, the engine delivers JSON to the widget, but the widget has to manually apply every field to the DOM. 

### What a simple widget SHOULD look like (zero JS):

```html
<!-- Widget: CPU Monitor -->
<div class="card">
  <h3>CPU</h3>
  <span data-bind="cpu" data-suffix="%">--</span>
  <div class="bar">
    <div class="fill" data-style="width: {{cpu}}%"></div>
  </div>
</div>

<style>
  .card { background: var(--canvas-surface); padding: 16px; border-radius: 12px; }
  .bar { height: 4px; background: #333; border-radius: 2px; }
  .fill { height: 100%; background: var(--canvas-accent); transition: width 0.3s; }
</style>
```

**No `<script>` tag at all.** The engine reads `data-bind="cpu"`, and when `{"cpu": 35}` arrives over WebSocket, it sets the element's `textContent` to `35%`. The `data-style` attribute templates CSS properties.

### What a complex widget SHOULD look like (minimal JS):

```html
<!-- Widget: Music Player (interactive) -->
<div class="player">
  <img data-bind-src="albumArt" data-bind-alt="track" />
  <div data-bind="track" class="title">--</div>
  <div data-bind="artist" class="artist">--</div>
  <div class="bar">
    <div class="progress" data-style="width: {{progress}}%"></div>
  </div>
  <button onclick="PiWidget.cmd('music-player', 'prev')">⏮</button>
  <button onclick="PiWidget.cmd('music-player', 'toggle')">⏯</button>
  <button onclick="PiWidget.cmd('music-player', 'next')">⏭</button>
</div>

<script>
  // ONLY needed for truly custom behavior (formatting, conditionals, animations)
  function onState(state) {
    if (state.playing) {
      $('.title').classList.add('marquee');
    }
  }
</script>
```

90% of the DOM updates are handled automatically by `data-bind`. The `<script>` only handles the edge case (adding a CSS animation class).

---

## Proposed Engine Enhancement: Declarative Binding Layer

A thin (~2KB) client-side script that the compositor injects, sitting between the WebSocket and the DOM.

### Binding Attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-bind="key"` | Sets `textContent` to `state[key]` | `<span data-bind="cpu">` → `35` |
| `data-bind="key" data-suffix="%"` | Appends suffix | → `35%` |
| `data-bind="key" data-prefix="$"` | Prepends prefix | → `$42.50` |
| `data-bind="key" data-format="fixed:1"` | Format number | `45.523` → `45.5` |
| `data-bind-src="key"` | Sets `src` attribute | `<img data-bind-src="albumArt">` |
| `data-bind-class="key"` | Toggles class based on truthy value | `data-bind-class="playing:is-active"` |
| `data-bind-show="key"` | Shows/hides element | `data-bind-show="isOnline"` |
| `data-bind-hide="key"` | Inverse of show | `data-bind-hide="isOffline"` |
| `data-style="prop: {{key}}"` | Templates inline CSS | `data-style="width: {{progress}}%"` |
| `data-bind-html="key"` | Sets `innerHTML` (sanitized) | For pre-formatted content |

### How it works (engine-side):

```
State update arrives via WebSocket
  → PiWidget._dispatchState("sysinfo", "global", { cpu: 35, ram: 43 })
  → FIRST: Auto-binding layer scans container for data-bind attributes
     → finds <span data-bind="cpu"> → sets textContent to "35%"  
     → finds <div data-style="width: {{cpu}}%"> → sets style.width to "35%"
  → THEN: If widget registered an onState handler, call it too
     → Widget JS can do additional custom logic (animations, conditionals)
```

### What this changes for community authors:

| Complexity Level | What they write | JS Required? |
|-----------------|-----------------|-------------|
| **Simple display** (show JSON values) | HTML + `data-bind` attributes | ❌ None |
| **Styled display** (dynamic CSS) | HTML + `data-bind` + `data-style` | ❌ None |
| **Interactive** (buttons, inputs) | HTML + `data-bind` + `PiWidget.cmd()` calls | ⚠️ Minimal (onclick handlers) |
| **Complex behavior** (animations, conditionals) | HTML + `data-bind` + `onState()` | ✅ Some custom JS |

### What this changes for the project:

| Concern | Impact |
|---------|--------|
| **Pi RAM** | ~2KB script. Negligible. |
| **"Zero framework" rule** | Not a framework. It's a DOM attribute scanner. No virtual DOM, no reactivity system, no component model. |
| **Existing widgets** | 100% backward compatible. `onState`/`onData` still work. Binding layer is additive. |
| **Community DX** | Massive improvement. Simple widgets need zero JS knowledge. |

---

## Summary: Current State of Development

| Area | Status | Notes |
|------|--------|-------|
| **IPC Pipeline** (daemon → JSON → watcher → WS) | ✅ Complete | Solid, working, 4 daemons running |
| **State Store** (in-memory + persistence) | ✅ Complete | Deep merge, 50KB cap, hydration |
| **WebSocket Protocol** | ✅ Complete | state/reload/maintenance/cmd/patch |
| **PiWidget SDK** | ✅ Complete | registerAPI, dispatchState, frameLoop |
| **Compositor** | ⚠️ Works but fragile | Regex script extraction, string concatenation |
| **Widget library** | ⚠️ 33 widgets, inconsistent patterns | Mix of self-fetch, push, timers |
| **Declarative binding** | ❌ Missing | The critical gap for community widgets |
| **Admin Panel** | ✅ Heavily developed | React + Tailwind + Vite |
| **Daemons** | ✅ 4 bash daemons working | quote, music, network, gpio |

> [!IMPORTANT]
> **The roadmap is stale.** It says Phase 1 is "Ready to Plan" but in reality, Phases 1 and 2 are largely implemented. The actual next step is adding the **declarative binding layer** and standardizing all widgets to the "dumb template + smart producer" pattern.
