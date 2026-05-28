---
phase: B-server
plan: 02
type: execute
wave: 2
depends_on: ["01"]
files_modified:
  - "core/server/compositor/compose.ts"
  - "core/server/api/canvas.ts"
  - "core/server/compositor/compose.test.ts"
autonomous: true
requirements:
  - "SERV-02"
  - "SERV-03"
  - "LAYT-03"
must_haves:
  truths:
    - "Compositor successfully merges layout coordinates and fragment scopes into a single responsive HTML page."
    - "Canvas publish requests atomically save configuration objects."
  artifacts:
    - path: "core/server/compositor/compose.ts"
      provides: "Dynamic HTML string compilation and template injection"
      contains: "data-widget"
    - path: "core/server/api/canvas.ts"
      provides: "Active layout publisher routing"
      contains: "active.json"
---

<objective>
Build the core HTML compositor and active canvas publishers.

Purpose: Translates layout coordinates and custom styles into a high-performance vanilla client layout with zero framework overhead.
Output: Dynamic compositor modules, canvas routing handlers, and validation tests.
</objective>

<execution_context>
@~/.gemini/antigravity/get-shit-done/workflows/execute-plan.md
@~/.gemini/antigravity/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/B-server/B-01-SUMMARY.md
@.planning/phases/B-server/B-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build atomic canvas management API</name>
  <files>core/server/api/canvas.ts</files>
  <read_first>core/server/config/manager.ts</read_first>
  <action>
    Create active and saved layout API endpoints:
    1. GET /api/canvas/active — read and return active.json.
    2. POST /api/canvas/publish — write new active.json atomically (writing first to a temporary file canvases/active.json.tmp and renaming).
    3. GET /api/canvas/saved — list configurations inside canvases/saved/*.json.
  </action>
  <verify>
    Ensure save and retrieve actions return correct active properties.
  </verify>
  <acceptance_criteria>
    - canvas.ts contains POST /api/canvas/publish routing.
    - canvas.ts implements atomic file writes using temp file renaming.
  </acceptance_criteria>
  <done>Canvas API is fully operational with atomic publish workflows</done>
</task>

<task type="auto">
  <name>Task 2: Build the core HTML compositor</name>
  <files>core/server/compositor/compose.ts</files>
  <read_first>core/server/api/canvas.ts</read_first>
  <action>
    Implement dynamic template compilation:
    1. Read and load all widget fragment files inside widgets/*/fragment/*.html into a memory cache.
    2. Write composeHTML() function reading active.json.
    3. Loop through widgets inside the active canvas, wrapping their cached fragments in absolute-positioned containers (`left`, `top`, `width`, `height`, `z-index`, `opacity`) using an array join concatenation pattern.
    4. Inject basic websocket scaling client scripts to drive real-time viewports.
  </action>
  <verify>
    Execute compose test checks.
  </verify>
  <acceptance_criteria>
    - compose.ts caches fragments in-memory to prevent SD card wear.
    - compose.ts absolute positions fragments and exports dynamic HTML.
  </acceptance_criteria>
  <done>Compositor successfully parses layout models into responsive HTML</done>
</task>

<task type="auto">
  <name>Task 3: Integrate compositor routes in main server</name>
  <files>core/server/index.ts</files>
  <read_first>core/server/compositor/compose.ts, core/server/api/canvas.ts</read_first>
  <action>
    Integrate layout views:
    1. Update index.ts to import composeHTML and canvas API routes.
    2. Add GET /display/main route to index.ts to execute composeHTML() and return dynamic composed page with text/html content header.
    3. Mount canvas API routes protected by secure session gate middleware.
  </action>
  <verify>
    Request /display/main and verify return payload contains valid HTML structures.
  </verify>
  <acceptance_criteria>
    - index.ts exposes /display/main routing.
    - index.ts serves dynamic compiled layout with text/html content-type.
  </acceptance_criteria>
  <done>Compositor routes are fully wired in and serving layouts</done>
</task>

<task type="auto">
  <name>Task 4: Write compositor layout unit tests</name>
  <files>core/server/compositor/compose.test.ts</files>
  <read_first>core/server/compositor/compose.ts</read_first>
  <action>
    Test dynamic compilation:
    1. Create test suite utilizing a mock active canvas configuration object.
    2. Verify absolute coordinate values appear correctly formatted in output div container style attributes.
    3. Assert that script snippets are injected without global namespace collisions.
  </action>
  <verify>
    Run `bun test core/server/compositor/compose.test.ts`
  </verify>
  <acceptance_criteria>
    - compose.test.ts runs successfully without failures.
    - Test asserts correct element placement properties are rendered.
  </acceptance_criteria>
  <done>Dynamic HTML composition tests are green and fully covered</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Verify bun test executes and compositor assertions pass.
- [ ] Make GET /display/main request and verify successful vanilla markup delivery.
</verification>

<success_criteria>
- Compositor correctly generates absolute containers from layouts.
- Dynamic layouts served with latency <5ms under test mockups.
</success_criteria>

<output>
After completion, create `.planning/phases/B-server/B-02-SUMMARY.md`
</output>
