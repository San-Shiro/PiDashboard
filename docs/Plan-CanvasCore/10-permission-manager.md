# 10 — Permission Manager

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `widget-validator.ts`, `compose.ts`

---

## Design Philosophy

**Define now, enforce incrementally.** v1 only distinguishes `core`/`unsafe` (full access) and `community` (iframe sandboxed). `verified` acts like `core` in v1. The full permission enforcement pipeline is built in a future security phase, but the data model and permission categories are defined now to avoid retrofitting.

---

## Permission Categories

```typescript
interface WidgetPermissions {
  // ── Network ──
  canFetch: boolean;                 // Can fragment JS make HTTP requests (fetch/XHR)?
  canLoadExternalScripts: boolean;   // Can it load <script src="...">, including CDN?
  canLoadExternalStyles: boolean;    // Can it load <link href="..."> stylesheets?
  
  // ── DOM ──
  canAccessParentDOM: boolean;       // Can it reach outside its widget container?
  canUseEval: boolean;               // eval(), new Function(), setTimeout(string)
  
  // ── Storage ──
  canUsePersistence: boolean;        // PiWidget.saveState() — server-side state
  canUseLocalStorage: boolean;       // Direct localStorage/sessionStorage
  canUseCookies: boolean;            // document.cookie
  
  // ── Data Channels ──
  canSendCommands: boolean;          // PiWidget.sendCommand() — uplink to server
  canReceiveData: boolean;           // onData handler — downlink from server
  
  // ── System ──
  canAccessContext: boolean;         // PiWidget.context (viewer timezone, locale, etc.)
  canUseCanvas2D: boolean;           // <canvas> 2D API (heavy on Pi Zero)
  canUseLottie: boolean;             // Lottie animations
  
  // ── Outbound Security ──
  canSendOutboundData: boolean;      // Can the widget POST/send data to external servers?
}
```

---

## Default Permission Sets

| Permission | `core` | `verified` | `community` | `unsafe` |
|:---|:---:|:---:|:---:|:---:|
| **canFetch** | ✅ | ✅ | ❌ | ✅ |
| **canLoadExternalScripts** | ✅ | ✅ | ❌ | ✅ |
| **canLoadExternalStyles** | ✅ | ✅ | ❌ | ✅ |
| **canAccessParentDOM** | ✅ | ❌¹ | ❌² | ✅ |
| **canUseEval** | ✅ | ❌ | ❌ | ✅ |
| **canUsePersistence** | ✅ | ✅ | ❌ | ✅ |
| **canUseLocalStorage** | ✅ | ❌ | ❌ | ✅ |
| **canUseCookies** | ✅ | ❌ | ❌ | ✅ |
| **canSendCommands** | ✅ | ✅ | ❌ | ✅ |
| **canReceiveData** | ✅ | ✅ | ✅³ | ✅ |
| **canAccessContext** | ✅ | ✅ | ❌ | ✅ |
| **canUseCanvas2D** | ✅ | ✅ | ✅ | ✅ |
| **canUseLottie** | ✅ | ✅ | ✅ | ✅ |
| **canSendOutboundData** | ✅ | ❌ | ❌ | ✅ |

¹ Isolated by Shadow DOM — can't access other widgets' or page DOM
² Isolated by iframe sandbox — completely separate document
³ Via `postMessage` bridge, not direct `onData` callback

---

## Enforcement Mechanisms

### Static Analysis (Widget Validator — Boot/Install Time)

Catches dangerous patterns **before the widget ever runs**.

```typescript
// For "verified" trust level:
const blockedPatterns = [
  { regex: /\beval\s*\(/, permission: 'canUseEval' },
  { regex: /new\s+Function\s*\(/, permission: 'canUseEval' },
  { regex: /setTimeout\s*\(\s*['"`]/, permission: 'canUseEval' },
  { regex: /setInterval\s*\(\s*['"`]/, permission: 'canUseEval' },
  { regex: /document\.cookie/, permission: 'canUseCookies' },
  { regex: /localStorage/, permission: 'canUseLocalStorage' },
  { regex: /sessionStorage/, permission: 'canUseLocalStorage' },
  { regex: /window\.location\s*[.=]/, permission: 'canAccessParentDOM' },
  { regex: /window\.parent/, permission: 'canAccessParentDOM' },
  { regex: /window\.top/, permission: 'canAccessParentDOM' },
];
```

**Limitations:** Static analysis via regex is imperfect. Obfuscated code bypasses it. This is defense-in-depth, not a complete solution.

### Runtime Isolation (Compositor — Render Time)

| Trust | Mechanism | What It Prevents |
|:---|:---|:---|
| `core` | None | Nothing — full trust |
| `verified` | Shadow DOM | CSS leaks, parent DOM access |
| `community` | `<iframe sandbox="allow-scripts">` | Everything except script execution inside iframe |
| `unsafe` | None | Nothing — development mode |

### Network Allowlisting (Future Phase)

For `verified` widgets, the manifest declares which APIs it contacts:

```json
{
  "permissions": {
    "network": [
      "GET https://api.open-meteo.com/*",
      "GET https://api.exchangerate.host/*"
    ]
  }
}
```

**Future enforcement:** A Service Worker or Proxy intercepts fetch requests from verified widgets and blocks any URL not matching the declared allowlist.

**v1:** Informational only. No runtime enforcement. The declaration exists so we can build enforcement later without changing the manifest format.

### Outbound Data Prevention (Future Phase)

The key security concern: a malicious widget that reads sysinfo data from `onData` and POSTs it to an external server.

**Future approach options:**

1. **CSP (Content Security Policy):** Set `connect-src` to only allow the local WS server. Blocks `fetch()` to external URLs. Problem: applies to the whole page, not per-widget.

2. **Service Worker proxy:** Intercept all outbound requests. Check the origin widget (via custom header). Block if widget trust < core.

3. **iframe sandbox for all non-core:** Community widgets are already iframed. If we iframe `verified` widgets too, `sandbox` blocks outbound fetch. But this loses Shadow DOM benefits.

**v1 decision:** Don't enforce. `verified` acts like `core`. Document the risk. Implement enforcement when the marketplace launches and untrusted widgets become a real threat.

---

## Manifest Permission Declaration

```json
{
  "trust": "verified",
  "permissions": {
    "network": [
      "GET https://api.open-meteo.com/*"
    ],
    "persistence": true,
    "commands": ["refresh", "toggle_units"]
  }
}
```

### Fields

| Field | Type | Description |
|:---|:---|:---|
| `permissions.network` | `string[]` | HTTP methods + URL patterns the widget needs. Format: `"METHOD URL_PATTERN"` |
| `permissions.persistence` | `boolean` | Whether the widget uses `PiWidget.saveState()` |
| `permissions.commands` | `string[]` | Action names the widget sends via `PiWidget.sendCommand()` |

### URL Pattern Syntax

```
"GET https://api.example.com/*"     → Any GET to api.example.com
"GET https://api.example.com/v1/*"  → Any GET under /v1/
"POST https://hooks.slack.com/*"    → POST to Slack webhooks (for notification widgets)
"* https://my-server.local/*"       → Any method to a local server
```

---

## Implementation Roadmap

### v1 (Now)
- [x] Define permission categories in TypeScript interface
- [x] Define default permission sets per trust level
- [x] Implement static analysis for `eval()`, cookies, localStorage in widget validator
- [x] Implement `community` iframe sandboxing in compositor
- [x] `verified` acts like `core` (no runtime enforcement)
- [x] Manifest `permissions` field accepted but not enforced

### v2 (Security Phase)
- [ ] Shadow DOM enforcement for `verified` (prevent parent DOM access)
- [ ] Service Worker for network allowlisting
- [ ] CSP headers per trust level
- [ ] Runtime monitoring: detect permission violations and log/report
- [ ] Admin UI: show permission badges on each widget

### v3 (Marketplace)
- [ ] Automated security scanning on widget submission
- [ ] Permission diff on widget updates (highlight new permissions)
- [ ] User-grantable permissions (like Android app permissions)
- [ ] Revocation: disable a widget's specific permission without removing it

---

## Potential Errors

| Error | Impact | Handling |
|:---|:---|:---|
| Static analysis false positive (eval in comment) | Valid widget rejected | Accept `core` trust override; document known false positive patterns |
| Static analysis false negative (obfuscated eval) | Dangerous code passes | Defense-in-depth: iframe sandbox for untrusted, future CSP for all |
| Widget declares permissions it doesn't use | No harm | Informational only — admin UI could show "unused permissions" badge |
| Widget doesn't declare permissions it does use | v1: works fine, v2+: blocked | v2 enforcement will log the violation and block the action |
| Service Worker not supported | Very old browser | Fall back to no enforcement; log warning |

---

## Code Reminders

- **Permission checks should be fast.** On the Pi, any per-request permission check must be <0.1ms. Pre-compute permission sets at boot, store in a Map keyed by widget_id.
- **Don't conflate trust level with tier.** A `community` widget can be `static` (no data channel at all). Permission enforcement applies regardless of tier.
- **The `canSendOutboundData` permission is the hardest to enforce.** A widget can construct a URL with data as query params and load an `<img>` tag — this bypasses fetch-based blocking. True prevention requires iframe sandboxing (`community`) or CSP.
- **Never add permission enforcement that breaks `core` widgets.** Core widgets are ours — they must always work. Permission checks should short-circuit: `if (trust === 'core') return ALLOW`.
