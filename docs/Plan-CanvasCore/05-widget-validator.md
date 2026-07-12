# 05 — Widget Validator

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `core/server/sdk/widget-validator.ts`

---

## Philosophy: Block, Don't Sanitize

If a widget fails validation, it is **rejected entirely**. It does not appear in the registry. It cannot be added to any canvas. We do not strip bad code, auto-fix fragments, or sanitize HTML. The widget author must fix their code and re-deploy.

**Why:** Sanitization creates false confidence. A "fixed" widget may render incorrectly in ways that are hard to debug. Better to fail loudly with clear error messages.

---

## Function Signature

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];        // Fatal — widget rejected
  warnings: string[];      // Non-fatal — widget works but should be improved
  widgetId: string;        // For logging
}

export function validateWidget(widgetDir: string): ValidationResult
```

---

## Validation Phases

### Phase 1: Manifest Structure

**File:** `<widgetDir>/manifest.json`

```typescript
// Check existence
if (!existsSync(join(widgetDir, 'manifest.json'))) → error("manifest.json not found")

// Check valid JSON
try { manifest = JSON.parse(readFileSync(...)) } catch → error("manifest.json is not valid JSON")

// Required fields
if (!manifest.id || typeof manifest.id !== 'string') → error("Missing 'id'")
if (!manifest.name) → error("Missing 'name'")
if (!manifest.version) → error("Missing 'version'")

// Tier validation
const validTiers = ['static', 'pull', 'push', 'stream'];
if (!validTiers.includes(manifest.tier)) → error("Invalid tier: '<value>'. Must be: static|pull|push|stream")

// Trust validation  
const validTrusts = ['core', 'verified', 'community', 'unsafe'];
if (!manifest.trust) → error("Missing 'trust' field")
if (!validTrusts.includes(manifest.trust)) → error("Invalid trust: '<value>'")

// ID matches folder name
const folderName = basename(widgetDir);
if (manifest.id !== folderName) → error("Manifest id '<id>' doesn't match folder name '<folder>'")
```

### Phase 2: Fragment Structure

```typescript
// Fragment file declaration
const fragmentFile = manifest.fragment?.file || manifest.entrypoints?.fragment;
if (!fragmentFile) → error("No fragment file declared")

const fragmentPath = join(widgetDir, fragmentFile);
if (!existsSync(fragmentPath)) → error("Fragment file not found: '<path>'")

// Read fragment content
const content = readFileSync(fragmentPath, 'utf8');

// Full HTML page detection — STRICT BLOCK
if (content.includes('<!DOCTYPE')) → error("Fragment contains <!DOCTYPE>. Must be a snippet, not a full HTML page")
if (content.includes('<html')) → error("Fragment contains <html> tag. Remove it — fragments are injected into the compositor's HTML")
if (content.includes('<head>') || content.includes('<head ')) → error("Fragment contains <head> tag")
if (content.includes('<body>') || content.includes('<body ')) → error("Fragment contains <body> tag")

// Size check
const sizeKB = Buffer.byteLength(content, 'utf8') / 1024;
if (sizeKB > 100) → error("Fragment is ${sizeKB.toFixed(1)}KB. Maximum: 100KB")
if (sizeKB > 50) → warn("Fragment is ${sizeKB.toFixed(1)}KB. Consider optimizing (limit: 100KB)")

// Base64 image check (catches inlined images that should be in /media/)
const base64Matches = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{10000,}/g);
if (base64Matches) → error("Fragment contains base64-encoded image >10KB. Use /media/ uploads instead")
```

### Phase 3: Tier–DataChannel Consistency

```typescript
if (manifest.tier === 'static' && manifest.dataChannel?.type !== 'none') {
  warn("Static widget declares dataChannel — it will be ignored");
}

if (manifest.tier === 'pull') {
  const fetchModule = manifest.dataChannel?.fetchModule;
  if (!fetchModule) → error("Pull tier widget missing dataChannel.fetchModule")
  if (!existsSync(join(widgetDir, fetchModule))) → error("Fetch module not found: '<path>'")
}

if (manifest.tier === 'push') {
  if (!manifest.dataChannel?.ipcFilename) → error("Push tier widget missing dataChannel.ipcFilename")
}

if (manifest.tier === 'stream') {
  warn("Stream tier is not implemented in v1. Widget will fallback to push behavior")
}
```

### Phase 4: Security Checks (Trust-Dependent)

Only applies to `verified` and `community` trust levels. `core` and `unsafe` skip this phase.

```typescript
if (manifest.trust === 'verified' || manifest.trust === 'community') {
  // Dangerous JS patterns
  const dangerousPatterns = [
    { pattern: /\beval\s*\(/, name: 'eval()' },
    { pattern: /new\s+Function\s*\(/, name: 'new Function()' },
    { pattern: /setTimeout\s*\(\s*['"`]/, name: 'setTimeout with string argument' },
    { pattern: /setInterval\s*\(\s*['"`]/, name: 'setInterval with string argument' },
  ];
  
  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(content)) {
      if (manifest.trust === 'verified') {
        error(`${name} found in fragment. Blocked for 'verified' trust level`);
      } else {
        warn(`${name} found — will be sandboxed in iframe for 'community' trust`);
      }
    }
  }
  
  // External script tags (for verified — community is iframe-sandboxed anyway)
  if (manifest.trust === 'verified') {
    if (/<script\s+[^>]*src\s*=/i.test(content)) {
      error("External <script src='...'> tag found. Verified widgets must bundle dependencies via manifest.resources.externalScripts");
    }
  }
}
```

### Phase 5: SDK Compliance (Advisory)

```typescript
if (!content.includes('PiWidget.register')) {
  warn("Fragment doesn't use PiWidget.register(). Consider migrating to the SDK pattern");
}
```

### Phase 6: Resource Checks

```typescript
// Assets folder size
const assetsDir = join(widgetDir, 'assets');
if (existsSync(assetsDir)) {
  const totalSize = getDirectorySizeBytes(assetsDir);
  if (totalSize > 2 * 1024 * 1024) {
    warn(`Assets folder is ${(totalSize/1024/1024).toFixed(1)}MB. Recommended max: 2MB`);
  }
}

// ConfigSchema validation
if (manifest.configSchema && Array.isArray(manifest.configSchema)) {
  for (const field of manifest.configSchema) {
    if (!field.key) warn(`configSchema entry missing 'key'`);
    if (!field.type) warn(`configSchema entry '${field.key}' missing 'type'`);
    if (!field.label) warn(`configSchema entry '${field.key}' missing 'label'`);
  }
}
```

---

## CLI Tool: `validate-widgets.ts`

```typescript
// core/tools/validate-widgets.ts
import { readdirSync } from 'fs';
import { join } from 'path';
import { validateWidget } from '../server/sdk/widget-validator';

const WIDGETS_DIR = join(process.cwd(), 'widgets');
const folders = readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'));

let passed = 0, failed = 0;

for (const folder of folders) {
  const result = validateWidget(join(WIDGETS_DIR, folder));
  
  if (result.valid) {
    console.log(`✓ ${folder}: OK${result.warnings.length ? ` (${result.warnings.length} warnings)` : ''}`);
    result.warnings.forEach(w => console.log(`    ⚠ ${w}`));
    passed++;
  } else {
    console.log(`✗ ${folder}: REJECTED`);
    result.errors.forEach(e => console.log(`    ✗ ${e}`));
    result.warnings.forEach(w => console.log(`    ⚠ ${w}`));
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

**Usage:** `bun run core/tools/validate-widgets.ts`

---

## Potential Errors & Edge Cases

| Scenario | What Happens |
|:---|:---|
| manifest.json is empty file | JSON parse fails → error |
| Fragment is 0 bytes | Size check passes but HTML checks find nothing. Widget renders blank. No error — it's technically valid |
| Widget folder has no `fragment/` subfolder | Fragment file not found → error |
| `id` has uppercase letters | Accepted but will cause issues if filesystem is case-sensitive. Consider adding lowercase enforcement |
| Two widgets with same `id` | Second one overwrites first in registry Map. Add duplicate detection in registry scanner |
| `configSchema` has duplicate keys | Admin UI renders duplicate fields. Add duplicate key warning |
| `fetchModule` exists but doesn't export `fetchData` | Passes validation (we don't runtime-check exports). Fails at scheduler runtime. Add note in error message |

---

## Code Reminders

- **Regex patterns in Phase 4 can have false positives.** `eval()` inside a string literal or comment will trigger. This is intentional — better to over-reject than under-reject for security.
- **File reads are synchronous.** Validation runs at boot/install time, not in request handlers. Sync I/O is fine here.
- **Don't validate `config` contents.** The widget validator checks the `configSchema` structure, not the actual config values in a canvas. Config value validation (against configSchema rules) happens in the admin panel client-side.
- **`document.currentScript` constraint** must be documented prominently in error messages and developer docs. When the validator warns about missing `PiWidget.register`, the message should mention this gotcha.
