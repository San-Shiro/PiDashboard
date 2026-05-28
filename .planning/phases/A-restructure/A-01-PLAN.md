---
phase: A-restructure
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - "package.json"
  - "core/server/package.json"
  - "admin/package.json"
  - "widgets/README.md"
  - "widgets/_base/manifest.schema.json"
  - "canvases/saved/default.json"
autonomous: true
requirements: []
must_haves:
  truths:
    - "Workspace production directory structure is correctly established."
    - "Root package.json configures workspaces correctly."
  artifacts:
    - path: "package.json"
      provides: "Root workspace configurations"
      contains: "\"workspaces\":"
    - path: "core/server/package.json"
      provides: "Bun backend configuration"
      contains: "\"name\": \"core-server\""
    - path: "widgets/_base/manifest.schema.json"
      provides: "Standard widget manifest schema validation"
  key_links: []
---

<objective>
Establish the production repository structure, directory layout, workspaces configuration, and basic JSON validation schemas.

Purpose: Segregates the production Bun server, React admin panel, and custom widgets into clean workspace packages, keeping UI-Draft1 isolated as a reference.
Output: Initial folder paths, workspace configurations, packages manifests, and baseline schemas.
</objective>

<execution_context>
@~/.gemini/antigravity/get-shit-done/workflows/execute-plan.md
@~/.gemini/antigravity/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create production directory structure</name>
  <files></files>
  <action>
    Create the following directory layout at the project root to support modular server, client, and widget systems:
    - core/server/ (Bun server source code)
    - admin/ (React admin SPA source code)
    - widgets/ (Custom widget packages)
    - widgets/_base/ (Manifest schemas and base utilities)
    - canvases/saved/ (Saved JSON canvases and templates)
    - media/uploads/ (User uploaded asset files)
    - state/cache/ (Widget status and last-known-good JSON cache)
    - state/logs/ (System logging directories)
  </action>
  <verify>
    Check directory existences in terminal.
  </verify>
  <acceptance_criteria>
    - core/server/ is a directory.
    - admin/ is a directory.
    - widgets/ is a directory.
    - canvases/saved/ is a directory.
  </acceptance_criteria>
  <done>All production directories exist on disk</done>
</task>

<task type="auto">
  <name>Task 2: Configure root and package workspace manifests</name>
  <files>package.json, core/server/package.json, admin/package.json</files>
  <read_first>package.json</read_first>
  <action>
    Configure and write package files:
    1. Update root package.json to define a workspace mapping: workspaces: ["admin", "core/server"].
    2. Write core/server/package.json with package name "core-server", type "module", private true, and required Bun configurations.
    3. Write admin/package.json with package name "admin-panel", private true, as a base template package ready for Vite configuration.
  </action>
  <verify>
    npm run build-test or workspaces integrity validation.
  </verify>
  <acceptance_criteria>
    - Root package.json contains workspaces key mapping ["admin", "core/server"].
    - core/server/package.json contains name "core-server" and type "module".
    - admin/package.json contains name "admin-panel".
  </acceptance_criteria>
  <done>Root and package manifests are correctly written and configured</done>
</task>

<task type="auto">
  <name>Task 3: Establish base widget schemas and default canvas templates</name>
  <files>widgets/_base/manifest.schema.json, canvases/saved/default.json, widgets/README.md</files>
  <action>
    Write structural validation blueprints:
    1. Create widgets/_base/manifest.schema.json containing a draft-07 JSON Schema outlining standard properties required for every widget (id, name, version, tier, configSchema, entrypoints).
    2. Create canvases/saved/default.json containing a simple placeholder layout with an empty widget placement list to serve as the default kiosk canvas.
    3. Create widgets/README.md documenting fragment layouts, structure folders, and manifest configuration formats.
  </action>
  <verify>
    Verify JSON formatting and schema structural correctness.
  </verify>
  <acceptance_criteria>
    - widgets/_base/manifest.schema.json is a valid JSON schema with draft-07 specification.
    - canvases/saved/default.json contains standard canvas properties: widgets array, width, height.
    - widgets/README.md defines the difference between Fragments, Canvases, and Templates.
  </acceptance_criteria>
  <done>Validation schemas and default configuration canvases are correctly established</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Verify root and module workspace structures match specifications.
- [ ] Validate JSON schemas and active canvas configuration syntaxes.
</verification>

<success_criteria>
- All workspace directory trees successfully created.
- Workspace configurations added to git.
</success_criteria>

<output>
After completion, create `.planning/phases/A-restructure/A-01-SUMMARY.md`
</output>
