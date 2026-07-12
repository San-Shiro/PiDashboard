# 07 — Compositor Engine

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `core/server/compositor/compose.ts`

---

## Purpose

The compositor is a **pure function**: it takes a validated `CanvasConfig` + widget manifests/fragments and returns a complete HTML page string. No file I/O, no side effects, no state.

```typescript
export function composeHTML(
  canvas: CanvasConfig,
  registry: WidgetRegistryEntry[]
): string
```

---

## Output Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PiDashboard</title>
  
  <!-- Conditional: fonts (only if any widget uses externalFonts) -->
  <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet">
  
  <!-- Conditional: Lottie (only if any widget uses lottie animations) -->
  <script src="/media/libs/lottie.min.js"></script>
  
  <!-- Conditional: other widget-declared libraries -->
  <script src="/media/libs/chart.min.js"></script>
  
  <!-- Always: PiWidget SDK -->
  <script src="/media/libs/pi-widget-sdk.js"></script>
  
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { background: ${canvas.canvas.background}; }
    #kiosk-viewport { 
      position: relative; 
      width: ${canvas.canvas.width}px; 
      height: ${canvas.canvas.height}px; 
      overflow: hidden; 
    }
  </style>
</head>
<body>
  <div id="kiosk-viewport" data-canvas-id="${canvas.id}">
    
    <!-- Widgets sorted by zIndex (lowest first, painted first) -->
    ${widgetContainers}
    
  </div>
  
  <!-- Server context injection -->
  <script>
    PiWidget.context.serverTimezone = '${serverTimezone}';
    PiWidget.context.canvasId = '${canvas.id}';
  </script>
  
  <!-- Schedule checker (client-side) -->
  <script>${scheduleCheckerScript}</script>
  
  <!-- Shadow DOM setup -->
  <script>${shadowDOMScript}</script>
  
  <!-- WebSocket client -->
  <script>${wsClientScript}</script>
  
  <!-- Start frame loop at canvas fps -->
  <script>PiWidget._startFrameLoop(${canvas.canvas.fps});</script>
  
  <!-- Display heartbeat -->
  <script>${heartbeatScript}</script>
</body>
</html>
```

---

## Key Behaviors

### 1. Widget Sorting

```typescript
const sortedWidgets = canvas.widgets
  .filter(w => w.enabled !== false)
  .sort((a, b) => a.layout.zIndex - b.layout.zIndex);  // Lowest first → painted first
```

### 2. Widget Container Generation

For each widget, generate a positioned container:

```typescript
function renderWidgetContainer(instance: WidgetInstance, manifest: WidgetManifest, fragmentHTML: string, savedState: any): string {
  const { layout, config, id, widget_id, schedule } = instance;
  
  // Style string from layout
  const style = [
    `position: absolute`,
    `left: ${layout.x}px`,
    `top: ${layout.y}px`,
    `width: ${layout.width}px`,
    `height: ${layout.height}px`,
    `z-index: ${layout.zIndex}`,
    `opacity: ${layout.opacity}`,
    layout.borderRadius ? `border-radius: ${layout.borderRadius}px` : '',
    `overflow: ${layout.overflow}`,
    layout.blendMode ? `mix-blend-mode: ${layout.blendMode}` : '',
    layout.filter ? `filter: ${serializeFilter(layout.filter)}` : '',
    layout.transition ? `transition: ${layout.transition}` : '',
  ].filter(Boolean).join('; ');
  
  // Data attributes
  const dataAttrs = [
    `data-widget="${widget_id}"`,
    `data-instance="${id}"`,
    `data-config='${escapeAttr(JSON.stringify(config))}'`,
    `data-trust="${manifest.trust}"`,
    savedState ? `data-state='${escapeAttr(JSON.stringify(savedState))}'` : '',
    schedule ? `data-schedule='${escapeAttr(JSON.stringify({
      from: schedule.activeFrom, to: schedule.activeTo, days: schedule.days
    }))}'` : '',
    manifest.resources?.externalFonts?.length ? `data-fonts="${manifest.resources.externalFonts.join(',')}"` : '',
  ].filter(Boolean).join(' ');
  
  // Trust-based rendering
  if (manifest.trust === 'community') {
    return renderIframedWidget(instance, manifest, fragmentHTML, style, dataAttrs);
  } else {
    return renderInlineWidget(instance, manifest, fragmentHTML, style, dataAttrs);
  }
}
```

### 3. Inline Widget (core/verified/unsafe) with Error Boundary

```typescript
function renderInlineWidget(instance, manifest, fragmentHTML, style, dataAttrs): string {
  // Extract <script> content from fragment for try/catch wrapping
  const { htmlPart, scriptPart } = separateFragmentScript(fragmentHTML);
  
  return `
    <div ${dataAttrs} style="${style}">
      ${htmlPart}
      <script>
      try {
        ${scriptPart}
      } catch(__err) {
        console.error('[PiWidget] Fatal error in ${instance.widget_id}:', __err);
        var __el = document.currentScript.parentElement;
        __el.innerHTML += '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);color:#ff6b6b;font-size:12px;padding:8px;z-index:9999;">⚠ Widget Error</div>';
        window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
      }
      </script>
    </div>
  `;
}
```

**`separateFragmentScript()` method:**

```typescript
function separateFragmentScript(html: string): { htmlPart: string; scriptPart: string } {
  // Find the last <script>...</script> block (widget logic is typically last)
  const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
  let lastMatch: RegExpMatchArray | null = null;
  let match;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    lastMatch = match;
  }
  
  if (!lastMatch) return { htmlPart: html, scriptPart: '' };
  
  const scriptContent = lastMatch[1];
  const htmlPart = html.slice(0, lastMatch.index!) + html.slice(lastMatch.index! + lastMatch[0].length);
  
  return { htmlPart, scriptPart: scriptContent };
}
```

**Why separate HTML and script?** The try/catch wrapper needs to wrap the script content, not the entire fragment. Separating them lets us:
1. Inject the HTML part (styles, divs) directly
2. Wrap just the JS in error handling

### 4. Iframed Widget (community)

```typescript
function renderIframedWidget(instance, manifest, fragmentHTML, style, dataAttrs): string {
  // Config is embedded synchronously as a script var (no postMessage race)
  const srcdoc = `
    <html><body style="margin:0;padding:0;overflow:hidden;">
    <script>var __WIDGET_CONFIG__ = ${JSON.stringify(instance.config)};
    var __WIDGET_TYPE__ = '${instance.widget_id}';
    var __INSTANCE_ID__ = '${instance.id}';
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'widget_data') {
        if (window.__communityOnData) window.__communityOnData(e.data.payload);
      }
    });
    </script>
    ${fragmentHTML}
    </body></html>
  `.replace(/"/g, '&quot;');
  
  return `
    <div ${dataAttrs} style="${style}">
      <iframe sandbox="allow-scripts" 
              srcdoc="${srcdoc}"
              style="width:100%;height:100%;border:none;"></iframe>
    </div>
  `;
}
```

### 5. Conditional Resource Injection

```typescript
function getRequiredResources(canvas: CanvasConfig, registry: WidgetRegistryEntry[]): {
  scripts: string[];
  fonts: string[];
} {
  const scripts = new Set<string>(['/media/libs/pi-widget-sdk.js']);
  const fonts = new Set<string>();
  
  for (const widget of canvas.widgets) {
    const manifest = registry.find(r => r.id === widget.widget_id)?.manifest;
    if (!manifest) continue;
    
    // Lottie detection
    if (manifest.animations?.type?.includes('lottie')) {
      scripts.add('/media/libs/lottie.min.js');
    }
    
    // Generic library injection
    for (const src of manifest.resources?.externalScripts || []) {
      if (src.startsWith('/media/libs/')) scripts.add(src);
    }
    
    // Font collection
    for (const font of manifest.resources?.externalFonts || []) {
      fonts.add(font);
    }
  }
  
  return { scripts: [...scripts], fonts: [...fonts] };
}
```

### 6. Shadow DOM Setup Script

```javascript
// Injected after all widget containers are in the DOM
(function() {
  document.querySelectorAll('[data-widget]').forEach(function(container) {
    if (container.dataset.trust === 'community') return;  // Already iframed
    if (!container.attachShadow) return;  // Fallback: no Shadow DOM support
    
    var shadow = container.attachShadow({ mode: 'open' });
    
    // Inject fonts into shadow root
    var fonts = container.dataset.fonts;
    if (fonts) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + 
                  fonts.split(',').map(function(f) { return f.trim().replace(/ /g, '+'); }).join('&family=') +
                  '&display=swap';
      shadow.appendChild(link);
    }
    
    // Move all children into shadow
    while (container.firstChild) {
      shadow.appendChild(container.firstChild);
    }
  });
})();
```

### 7. Client-Side Schedule Checker

```javascript
(function scheduleLoop() {
  var now = new Date();
  var tz = PiWidget.context.timezone;
  var currentHHMM = now.toLocaleTimeString('en-US', {
    timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit'
  });
  var dayNames = ['sun','mon','tue','wed','thu','fri','sat'];
  var today = dayNames[new Date().toLocaleDateString('en-US', { 
    timeZone: tz, weekday: 'short' 
  }).toLowerCase().slice(0,3) === 'sun' ? 0 : /* map properly */];
  // Simplified: use Intl to get day
  var todayIdx = parseInt(new Date().toLocaleDateString('en-US', {
    timeZone: tz
  }).split('/')[1]); // Better: just use getDay with tz offset
  
  document.querySelectorAll('[data-schedule]').forEach(function(el) {
    var sched = JSON.parse(el.getAttribute('data-schedule'));
    var dayOk = !sched.days || sched.days.indexOf(today) !== -1;
    var timeOk;
    if (sched.from <= sched.to) {
      timeOk = currentHHMM >= sched.from && currentHHMM < sched.to;
    } else {
      timeOk = currentHHMM >= sched.from || currentHHMM < sched.to;
    }
    el.style.display = (dayOk && timeOk) ? '' : 'none';
  });
  
  setTimeout(scheduleLoop, 30000);
})();
```

---

## Potential Errors

| Error | Cause | Impact | Handling |
|:---|:---|:---|:---|
| Fragment file missing | Widget folder corrupted after boot | Container renders empty | Registry scanner should re-validate; log error and render placeholder |
| `escapeAttr` produces invalid HTML | Config JSON contains `'` quotes | Broken `data-config` | Use `&apos;` and `&quot;` escaping; test with complex config values |
| Shadow DOM not supported | Very old browser | No style isolation | Fallback to inline rendering with `[data-widget]` CSS scoping |
| Schedule checker timezone error | Invalid timezone string | Wrong schedule | Wrap in try/catch, fall back to server timezone |
| Script separation regex fails | Fragment has no `<script>` tag | No widget JS executes | `separateFragmentScript` returns empty scriptPart — widget renders HTML-only |
| Huge canvas (50+ widgets) | Admin adds too many | Slow composition | Log warning; consider lazy rendering for off-screen widgets (future) |

---

## Code Reminders

- **`composeHTML` is a pure function.** It must not read files, make HTTP calls, or modify state. All inputs are passed as arguments. This enables unit testing without a running server.
- **`escapeAttr()` is critical for security.** Widget configs can contain user input. The config JSON is embedded in an HTML attribute — any `'`, `"`, `<`, `>` must be escaped. Use a proper HTML attribute escaping function, not just `JSON.stringify`.
- **Script separation must handle multiple `<script>` blocks.** Some fragments have inline event handler scripts AND a main logic script. The compositor wraps only the main (last) script in try/catch. Inline `<script>` tags in the HTML part are left as-is.
- **Order of injection matters.** The SDK must load before any widget script. Fonts should be in `<head>`. Shadow DOM setup runs after all containers are in the DOM but before the frame loop starts.
- **`serializeFilter()` must handle `undefined` values.** Don't output `filter: undefined`.
