# 06 — PiWidget SDK

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `core/media/libs/pi-widget-sdk.js`

---

## Purpose

A ~50-line client-side SDK injected by the compositor into every display page. It replaces raw DOM conventions and global magic with a clean, documented API.

---

## API Reference

### `PiWidget.register(element, factory)`

Register a widget and wire it into the data and frame pipelines.

```javascript
PiWidget.register(document.currentScript.parentElement, function(ctx) {
  // ctx.root        — The widget container element (later becomes shadow host)
  // ctx.config      — Parsed widget_config from canvas (the data-config attribute)
  // ctx.instanceId  — Unique instance ID (e.g. "clock-analog_1780037948006")
  // ctx.widgetType  — Widget type name (e.g. "clock-analog")
  // ctx.context     — Reference to PiWidget.context (viewer variables)
  
  return {
    onData: function(data) { /* Called when WebSocket data arrives for this widget type */ },
    onFrame: function(timestamp) { /* Called at canvas fps by central frame dispatcher */ },
    onDestroy: function() { /* Called on hot-reload or canvas switch (future) */ }
  };
});
```

**Returns:** The factory function must return an object. All methods are optional. Return `{}` for static widgets with no updates.

**Critical constraint: `document.currentScript`**

`document.currentScript` is **ONLY valid during synchronous `<script>` execution**. It becomes `null` the moment execution enters any async context.

```javascript
// ✅ CORRECT — synchronous, captured immediately
PiWidget.register(document.currentScript.parentElement, function(ctx) { ... });

// ❌ WRONG — document.currentScript is null inside async
async function init() {
  PiWidget.register(document.currentScript.parentElement, ...); // null!
}

// ❌ WRONG — document.currentScript is null inside DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  PiWidget.register(document.currentScript.parentElement, ...); // null!
});

// ❌ WRONG — document.currentScript is null inside setTimeout
setTimeout(function() {
  PiWidget.register(document.currentScript.parentElement, ...); // null!
}, 0);
```

**The SDK solves this:** Widget code inside the factory callback can be fully async. `ctx.root` is captured synchronously and safe to use in any context:

```javascript
PiWidget.register(document.currentScript.parentElement, function(ctx) {
  // ctx.root is safe to use anywhere inside here:
  
  setTimeout(function() {
    ctx.root.querySelector('.title').textContent = 'Works!';  // ✅ Safe
  }, 1000);
  
  fetch('/api/something').then(function(res) {
    ctx.root.querySelector('.data').textContent = res;  // ✅ Safe
  });
  
  return { onData: function(data) {
    ctx.root.querySelector('.live').textContent = data.value;  // ✅ Safe
  }};
});
```

---

### `PiWidget.context`

Dynamic viewer variables populated at page load. See [09-viewer-context.md](./09-viewer-context.md) for full details.

```javascript
PiWidget.context.timezone      // "Asia/Kolkata" — viewer's timezone
PiWidget.context.locale        // "en-IN" — viewer's locale
PiWidget.context.is24h         // true/false
PiWidget.context.deviceType    // "touch" | "pointer"
PiWidget.context.screenWidth   // 1920
PiWidget.context.screenHeight  // 1080
PiWidget.context.colorScheme   // "dark" | "light"
PiWidget.context.serverTimezone // "UTC" — Pi's timezone
PiWidget.context.canvasId      // "morning-dashboard"
```

---

### `PiWidget.sendCommand(widgetType, action, payload)`

Send an interactive command from the widget to the server. See [08-interactive-widgets.md](./08-interactive-widgets.md).

```javascript
PiWidget.sendCommand('mpd-player', 'toggle_play', {});
PiWidget.sendCommand('mpd-player', 'seek', { position: 0.75 });
PiWidget.sendCommand('home-lights', 'toggle', { device: 'living-room' });
```

**Behavior when WS is disconnected:** Silently drops the command. No error thrown. No queue. Widgets should handle the visual state optimistically or wait for the next `onData` confirmation.

---

### `PiWidget.saveState(instanceId, state)` / `PiWidget.loadState(instanceId)`

Persist and restore widget state across page reloads/restarts.

```javascript
// Save (debounce this — don't call on every keystroke)
PiWidget.saveState(ctx.instanceId, { text: 'My notes', tasks: [...] });

// Load (synchronous — state is pre-embedded in DOM by compositor)
var saved = PiWidget.loadState(ctx.instanceId);
if (saved) {
  textarea.value = saved.text;
}
```

**State flow:**
```
Save:  Widget → WS → Server → writes state/widgets/<instanceId>.json
Load:  Server reads state file at compose time → embeds as data-state attribute → SDK parses synchronously
```

**Size limit:** State is embedded as a `data-state` HTML attribute. Keep it under 10KB. For larger state, consider a dedicated API endpoint.

---

### `PiWidget._dispatch(widgetType, data)` (Internal)

Called by the WebSocket client script when data arrives. Not meant for widget authors.

```javascript
// WebSocket client calls this:
PiWidget._dispatch('weather', { temp: 32, condition: 'Sunny' });

// All registered widgets of type 'weather' have their onData() called
```

**Error isolation:** Each `onData` call is wrapped in try/catch. If one handler throws, others still fire. Error count incremented on `window.__widgetErrorCount`.

---

### `PiWidget._startFrameLoop(fps)` (Internal)

Starts the central animation frame dispatcher. Called once by the compositor after all widgets are registered.

```javascript
PiWidget._startFrameLoop(30); // 30fps canvas — all onFrame callbacks called at ~33ms intervals
```

**How it works:**
1. One `requestAnimationFrame` loop runs
2. Checks if enough time has passed since last frame (based on fps)
3. Calls all registered `onFrame` callbacks in sequence
4. Each callback is wrapped in try/catch — one broken widget can't freeze others

**Pi Zero optimization:** On a single-core Pi, three independent rAF loops at 60fps = 180 frame requests/sec competing for CPU. The central dispatcher reduces this to 1 rAF loop with 3 callbacks per frame. The callbacks are cheap JS function calls — the bottleneck is rendering, not dispatching.

---

## Full Implementation

```javascript
(function() {
  var _dataHandlers = [];
  var _frameCallbacks = [];
  var _destroyCallbacks = [];
  var _targetFps = 60;
  var _frameInterval = 1000 / _targetFps;
  var _lastFrameTime = 0;
  
  window.PiWidget = {
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
    
    register: function(widgetEl, factory) {
      if (!widgetEl) {
        console.error('[PiWidget] register() called with null element. Did you use document.currentScript inside an async context?');
        return;
      }
      
      var config = {};
      try { config = JSON.parse(widgetEl.getAttribute('data-config') || '{}'); } catch(e) {}
      
      var instanceId = widgetEl.getAttribute('data-instance') || '';
      var widgetType = widgetEl.getAttribute('data-widget') || '';
      
      var api;
      try {
        api = factory({
          root: widgetEl,
          config: config,
          instanceId: instanceId,
          widgetType: widgetType,
          context: PiWidget.context
        });
      } catch(e) {
        console.error('[PiWidget] Factory error in ' + widgetType + ':', e);
        window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
        return;
      }
      
      if (!api) return;
      if (api.onData) _dataHandlers.push({ type: widgetType, instance: instanceId, handler: api.onData });
      if (api.onFrame) _frameCallbacks.push({ type: widgetType, handler: api.onFrame });
      if (api.onDestroy) _destroyCallbacks.push({ type: widgetType, instance: instanceId, handler: api.onDestroy });
    },
    
    _dispatch: function(widgetType, data) {
      for (var i = 0; i < _dataHandlers.length; i++) {
        if (_dataHandlers[i].type === widgetType) {
          try { 
            _dataHandlers[i].handler(data); 
          } catch(e) {
            console.error('[PiWidget] onData error in ' + widgetType + ':', e);
            window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
          }
        }
      }
    },
    
    _startFrameLoop: function(fps) {
      _targetFps = fps || 60;
      _frameInterval = 1000 / _targetFps;
      
      function tick(timestamp) {
        if (timestamp - _lastFrameTime >= _frameInterval) {
          _lastFrameTime = timestamp;
          for (var i = 0; i < _frameCallbacks.length; i++) {
            try { 
              _frameCallbacks[i].handler(timestamp); 
            } catch(e) {
              window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
            }
          }
        }
        requestAnimationFrame(tick);
      }
      
      if (_frameCallbacks.length > 0) {
        requestAnimationFrame(tick);
      }
    },
    
    _destroyAll: function() {
      for (var i = 0; i < _destroyCallbacks.length; i++) {
        try { _destroyCallbacks[i].handler(); } catch(e) {}
      }
      _dataHandlers = [];
      _frameCallbacks = [];
      _destroyCallbacks = [];
    },
    
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

---

## Potential Errors

| Error | Cause | Impact | SDK Handling |
|:---|:---|:---|:---|
| `widgetEl` is null | `document.currentScript` used in async context | Widget not registered | Error logged, return early |
| `data-config` is invalid JSON | Compositor bug or manual tampering | Empty config | try/catch, defaults to `{}` |
| Factory throws | Bug in widget code | Widget not registered | Error caught, logged, error count incremented |
| `onData` throws | Bug in widget update logic | Stale display for that widget | Error caught, other widgets unaffected |
| `onFrame` throws | Bug in animation logic | One widget freezes visually | Error caught, frame loop continues for others |
| WS disconnected during `sendCommand` | Network issue | Command silently dropped | Check readyState before sending |
| `loadState` returns stale data | State file not updated after canvas change | Old data displayed | Widget should validate loaded state shape |

---

## Code Reminders

- **The SDK file is vanilla ES5 JavaScript.** No const/let, no arrow functions, no template literals, no destructuring. This runs on Chromium kiosk which supports ES6+, but keeping it ES5 avoids any future compatibility issues and keeps the file trivially small.
- **`for` loops instead of `forEach`.** Micro-optimization for the frame loop — `for` is ~2x faster than `forEach` on V8. Matters when calling 10+ frame callbacks at 60fps.
- **`window.__piWs` is set by the WS client script** (separate from the SDK). The SDK just references it. The WS client script is also injected by the compositor.
- **`_destroyAll()` is for future hot-reload.** When the server sends a canvas switch command, the display can call `PiWidget._destroyAll()`, clear the DOM, and re-render without a full page reload.
