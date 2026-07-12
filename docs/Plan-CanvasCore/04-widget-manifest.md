# 04 — Widget Manifest v2

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `widgets/_base/manifest.schema.json`, `widget-validator.ts`

---

## Purpose

The manifest declares everything about a widget: what tier it runs on, what trust level it has, what data channels it uses, what interactive capabilities it provides, and what resources it needs. The registry scanner reads manifests. The validator enforces rules. The compositor uses manifest data to wire up data channels, inject dependencies, and choose rendering mode.

---

## Complete Manifest Reference

```json
{
  "id": "weather",
  "name": "Live Weather",
  "version": "1.0.0",
  "author": "PiDashboard",
  "description": "Shows current weather conditions with temperature, humidity, and forecast",
  
  "tier": "pull",
  "trust": "core",
  
  "fragment": {
    "file": "fragment/weather.html",
    "format": "snippet"
  },
  
  "dataChannel": {
    "type": "websocket",
    "ipcFilename": "weather.json",
    "fetchModule": "fetch/weather.ts"
  },
  
  "interactive": {
    "commands": [],
    "persistence": false,
    "stateSchema": {}
  },
  
  "polling": {
    "intervalSec": 300,
    "jitterSec": 30
  },
  
  "animations": {
    "type": ["css"],
    "lottieFiles": [],
    "lottieRenderer": "canvas",
    "targetFps": 30
  },
  
  "resources": {
    "estimatedRamKB": 30,
    "requiresNetwork": true,
    "externalFonts": ["Inter"],
    "externalScripts": []
  },
  
  "permissions": {
    "network": ["GET https://api.open-meteo.com/*"],
    "persistence": false,
    "commands": []
  },
  
  "configSchema": [
    {
      "key": "locationName",
      "type": "text",
      "label": "Location (e.g. London, UK)",
      "default": "London, UK",
      "required": true,
      "validation": { "minLength": 2, "maxLength": 100 }
    },
    {
      "key": "units",
      "type": "select",
      "label": "Temperature Units",
      "default": "metric",
      "options": [
        { "label": "Celsius (°C)", "value": "metric" },
        { "label": "Fahrenheit (°F)", "value": "imperial" }
      ]
    }
  ],
  
  "defaults": {
    "width": 320,
    "height": 240,
    "minWidth": 200,
    "minHeight": 160
  }
}
```

---

## Field-by-Field Documentation

### Required Fields

| Field | Type | Description |
|:---|:---|:---|
| `id` | `string` | Unique widget type identifier. Must match the folder name in `widgets/`. Lowercase, hyphens allowed. |
| `name` | `string` | Human-readable name shown in admin UI widget picker. |
| `version` | `string` | Semver string. Used for marketplace versioning and update checks. |
| `tier` | `"static" \| "pull" \| "push" \| "stream"` | Execution tier. See [01-tier-system.md](./01-tier-system.md). |
| `trust` | `"core" \| "verified" \| "community" \| "unsafe"` | Security trust level. Determines rendering mode (Shadow DOM vs iframe). |

### Fragment Declaration

| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `fragment.file` | `string` | Yes | Path to fragment HTML file, relative to widget directory |
| `fragment.format` | `"snippet"` | Yes | Must be `"snippet"`. Full HTML pages are rejected by validator |

**Snippet format rules:**
- No `<!DOCTYPE>`, `<html>`, `<head>`, `<body>` tags
- Must be injectable HTML content: `<style>`, `<div>`, `<script>` blocks
- Script should use `PiWidget.register(document.currentScript.parentElement, ...)` pattern

### Data Channel

| Field | Type | When Required | Description |
|:---|:---|:---|:---|
| `dataChannel.type` | `"none" \| "websocket" \| "ipc_file"` | Always | How live data reaches the widget |
| `dataChannel.ipcFilename` | `string` | `type: "ipc_file"` | Filename in IPC dir (e.g. `"sysinfo.json"`) |
| `dataChannel.fetchModule` | `string` | `tier: "pull"` | Path to fetch module relative to widget dir |

**Validation rules:**
- `tier: "static"` → `dataChannel.type` must be `"none"`
- `tier: "pull"` → `dataChannel.fetchModule` must point to an existing `.ts` file
- `tier: "push"` → `dataChannel.ipcFilename` must be defined
- `tier: "stream"` → `dataChannel.type` = `"websocket"` (v1 fallback to push behavior)

### Interactive Capabilities

| Field | Type | Description |
|:---|:---|:---|
| `interactive.commands` | `Command[]` | Array of commands the widget can send to the server |
| `interactive.persistence` | `boolean` | Whether widget state is saved to disk (survives restarts) |
| `interactive.stateSchema` | `object` | Shape of persisted state for documentation and validation |

**Command shape:**
```typescript
interface Command {
  action: string;           // "play", "pause", "seek", "toggle_light"
  description: string;      // Human-readable description
  payload?: object;         // Expected payload shape (for documentation)
}
```

### Polling (Pull Tier Only)

| Field | Type | Default | Description |
|:---|:---|:---|:---|
| `polling.intervalSec` | `number` | 60 | Base polling interval in seconds. Min: 5 |
| `polling.jitterSec` | `number` | 0 | Random jitter added to interval to avoid thundering herd |

### Animations

| Field | Type | Default | Description |
|:---|:---|:---|:---|
| `animations.type` | `string[]` | `["css"]` | Animation technologies used: `"css"`, `"lottie"`, `"canvas2d"`, `"gif"` |
| `animations.lottieFiles` | `string[]` | `[]` | Paths to Lottie JSON files in widget's `assets/` dir |
| `animations.lottieRenderer` | `string` | `"canvas"` | `"canvas"` (lighter on Pi), `"svg"` (better quality), `"html"` |
| `animations.targetFps` | `number` | 60 | Hint for admin UI resource budgeting |

**Compositor behavior:** Only `"lottie"` in `type` triggers compositor action (injecting lottie.min.js). Other values are informational for admin UI.

### Resources

| Field | Type | Default | Description |
|:---|:---|:---|:---|
| `resources.estimatedRamKB` | `number` | 50 | Estimated RAM usage for admin resource budgeting |
| `resources.requiresNetwork` | `boolean` | false | Widget needs internet access (for pull tier, external fonts) |
| `resources.externalFonts` | `string[]` | `[]` | Google Fonts family names. Compositor injects into Shadow DOM |
| `resources.externalScripts` | `string[]` | `[]` | Paths to JS libraries in `/media/libs/`. Compositor injects in `<head>` |

### Config Schema

Array of field descriptors. The admin UI generates config forms from this.

```typescript
interface ConfigField {
  key: string;                // Config property name
  type: ConfigFieldType;      // Input type for admin UI
  label: string;              // Human-readable label
  default: any;               // Default value when widget is added to canvas
  required?: boolean;         // Default: false
  
  // Validation rules
  validation?: {
    minLength?: number;       // For text fields
    maxLength?: number;
    min?: number;             // For number fields
    max?: number;
    pattern?: string;         // Regex pattern string
  };
  
  // For select/radio types
  options?: Array<{ label: string; value: any }>;
  
  // Conditional visibility
  showIf?: { key: string; value: any };  // Only show this field when another field equals a value
}

type ConfigFieldType = 
  | "text"       // Single-line text input
  | "textarea"   // Multi-line text
  | "number"     // Numeric input
  | "toggle"     // Boolean switch
  | "select"     // Dropdown select
  | "color"      // Color picker
  | "file"       // File upload (returns path)
  | "timezone"   // Timezone picker
  | "time"       // Time picker (HH:MM)
  | "slider";    // Range slider (uses validation.min/max)
```

### Defaults

| Field | Type | Default | Description |
|:---|:---|:---|:---|
| `defaults.width` | `number` | 320 | Default width when widget added to canvas |
| `defaults.height` | `number` | 240 | Default height |
| `defaults.minWidth` | `number` | 50 | Minimum resize width (canvas validator enforces) |
| `defaults.minHeight` | `number` | 50 | Minimum resize height |

---

## Registry Scanner

The registry scanner at `widgets.ts` reads all manifest files at boot:

```typescript
export function getWidgetRegistry(): WidgetManifest[] {
  const widgets: WidgetManifest[] = [];
  
  for (const folder of readdirSync(WIDGETS_DIR)) {
    if (folder.startsWith('_') || folder.startsWith('.')) continue;
    
    const manifestPath = join(WIDGETS_DIR, folder, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    
    try {
      const raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const validation = validateWidget(join(WIDGETS_DIR, folder));
      
      if (validation.valid) {
        widgets.push(raw);
      } else {
        logger.warn('REGISTRY', `Widget ${folder} rejected: ${validation.errors.join(', ')}`);
      }
    } catch (e) {
      logger.warn('REGISTRY', `Failed to parse manifest for ${folder}`);
    }
  }
  
  return widgets;
}
```

**Key:** Invalid widgets are **excluded from the registry**, not loaded with defaults. If it's not in the registry, it can't be added to any canvas.

---

## Code Reminders

- **`id` must match folder name.** The scanner uses the folder name to locate the widget, but the `id` in the manifest is what's referenced in canvas configs. They must match.
- **`configSchema` defaults are used when creating new widget instances.** The admin panel reads configSchema, populates default values, and sends them as the initial `config` object.
- **`externalScripts` paths must start with `/media/libs/`.** The compositor rejects all other paths for security. Widget authors must bundle their JS deps locally.
- **`tier: "stream"` falls back to `"push"` in v1.** Don't implement stream-specific logic yet, but accept it in the manifest so early adopters can declare it.
