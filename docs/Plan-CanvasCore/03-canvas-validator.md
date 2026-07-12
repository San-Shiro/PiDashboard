# 03 — Canvas Validator

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `core/server/schemas/canvas-validator.ts`

---

## Purpose

Lightweight, fast validation that runs on canvas publish and server boot. Ensures the compositor receives well-formed data. Runs in **<1ms on Pi Zero**.

---

## When It Runs

| Trigger | What happens |
|:---|:---|
| `POST /api/canvas/publish` | Validate before writing `active.json`. Reject if errors. |
| `POST /api/templates/:id/apply` | Validate before copying to active. |
| Server boot | Validate `active.json` from disk. Auto-correct and log warnings. |

It does **not** run on every `composeHTML()` call. The compositor trusts the cached object.

---

## Function Signature

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];          // Fatal — publish rejected
  warnings: string[];        // Non-fatal — auto-corrected
  sanitized: CanvasConfig;   // The cleaned version (clamped values, stripped fields)
}

export function validateCanvas(
  raw: any, 
  registryIds: string[]    // Array of valid widget_id strings from the registry
): ValidationResult
```

---

## Validation Steps

### Phase 1: Structure Checks (fail-fast)

```typescript
if (!raw || typeof raw !== 'object') → error("Canvas must be a JSON object")
if (!raw.canvas || typeof raw.canvas !== 'object') → error("Missing 'canvas' config block")
if (!Array.isArray(raw.widgets)) → error("Missing 'widgets' array")
```

If any Phase 1 error: return immediately, don't proceed.

### Phase 2: Canvas-Level Clamping (auto-fix)

```typescript
raw.schemaVersion = 2;
raw.canvas.width = clamp(raw.canvas.width || 1920, 320, 7680);
raw.canvas.height = clamp(raw.canvas.height || 1080, 240, 4320);
raw.canvas.background = raw.canvas.background || "#0d1117";
raw.canvas.displayTarget = ["primary","secondary","all"].includes(raw.canvas.displayTarget) 
  ? raw.canvas.displayTarget : "primary";
raw.canvas.pixelRatio = [1, 2].includes(raw.canvas.pixelRatio) ? raw.canvas.pixelRatio : 1;
raw.canvas.fps = [30, 60].includes(raw.canvas.fps) ? raw.canvas.fps : 60;
```

Log a warning for every auto-corrected value.

### Phase 3: Widget Instance Validation

```typescript
const seenIds = new Set<string>();

raw.widgets = raw.widgets.filter((w: any) => {
  // Required fields
  if (!w.id || typeof w.id !== 'string') → error, remove
  if (!w.widget_id || typeof w.widget_id !== 'string') → error, remove
  
  // Registry check
  if (!registryIds.includes(w.widget_id)) → error("Unknown widget: <id>"), remove
  
  // Duplicate check
  if (seenIds.has(w.id)) → error("Duplicate instance: <id>"), remove
  seenIds.add(w.id);
  
  // Defaults
  w.label = w.label || w.widget_id;
  w.enabled = w.enabled !== false;  // Default true
  w.config = w.config || {};
  
  // Layout clamping
  w.layout = w.layout || {};
  w.layout.x = Math.max(0, w.layout.x || 0);
  w.layout.y = Math.max(0, w.layout.y || 0);
  w.layout.width = clamp(w.layout.width || 320, 50, raw.canvas.width);
  w.layout.height = clamp(w.layout.height || 240, 50, raw.canvas.height);
  w.layout.zIndex = clamp(w.layout.zIndex || 1, 1, 999);
  w.layout.opacity = clamp(w.layout.opacity ?? 1, 0, 1);
  w.layout.overflow = w.layout.overflow === "visible" ? "visible" : "hidden";
  
  // BlendMode validation
  const validBlendModes = [
    "normal","multiply","screen","overlay","darken","lighten",
    "color-dodge","color-burn","hard-light","soft-light","difference","exclusion"
  ];
  if (w.layout.blendMode && !validBlendModes.includes(w.layout.blendMode)) {
    warn("Invalid blendMode '<value>' stripped");
    delete w.layout.blendMode;
  }
  
  // Filter validation
  if (w.layout.filter && typeof w.layout.filter === 'object') {
    const f = w.layout.filter;
    if (f.brightness !== undefined) f.brightness = clamp(f.brightness, 0, 2);
    if (f.contrast !== undefined) f.contrast = clamp(f.contrast, 0, 2);
    if (f.grayscale !== undefined) f.grayscale = clamp(f.grayscale, 0, 1);
    if (f.saturate !== undefined) f.saturate = clamp(f.saturate, 0, 3);
    if (f.sepia !== undefined) f.sepia = clamp(f.sepia, 0, 1);
    if (f.opacity !== undefined) f.opacity = clamp(f.opacity, 0, 1);
  }
  
  // Schedule validation
  if (w.schedule) {
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(w.schedule.activeFrom)) delete w.schedule;
    if (w.schedule && !timeRegex.test(w.schedule.activeTo)) delete w.schedule;
    if (w.schedule?.days) {
      const validDays = ["mon","tue","wed","thu","fri","sat","sun"];
      w.schedule.days = w.schedule.days.filter((d: string) => validDays.includes(d));
      if (w.schedule.days.length === 0) delete w.schedule.days;
    }
  }
  
  return true;
});
```

### Phase 4: Cleanup

```typescript
delete raw.widget_count;  // Never stored
raw.updated_at = new Date().toISOString();
```

---

## Integration with canvas.ts

```typescript
// In canvas.ts
export function publishCanvas(canvasData: any): { ok: boolean; errors?: string[] } {
  const registryIds = getWidgetRegistry().map(w => w.id);
  const result = validateCanvas(canvasData, registryIds);
  
  if (!result.valid) {
    logger.warn("CANVAS", `Publish rejected: ${result.errors.join(', ')}`);
    return { ok: false, errors: result.errors };
  }
  
  if (result.warnings.length > 0) {
    logger.info("CANVAS", `Auto-corrected: ${result.warnings.join(', ')}`);
  }
  
  // Atomic write
  const tmpPath = `${ACTIVE_PATH}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(result.sanitized, null, 2), "utf8");
  renameSync(tmpPath, ACTIVE_PATH);
  activeCanvasCache = result.sanitized;
  
  pushReload();
  return { ok: true };
}
```

---

## Helper: clamp()

```typescript
function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
```

**Why check `isNaN`:** JSON from untrusted sources can contain `NaN` via `null` arithmetic. `Math.max(0, NaN)` returns `NaN`, not 0. The `isNaN` guard catches this.

---

## Potential Errors

| Error | Cause | Impact | Handling |
|:---|:---|:---|:---|
| `raw` is `null` | Empty POST body | Phase 1 fail-fast | Return error immediately |
| `raw.widgets` is not array | Corrupted config | Phase 1 fail-fast | Return error |
| Widget references deleted widget type | Widget folder removed after canvas created | Widget stripped from array | Error logged, canvas still valid with remaining widgets |
| `NaN` in layout fields | Bad arithmetic in admin | Wrong position | `clamp()` with `isNaN` guard defaults to minimum |
| Huge widgets array (1000+) | Malicious POST | Memory spike on Pi | Consider adding max widget count (e.g. 50). Not in v1 — evaluate when admin is rebuilt |
| `active.json` unreadable at boot | Disk corruption | No display | Fallback to empty canvas, log critical error |

---

## Performance Guarantee

The validator uses:
- Type checks (`typeof`, `Array.isArray`) — O(1)
- Arithmetic clamping (`Math.min`, `Math.max`) — O(1)
- Array filter/set operations — O(n) where n = widget count
- String includes for enum validation — O(1) for small enums

For a canvas with 20 widgets: **<0.1ms** on Pi Zero. No regex (except schedule time format check), no deep cloning, no schema library.
