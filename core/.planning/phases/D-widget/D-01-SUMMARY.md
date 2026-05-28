---
phase: D-widget
plan: 01
subsystem: core
tags: [bun, schema, api, compositor]
requires: []
provides:
  - "Dynamic widget manifest scanner and JSON-schema validation registry"
  - "Widget instances CRUD endpoints interacting atomically with canvases/active.json"
  - "Refactored HTML layout compositor dynamically loading entrypoint fragment HTML from manifests"
affects: [Phase D Plan 2, Phase E, Phase F]
tech-stack:
  added: []
  patterns: [Manifest-driven widget integration, Dynamic JSON schema hydration]
key-files:
  created:
    - "core/server/api/widgets.ts"
  modified:
    - "core/server/compositor/compose.ts"
    - "core/server/index.ts"
key-decisions:
  - "Decided to dynamically merge/hydrate widget manifests from the scanned registry on-the-fly during GET /api/widgets/instances. This avoids data synchronization issues and letsplaced widget instances immediately inherit new configurations without needing database migrations."
  - "Used a simple JSON file database (canvases/active.json) with atomic writes (publishCanvas) to maintain a zero-overhead, highly performant system suitable for Pi Zero 2W."
  - "Implemented a fallback in core/server/compositor/compose.ts to search in `widgets/<widget-id>/fragment/*.html` if a manifest's entrypoints.fragment is missing or misconfigured, ensuring robust compatibility."
patterns-established:
  - "Atomic flat-file widgets instances management pattern"
  - "Lightweight runtime JSON manifest validation schema validation"
requirements-completed:
  - "FRAG-02"
  - "PIPE-03"
duration: 15min
completed: 2026-05-28
---

# Phase D Plan 1: Widget Fragment System — Core Registry & CRUD Summary

**Establishing the dynamic widgets scanning registry, active canvas instances CRUD routing handlers, and manifest-driven compositor fragment loader.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-28T20:00:00Z
- **Completed:** 2026-05-28T20:15:00Z
- **Tasks:** 3 completed
- **Files modified/created:** 2 modified, 1 created

## Accomplishments
- **Dynamic Manifest Registry Scanning:** Implemented `getWidgetRegistry()` to scan `widgets/*/manifest.json`, perform robust lightweight schema validation, and expose `GET /api/widgets/registry` returning all valid widgets.
- **Widget Instances CRUD endpoints:** Implemented GET, POST, PATCH, and DELETE endpoints inside `core/server/api/widgets.ts` to manage placed widget instances. POST automatically populates `defaultConfig` values dynamically from manifest config schemas.
- **Atomic Persistence:** CRUD changes instantly update the active layout in `canvases/active.json` atomically via `publishCanvas`, ensuring zero-RAM, flat-file persistence.
- **Manifest-Driven Compositor Fragment Loading:** Updated `core/server/compositor/compose.ts` to resolve dynamic fragment HTML from the path defined under the `entrypoints.fragment` manifest key, with a robust fallback to find HTML files in the `fragment/` directory.

## Task Commits

1. **Task 1: Widget registry & validation scanner** - `b4a2e5f` (feat)
2. **Task 2: Instances CRUD endpoints** - `35fc8e2` (feat)
3. **Task 3: Dynamic compositor fragment loading** - `a9fd81e` (feat)

## Files Created/Modified
- `core/server/api/widgets.ts` (created) - Dynamic widget registry and instances management.
- `core/server/compositor/compose.ts` (modified) - Manifest-driven dynamic HTML compositor.
- `core/server/index.ts` (modified) - Mounted widget registry and instance routing endpoints.

## Next Subsystem Readiness
- Server side core widget registry, instances CRUD, and dynamic fragment loading are 100% operational.
- Proceeding to **Phase D Plan 2: Adapt primary widget fragments (Clock, Weather, Sysinfo)** to vanilla specifications.
