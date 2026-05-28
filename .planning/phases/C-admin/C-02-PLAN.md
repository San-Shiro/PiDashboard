---
phase: C-admin
plan: 02
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - "admin/src/App.jsx"
  - "admin/src/components/dashboard/tabs/overview-tab.jsx"
  - "admin/src/components/dashboard/tabs/layout-tab.jsx"
  - "admin/src/components/dashboard/tabs/canvases-tab.jsx"
  - "admin/src/components/dashboard/tabs/system-control-tab.jsx"
autonomous: true
requirements:
  - "LAYT-01"
  - "LAYT-02"
must_haves:
  truths:
    - "Vite compiles React components without TypeScript or import path errors."
    - "Admin dashboard interface contains lock screen security gates."
  artifacts:
    - path: "admin/src/App.jsx"
      provides: "Dashboard central shell and session lock screens"
      contains: "Overview"
    - path: "admin/src/components/dashboard/tabs/layout-tab.jsx"
      provides: "Interactive draggable canvas layout editor"
      contains: "position"
---

<objective>
Migrate, clean, and compile the React admin components linking tabs to the Bun backend.

Purpose: Transfers the beautiful, animated drag-drop editing panels from the prototype to the production workspace.
Output: Dynamic React UI components, secure session lock screens, and optimized client bundles.
</objective>

<execution_context>
@~/.gemini/antigravity/get-shit-done/workflows/execute-plan.md
@~/.gemini/antigravity/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/C-admin/C-01-SUMMARY.md
@.planning/phases/C-admin/C-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate and clean dashboard components and tabs</name>
  <files>admin/src/components/dashboard/tabs/overview-tab.jsx, admin/src/components/dashboard/tabs/layout-tab.jsx, admin/src/components/dashboard/tabs/canvases-tab.jsx, admin/src/components/dashboard/tabs/system-control-tab.jsx</files>
  <read_first>src-anything/UI-Draft1/apps/web/src/components/dashboard/tabs/docs-tab.jsx</read_first>
  <action>
    Extract and clean core tabs:
    1. Extract tabs from src-anything/UI-Draft1/apps/web/src/components/dashboard/tabs/.
    2. Audit code to strip any NextJS or __create scaffold dependency imports.
    3. Link layout-tab.jsx publishes to POST /api/canvas/publish and canvases-tab.jsx templates saves to POST /api/canvas/save.
    4. Link system-control-tab.jsx statistics fetches to GET /api/system/stats.
  </action>
  <verify>
    Verify imports are correctly resolved and clean.
  </verify>
  <acceptance_criteria>
    - layout-tab.jsx triggers fetch publishes to `/api/canvas/publish`.
    - canvases-tab.jsx links to `/api/canvas/save`.
    - system-control-tab.jsx fetches from `/api/system/stats`.
  </acceptance_criteria>
  <done>UI components are successfully clean-migrated and mapped to production APIs</done>
</task>

<task type="auto">
  <name>Task 2: Build App shell and secure lock screens</name>
  <files>admin/src/App.jsx</files>
  <read_first>src-anything/UI-Draft1/apps/web/src/app/page.jsx</read_first>
  <action>
    Implement secure central dashboard panel:
    1. Clean page.jsx from UI-Draft1 to act as App.jsx entry point.
    2. Expose secure lock/login screen if GET /api/auth/status returns false.
    3. Render the sidebar navigation dashboard with Overview, Widgets, Layout, Canvases, Media, Themes, System, and Docs tabs.
  </action>
  <verify>
    Ensure App.jsx builds without syntax errors.
  </verify>
  <acceptance_criteria>
    - App.jsx mounts lock screens dynamically.
    - App.jsx renders sidebar panels and layouts.
  </acceptance_criteria>
  <done>App.jsx entry shell and lock screen gates are fully written</done>
</task>

<task type="auto">
  <name>Task 3: Execute client Vite compiler bundle verification</name>
  <files></files>
  <action>
    Test production compilation footprint:
    1. Run `npm install` inside admin package to resolve dependencies.
    2. Execute `npm run build --workspace=admin` (or tsx bundles checks) in the project workspace root.
    3. Assert output generates successfully under admin/dist.
  </action>
  <verify>
    `npm run build --workspace=admin` completes successfully with 0 compilation errors.
  </verify>
  <acceptance_criteria>
    - Vite compiler completes successfully.
    - admin/dist contains compiled index.html and assets bundles.
  </acceptance_criteria>
  <done>Vite compilation builds client static files successfully</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Verify Vite build executes and outputs compiled assets.
- [ ] Verify build contains index.html under admin/dist.
</verification>

<success_criteria>
- Clean compiled SPA bundle size kept to a minimum.
- Draggable layout features completely migrated.
</success_criteria>

<output>
After completion, create `.planning/phases/C-admin/C-02-SUMMARY.md`
</output>
