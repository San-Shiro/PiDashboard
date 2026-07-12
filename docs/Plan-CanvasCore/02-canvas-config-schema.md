# 02 — Canvas Config Schema

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `canvas.ts`, `canvas-validator.ts`

---

## Schema Version

All canvas configs carry `schemaVersion: 2`. If the schema ever changes in a breaking way, bump this number. The validator checks it and applies version-specific rules.

---

## CanvasConfig Interface

```typescript
interface CanvasConfig {
  schemaVersion: 2;
  id: string;                      // Unique identifier (slug-safe: lowercase, hyphens, underscores)
  name: string;                    // Human-readable name for admin UI
  description?: string;            // Optional description
  
  canvas: {
    width: number;                 // Canvas pixel width. Range: 320–7680. Default: 1920
    height: number;                // Canvas pixel height. Range: 240–4320. Default: 1080
    background: string;            // CSS color value ("#0d1117", "rgb(10,10,10)", etc.)
    displayTarget: "primary" | "secondary" | "all";  // Which connected display
    pixelRatio: 1 | 2;            // 1 = standard, 2 = HiDPI/Retina
    fps: 30 | 60;                 // Target frame rate for PiWidget.onFrame() callbacks
    
    // Canvas-level context overrides (optional)
    defaultTimezone?: string;      // Override viewer auto-detect for all widgets on this canvas
    defaultLocale?: string;        // e.g. "en-US"
  };
  
  widgets: WidgetInstance[];       // Ordered array of widget instances
  // NOTE: No widget_count field. EVER.
  
  updated_at: string;             // ISO 8601 timestamp, set by server on every write
}
```

### Design Decisions

#### `widget_count` is computed, never stored

**Why:** A stored field that needs auto-correction on every read/write is a bug magnet. It adds a source of truth that can diverge from `widgets.length`.

**Where it appears:** API responses include `widget_count` as a computed field:
```typescript
function serializeCanvas(canvas: CanvasConfig): any {
  return {
    ...canvas,
    widget_count: canvas.widgets.length  // Computed on read
  };
}
```

**On write:** If incoming JSON contains `widget_count`, the validator strips it:
```typescript
delete raw.widget_count;
```

#### `schemaVersion` stamps

Every canvas gets `schemaVersion: 2` on write. Future migrations:
```typescript
if (raw.schemaVersion === 1) {
  // Migrate: rename base_config → layout, widget_config → config, etc.
  raw = migrateV1toV2(raw);
}
```

---

## WidgetInstance Interface

```typescript
interface WidgetInstance {
  id: string;                      // Unique instance ID. Format: "<widget_id>_<timestamp>"
  widget_id: string;               // Must match a folder in widgets/ with a valid manifest
  label: string;                   // Display name in admin panel (editable by user)
  enabled: boolean;                // false = rendered but hidden (for quick toggle without removal)
  
  layout: WidgetLayout;
  schedule?: WidgetSchedule;
  config: Record<string, any>;     // Widget-specific config, validated against manifest.configSchema
}
```

### WidgetLayout

```typescript
interface WidgetLayout {
  // Position (relative to canvas top-left corner)
  x: number;                       // Left offset in pixels. Min: 0
  y: number;                       // Top offset in pixels. Min: 0
  
  // Dimensions
  width: number;                   // Widget width in pixels. Min: manifest.defaults.minWidth or 50
  height: number;                  // Widget height in pixels. Min: manifest.defaults.minHeight or 50
  
  // Stacking
  zIndex: number;                  // 1–999. Higher = closer to viewer. Default: 1
  opacity: number;                 // 0.0–1.0. Default: 1
  
  // Visual properties
  borderRadius?: number;           // Corner radius in pixels. Default: 0
  overflow: "hidden" | "visible";  // Clip content or allow overflow. Default: "hidden"
  
  blendMode?: BlendMode;           // CSS mix-blend-mode. Default: "normal"
  
  filter?: WidgetFilter;           // Structured CSS filter object
  
  transition?: string;             // CSS transition for config changes (e.g. "opacity 0.3s ease")
}
```

### BlendMode (enum-restricted)

```typescript
type BlendMode = 
  | "normal" | "multiply" | "screen" | "overlay" 
  | "darken" | "lighten" | "color-dodge" | "color-burn" 
  | "hard-light" | "soft-light" | "difference" | "exclusion";
```

**Why enum:** A typo in `blendMode` silently falls back to `normal` in CSS — no error, just wrong rendering on a headless kiosk. Enum validation catches it at publish time.

### WidgetFilter (structured, not raw CSS)

```typescript
interface WidgetFilter {
  blur?: string;                   // e.g. "2px", "0.5rem"
  brightness?: number;             // 0.0–2.0. Default: 1 (no change)
  contrast?: number;               // 0.0–2.0. Default: 1
  grayscale?: number;              // 0.0–1.0. Default: 0
  saturate?: number;               // 0.0–3.0. Default: 1
  sepia?: number;                  // 0.0–1.0. Default: 0
  opacity?: number;                // 0.0–1.0. Filter-level opacity (stacks with layout.opacity)
}
```

**Serialization to CSS:**
```typescript
function serializeFilter(f: WidgetFilter | undefined): string {
  if (!f) return '';
  const parts: string[] = [];
  if (f.blur) parts.push(`blur(${f.blur})`);
  if (f.brightness !== undefined) parts.push(`brightness(${f.brightness})`);
  if (f.contrast !== undefined) parts.push(`contrast(${f.contrast})`);
  if (f.grayscale !== undefined) parts.push(`grayscale(${f.grayscale})`);
  if (f.saturate !== undefined) parts.push(`saturate(${f.saturate})`);
  if (f.sepia !== undefined) parts.push(`sepia(${f.sepia})`);
  if (f.opacity !== undefined) parts.push(`opacity(${f.opacity})`);
  return parts.join(' ');
}
// Output: "blur(2px) brightness(0.8)" → safe CSS
```

**Why structured:** A raw CSS filter string like `"blur(2px) brightness(0.8)"` can contain anything. A structured object can only produce valid filter functions. Typos become validation errors, not silent rendering bugs.

### WidgetSchedule

```typescript
interface WidgetSchedule {
  activeFrom: string;              // "HH:MM" in 24h format. e.g. "09:00"
  activeTo: string;                // "HH:MM" in 24h format. e.g. "18:00"
  days?: DayOfWeek[];              // Optional day restriction. If omitted, active every day
}

type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
```

**Timezone:** Schedule times are compared against the **viewer's timezone** (via `PiWidget.context.timezone`), not the server's. See [09-viewer-context.md](./09-viewer-context.md).

**Midnight wrap:** `activeFrom > activeTo` means the window crosses midnight:
- `activeFrom: "23:00", activeTo: "06:00"` → active from 11 PM to 6 AM
- `activeFrom: "09:00", activeTo: "17:00"` → active from 9 AM to 5 PM (normal)

**Logic (client-side):**
```typescript
function isWidgetActive(sched: WidgetSchedule): boolean {
  const now = getCurrentViewerHHMM(); // "14:30"
  const { activeFrom, activeTo, days } = sched;
  
  // Day check
  if (days && days.length > 0) {
    const today = getCurrentViewerDay(); // "tue"
    if (!days.includes(today)) return false;
  }
  
  // Time check
  if (activeFrom <= activeTo) {
    return now >= activeFrom && now < activeTo;
  } else {
    // Midnight wrap
    return now >= activeFrom || now < activeTo;
  }
}
```

---

## Serialization Rules

### On Write (publish)

1. Strip `widget_count` if present
2. Stamp `schemaVersion: 2`
3. Stamp `updated_at: new Date().toISOString()`
4. Validate via `canvas-validator.ts` (see [03-canvas-validator.md](./03-canvas-validator.md))
5. Atomic write: write to `.tmp` file then `rename()` to `active.json`

### On Read (API response)

1. Return cached object (no re-read from disk unless cache is null)
2. Add computed `widget_count: canvas.widgets.length`

### On Boot (server start)

1. Read `active.json` from disk
2. Validate and auto-correct (clamp values)
3. Cache in memory
4. Log any validation warnings

---

## Potential Errors

| Error | When | Impact | Handling |
|:---|:---|:---|:---|
| `active.json` is corrupt | Boot | Display shows nothing | Fallback to empty canvas `{ widgets: [] }`, log error |
| Unknown `widget_id` in widgets array | Publish | Widget can't render | Validator rejects the widget, strips from array |
| Duplicate instance `id` | Publish | DOM collision, broken data routing | Validator rejects duplicates |
| `zIndex` out of range | Publish | CSS stacking broken | Clamped to 1–999 |
| `opacity` negative | Publish | Invisible widget | Clamped to 0–1 |
| `width` or `height` too small | Publish | Widget unusable | Clamped to min 50px |
| Missing `layout` on widget | Publish | Position unknown | Default layout applied: `{x:0, y:0, width:320, height:240, ...}` |
| Invalid `blendMode` string | Publish | CSS ignores it silently | Stripped (set to undefined, CSS defaults to normal) |
| `filter` with invalid values | Publish | Broken CSS filter | Individual fields clamped/stripped |

---

## Code Reminders

- **Never read `active.json` from disk in the compositor.** The compositor receives the validated cached object. Disk I/O is only for boot and publish.
- **The `id` field on CanvasConfig is the canvas identifier.** The `id` on each WidgetInstance is the instance identifier. Don't confuse them.
- **`config` (widget-specific) is opaque to the canvas system.** The canvas validator doesn't validate widget config contents — that's the widget validator's job (via `configSchema` in the manifest).
- **`layout.transition` is a raw CSS string** — it's the one exception to "no raw CSS strings." This is acceptable because transitions only affect animation timing, not appearance, and a bad transition string is harmless (CSS ignores invalid transitions silently).
