# Canvas Config Engine — Documentation Index

> **Status:** Planning Phase (v4)
> **Target:** Pi Zero 2W (512MB RAM, quad-core ARM)
> **Scope:** Rebuild the canvas config → compositor → display pipeline from scratch

---

## Architecture Overview

### [00 — Architecture Overview](./00-architecture-overview.md)
The master plan. Covers the full system design: tier system, interactive widgets, viewer context, security model, canvas schema, manifest format, PiWidget SDK, Shadow DOM isolation, compositor engine, heartbeat protocol, and execution order.

**Read this first.** All sub-files below expand on specific sections of this document.

---

## Subsystem Documentation

### Core Engine

| # | File | Subsystem | Key Source Files |
|:--|:-----|:----------|:-----------------|
| 01 | [Tier System](./01-tier-system.md) | Execution tiers (`static`/`pull`/`push`/`stream`) + security tiers (`core`/`verified`/`community`/`unsafe`) | `manifest.json`, `scheduler.ts` |
| 02 | [Canvas Config Schema](./02-canvas-config-schema.md) | The `CanvasConfig` and `WidgetInstance` TypeScript interfaces, serialization rules, computed fields | `canvas.ts`, `canvas-validator.ts` |
| 03 | [Canvas Validator](./03-canvas-validator.md) | Lightweight validation on publish/boot: clamping, deduplication, registry checks | `canvas-validator.ts` |
| 04 | [Widget Manifest](./04-widget-manifest.md) | Manifest v2 JSON schema: every field documented with examples and validation rules | `manifest.schema.json`, `widget-validator.ts` |
| 05 | [Widget Validator](./05-widget-validator.md) | Block-don't-sanitize validation: fragment structure, security checks, SDK compliance | `widget-validator.ts` |

### Widget Runtime

| # | File | Subsystem | Key Source Files |
|:--|:-----|:----------|:-----------------|
| 06 | [PiWidget SDK](./06-piwidget-sdk.md) | The ~50-line client SDK: registration, data dispatch, frame loop, commands, persistence, context | `pi-widget-sdk.js` |
| 07 | [Compositor Engine](./07-compositor-engine.md) | HTML generation: Shadow DOM, error boundaries, schedule filtering, resource injection | `compose.ts` |
| 08 | [Interactive Widgets](./08-interactive-widgets.md) | Uplink commands, `.cmd.json` protocol, state persistence, server-side routing | `compose.ts`, `index.ts` |
| 09 | [Viewer Context](./09-viewer-context.md) | Dynamic runtime variables: timezone, locale, device type, fallback chain | `pi-widget-sdk.js`, `compose.ts` |

### Infrastructure

| # | File | Subsystem | Key Source Files |
|:--|:-----|:----------|:-----------------|
| 10 | [Permission Manager](./10-permission-manager.md) | Trust levels, permission categories, enforcement strategies, allowlists | `widget-validator.ts`, `compose.ts` |
| 11 | [IPC Pipeline](./11-ipc-pipeline.md) | tmpfs watcher, debouncing, stateCache, throughput limits, failure modes | `tmpfs-watcher.ts`, `scheduler.ts` |
| 12 | [WebSocket Protocol](./12-websocket-protocol.md) | Message types, heartbeat, state hydration, command routing, display status | `display.ts`, `index.ts` |
| 13 | [Testing Harness](./13-testing-harness.md) | 6-layer test suite, CLI tools, mock strategies | `*.test.ts`, `canvas-preview.ts` |

---

## File Map: Documentation → Source Code

```
docs/Plan-CanvasCore/
├── README.md                      ← You are here
├── 00-architecture-overview.md    ← Master plan (v4)
├── 01-tier-system.md
├── 02-canvas-config-schema.md
├── 03-canvas-validator.md
├── 04-widget-manifest.md
├── 05-widget-validator.md
├── 06-piwidget-sdk.md
├── 07-compositor-engine.md
├── 08-interactive-widgets.md
├── 09-viewer-context.md
├── 10-permission-manager.md
├── 11-ipc-pipeline.md
├── 12-websocket-protocol.md
└── 13-testing-harness.md

core/
├── server/
│   ├── compositor/
│   │   └── compose.ts              ← 07-compositor-engine.md
│   ├── schemas/
│   │   └── canvas-validator.ts     ← 03-canvas-validator.md
│   ├── sdk/
│   │   └── widget-validator.ts     ← 05-widget-validator.md
│   ├── ipc/
│   │   └── tmpfs-watcher.ts        ← 11-ipc-pipeline.md
│   ├── ws/
│   │   └── display.ts              ← 12-websocket-protocol.md
│   ├── api/
│   │   ├── canvas.ts               ← 02-canvas-config-schema.md
│   │   ├── scheduler.ts            ← 01-tier-system.md
│   │   └── widgets.ts              ← 04-widget-manifest.md (registry only)
│   └── index.ts                    ← 08, 12 (routing, commands, heartbeat)
├── widgets/
│   └── _base/
│       └── manifest.schema.json    ← 04-widget-manifest.md
├── media/
│   └── libs/
│       └── pi-widget-sdk.js        ← 06-piwidget-sdk.md
└── tools/
    ├── canvas-preview.ts           ← 13-testing-harness.md
    ├── validate-widgets.ts         ← 05-widget-validator.md
    └── validate-canvas.ts          ← 03-canvas-validator.md
```

---

## Execution Order

| Step | Component | Doc | Depends On |
|:-----|:----------|:----|:-----------|
| 1 | Manifest v2 schema | [04](./04-widget-manifest.md) | Nothing |
| 2 | Widget validator | [05](./05-widget-validator.md) | Step 1 |
| 3 | Canvas validator | [03](./03-canvas-validator.md) | Step 1 |
| 4 | PiWidget SDK | [06](./06-piwidget-sdk.md) | Nothing |
| 5 | Delete existing widgets | — | Nothing |
| 6 | Compositor rewrite | [07](./07-compositor-engine.md) | Steps 2-4 |
| 7 | Clean widgets.ts | [04](./04-widget-manifest.md) | Step 6 |
| 8 | Clean canvas.ts | [02](./02-canvas-config-schema.md) | Step 3 |
| 9 | Clean index.ts | [08](./08-interactive-widgets.md), [12](./12-websocket-protocol.md) | Steps 6-8 |
| 10 | Test suite | [13](./13-testing-harness.md) | All above |
| 11 | CLI tools | [13](./13-testing-harness.md) | Steps 6-7 |
