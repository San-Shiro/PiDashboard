# 09 — Viewer Context Variables

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `pi-widget-sdk.js`, `compose.ts`

---

## Problem

Some values depend on **who is viewing the page**, not the server or widget config. A clock should show the viewer's timezone. A schedule should hide widgets based on the viewer's local time. Date formatting should match the viewer's locale.

These can't be baked into the canvas config — they change per viewer.

---

## `PiWidget.context` Object

Auto-populated at page load from the viewer's browser:

```javascript
PiWidget.context = {
  // ── Browser-detected (auto) ──
  timezone: "Asia/Kolkata",        // Intl.DateTimeFormat().resolvedOptions().timeZone
  locale: "en-IN",                 // navigator.language
  is24h: true,                     // Auto-detect from locale
  deviceType: "touch",             // 'touch' | 'pointer'
  screenWidth: 1920,               // window.innerWidth
  screenHeight: 1080,              // window.innerHeight
  colorScheme: "dark",             // 'dark' | 'light' (from prefers-color-scheme)
  
  // ── Server-injected (compositor embeds these at render time) ──
  serverTimezone: "UTC",           // The Pi's configured timezone
  canvasId: "morning-dashboard",   // Currently active canvas ID
  
  // ── Overrides (from canvas config, admin-settable) ──
  overrides: {}                    // Canvas-level forced values
};
```

---

## Detection Methods

### Timezone
```javascript
Intl.DateTimeFormat().resolvedOptions().timeZone
// Returns: "Asia/Kolkata", "America/New_York", "Europe/London", etc.
// Supported in all modern browsers including Chromium kiosk on Pi
```

### 12/24 Hour Detection
```javascript
// Heuristic: if toLocaleTimeString contains AM/PM, locale uses 12h
!(new Date().toLocaleTimeString().match(/AM|PM/))
// true = 24h format, false = 12h format
```

**Gotcha:** This depends on the browser's locale, which can differ from `navigator.language` if the user has custom date settings. Good enough for a kiosk dashboard.

### Device Type
```javascript
('ontouchstart' in window) ? 'touch' : 'pointer'
```

**Note:** The Pi kiosk is typically `pointer` (mouse/keyboard). Admin phones are `touch`. This helps widgets render larger touch targets when viewed on mobile.

### Color Scheme
```javascript
window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
```

**On Pi kiosk:** Typically `light` (no system dark mode). On admin phones: follows system setting. Widgets can use this to auto-theme.

---

## Fallback Chain

For any context-dependent value, resolution order:

```
1. Widget config override     (admin explicitly set timezone = "America/New_York" for this instance)
2. Canvas config override     (canvas.defaultTimezone = "Europe/London" for all widgets)
3. Viewer auto-detected       (PiWidget.context.timezone = "Asia/Kolkata" from browser)
4. Server default             (PiWidget.context.serverTimezone = "UTC" from Pi)
```

### Implementation in Widgets

```javascript
PiWidget.register(document.currentScript.parentElement, function(ctx) {
  // Timezone resolution
  var tz = ctx.config.timezone                           // 1. Widget config override
        || PiWidget.context.overrides.timezone           // 2. Canvas override
        || PiWidget.context.timezone                     // 3. Viewer auto-detect
        || PiWidget.context.serverTimezone;              // 4. Server fallback
  
  // Locale resolution
  var locale = ctx.config.locale
            || PiWidget.context.overrides.locale
            || PiWidget.context.locale;
  
  // Use resolved values
  function tick() {
    var now = new Date();
    ctx.root.querySelector('.time').textContent = now.toLocaleTimeString(locale, {
      timeZone: tz,
      hour12: !PiWidget.context.is24h
    });
  }
  return { onFrame: tick };
});
```

### Who Sees What

| Viewer | PiWidget.context.timezone | Effect |
|:---|:---|:---|
| Kiosk browser on Pi (London) | "Europe/London" | Clock shows London time |
| Admin on phone (India) | "Asia/Kolkata" | Clock shows India time |
| Admin on laptop (New York) | "America/New_York" | Clock shows New York time |
| Widget with `timezone: "Asia/Tokyo"` in config | Ignored — widget uses explicit config | Clock shows Tokyo time regardless of viewer |

---

## Compositor Injection

The compositor embeds server-side context values that the browser can't detect:

```typescript
// In compose.ts
function generateContextScript(canvas: CanvasConfig): string {
  const serverTz = Intl.DateTimeFormat().resolvedOptions().timeZone; // Pi's timezone
  
  const overrides: Record<string, string> = {};
  if (canvas.canvas.defaultTimezone) overrides.timezone = canvas.canvas.defaultTimezone;
  if (canvas.canvas.defaultLocale) overrides.locale = canvas.canvas.defaultLocale;
  
  return `
    PiWidget.context.serverTimezone = '${serverTz}';
    PiWidget.context.canvasId = '${canvas.id}';
    ${Object.keys(overrides).length > 0 
      ? `PiWidget.context.overrides = ${JSON.stringify(overrides)};` 
      : ''}
  `;
}
```

---

## Schedule Integration

The client-side schedule checker uses viewer timezone for comparisons:

```javascript
function getCurrentViewerHHMM() {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: PiWidget.context.timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  // Returns: "14:30" for the viewer's local time
}

function getCurrentViewerDay() {
  return ['sun','mon','tue','wed','thu','fri','sat'][
    new Date().toLocaleDateString('en-US', {
      timeZone: PiWidget.context.timezone,
      weekday: 'narrow'
    }) // Need proper mapping — see code reminder below
  ];
}
```

---

## Potential Errors

| Error | Cause | Impact | Handling |
|:---|:---|:---|:---|
| `Intl.DateTimeFormat` not available | Very old browser | timezone is `undefined` | Fall back to `serverTimezone` |
| Invalid timezone string in config | Admin types "india" instead of "Asia/Kolkata" | `toLocaleTimeString` throws | Wrap in try/catch, fall back to next in chain |
| `navigator.language` returns `null` | Privacy browser | locale is null | Default to `"en-US"` |
| `is24h` detection wrong | Some locales use both 12h and 24h | Minor display issue | User can override in widget config |
| `screenWidth/Height` wrong on resize | Window resize after load | Stale dimensions | Could add resize listener to update, but not critical |
| Canvas override conflicts with widget config | Admin sets both | Confusing | Widget config wins (higher priority in chain) |

---

## Code Reminders

- **Context is read-only.** Widgets should never modify `PiWidget.context`. The SDK doesn't enforce this (no `Object.freeze` for performance), but document it clearly.
- **Day-of-week mapping is locale-sensitive.** `toLocaleDateString` with `weekday: 'narrow'` returns locale-specific day abbreviations. The schedule checker should map to our `"mon"|"tue"|...` format reliably. Best approach: use `getDay()` with the numeric mapping `[0: sun, 1: mon, ...]` after converting to the viewer's timezone.
- **Context detection runs once at page load.** If the viewer changes timezone mid-session (unlikely on a kiosk), the context won't update. This is acceptable.
- **Privacy browsers** may restrict `Intl` or `navigator.language`. Always have fallbacks.
- **`is24h` detection is a heuristic**, not authoritative. Some locales (e.g., Canadian French) can use either format depending on context. The heuristic is good enough.
