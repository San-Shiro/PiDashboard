---
phase: D-widget
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - "core/server/index.ts"
  - "core/server/compositor/compose.ts"
files_created:
  - "core/server/api/widgets.ts"
autonomous: true
requirements:
  - "FRAG-02"
  - "FRAG-01"
  - "PIPE-03"
must_haves:
  truths:
    - "Widgets registry scanner parses manifests and returns config fields schemas to the admin panel."
    - "Widget instances can be created, updated via PATCH, and deleted dynamically."
    - "Compositor successfully resolves fragment entrypoints from JSON manifests and builds output HTML."
  artifacts:
    - path: "core/server/api/widgets.ts"
      provides: "Dynamic widget manifests registry scanning and instances CRUD endpoints"
      contains: "registry"
    - path: "core/server/compositor/compose.ts"
      provides: "Compositor resolving fragment paths dynamically from manifests"
      contains: "entrypoints.fragment"
---

<objective>
Implement manifest-driven widget scanning and full widget instances CRUD APIs on the Bun backend server.

Purpose: Transfers the smart dashboard into a truly modular ecosystem where fragments are scanned dynamically from manifests and active placements are managed dynamically.
Output: Unified server registry scanners, JSON-schema validators, and compositor fragment loaders.
</objective>

<execution_context>
@~/.gemini/antigravity/get-shit-done/workflows/execute-plan.md
@~/.gemini/antigravity/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/C-admin/C-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement widget manifest scanning and validation registry</name>
  <files>core/server/api/widgets.ts</files>
  <action>
    Create widget registry and validation:
    1. Scan all folders inside widgets/ directory (excluding base/ and folders starting with _ or .).
    2. Read manifest.json inside each widget folder, and validate against widgets/_base/manifest.schema.json.
    3. Expose GET `/api/widgets/registry` API returning `{ widgets: [...] }` containing all validated manifests.
  </action>
  <verify>
    Registry scanner validates and lists widget manifests.
  </verify>
  <acceptance_criteria>
    - Registry endpoint parses manifests correctly.
    - Invalid manifest structures are gracefully skipped.
  </acceptance_criteria>
  <done>Widget manifest registry scanner is fully operational</done>
</task>

<task type="auto">
  <name>Task 2: Build widget instances CRUD endpoints</name>
  <files>core/server/api/widgets.ts, core/server/index.ts</files>
  <action>
    Implement instance CRUD mapping:
    1. Implement GET `/api/widgets/instances` returning `{ instances: activeCanvas.widgets }`.
    2. Implement POST `/api/widgets/instances` to add a new instance of a widget. It should load the widget's manifest configSchema default values and create a uniquely ID'd instance configuration inside the active canvas.
    3. Implement PATCH `/api/widgets/instances/:id` to dynamically update instance's label, base_config, or widget_config.
    4. Implement DELETE `/api/widgets/instances/:id` to remove the instance.
    5. Bind all `/api/widgets/instances` and `/api/widgets/registry` routes inside core/server/index.ts.
  </action>
  <verify>
    Instances CRUD operations modify canvases/active.json correctly and return status 200.
  </verify>
  <acceptance_criteria>
    - GET returns placed instances.
    - POST creates instances with defaultConfig values.
    - PATCH and DELETE updates the active canvas file atomically.
  </acceptance_criteria>
  <done>Widget instances CRUD APIs are complete and bound to active canvas database</done>
</task>

<task type="auto">
  <name>Task 3: Refactor compositor to dynamically load manifest fragment files</name>
  <files>core/server/compositor/compose.ts</files>
  <action>
    Refactor fragment composer pipeline:
    1. Update compose.ts `cacheWidgetFragments` to parse the widget's `manifest.json` and load the dynamic HTML fragment path defined under `entrypoints.fragment`.
    2. Ensure the compositor wraps fragments in their specific data-widget containers and resolves variables accurately.
  </action>
  <verify>
    Verify compositor loads fragments dynamically based on manifest keys instead of hardcoded paths.
  </verify>
  <acceptance_criteria>
    - composeHTML reads active canvas, caches target fragments dynamically using manifest schemas, and outputs structured HTML.
  </acceptance_criteria>
  <done>Compositor refactored to support manifest-based dynamic fragment loading</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Run `bun test` on server or check that server starts and binds widgets API routes.
- [ ] Verify `npm run build --workspace=admin` continues compiling with zero path or API schema mismatches.
</verification>

<success_criteria>
- Dynamic manifest schema parsing operational.
- Unified widget instances CRUD pipeline is robust and flat-file persistent.
</success_criteria>

<output>
After completion, create `.planning/phases/D-widget/D-01-SUMMARY.md`
</output>
