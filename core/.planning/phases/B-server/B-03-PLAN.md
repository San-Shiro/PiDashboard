---
phase: B-server
plan: 03
type: execute
wave: 3
depends_on: ["01", "02"]
files_modified:
  - "core/server/api/system.ts"
  - "core/server/api/media.ts"
  - "core/server/api/system.test.ts"
  - "core/server/api/media.test.ts"
autonomous: true
requirements:
  - "SECO-02"
  - "SECO-03"
must_haves:
  truths:
    - "Entering Maintenance Mode successfully pauses interval schedulers."
    - "Asset file uploads successfully check and reject unsafe file extensions."
  artifacts:
    - path: "core/server/api/system.ts"
      provides: "Maintenance mode state control and direct proc parsing"
      contains: "maintenance"
    - path: "core/server/api/media.ts"
      provides: "File upload destination stream and list assets"
      contains: "media/uploads"
---

<objective>
Build the Maintenance Mode controllers, system hardware proc readers, and media file manager APIs.

Purpose: Delivers operational controls to scale down RAM allocation on demand and localize custom media assets.
Output: System controls and media upload APIs,proc parsing modules, and integration tests.
</objective>

<execution_context>
@~/.gemini/antigravity/get-shit-done/workflows/execute-plan.md
@~/.gemini/antigravity/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/B-server/B-02-SUMMARY.md
@.planning/phases/B-server/B-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build system controls and Maintenance Mode endpoints</name>
  <files>core/server/api/system.ts</files>
  <read_first>core/server/config/manager.ts</read_first>
  <action>
    Implement zero-daemon stats reading and maintenance worker control:
    1. Parse direct system hardware stats by reading /proc/meminfo (RAM), /proc/stat (CPU), and /sys/class/thermal/thermal_zone0/temp (CPU temperature) if they exist.
    2. Write POST /api/system/state route handling maintenance_mode: true|false.
    3. Expose active toggle state and ensure toggle disables/enables Tier 1b background fetch intervals.
  </action>
  <verify>
    Toggle maintenance mode state and check state response.
  </verify>
  <acceptance_criteria>
    - system.ts contains routes for system statistics and state control.
    - system.ts implements direct /proc reading with safety checks for non-Linux platforms (development fallback).
  </acceptance_criteria>
  <done>System stats and Maintenance Mode endpoints are fully operational</done>
</task>

<task type="auto">
  <name>Task 2: Build local media uploads manager API</name>
  <files>core/server/api/media.ts</files>
  <action>
    Implement media local upload stream and verification checks:
    1. GET /api/media — list uploaded files under media/uploads/ with size and metadata.
    2. POST /api/media/upload — handle multipart form file uploads.
    3. Restrict and reject files not matching image, video, or font MIME type extensions to maintain system safety.
    4. DELETE /api/media/:filename — remove localized media file from storage.
  </action>
  <verify>
    Upload a sample mock asset file and verify output list.
  </verify>
  <acceptance_criteria>
    - media.ts processes multipart file uploads using Bun's native write stream.
    - media.ts checks and rejects unsafe file extensions (e.g. .js, .sh).
  </acceptance_criteria>
  <done>Local media asset manager is operational with safe mime type filtering</done>
</task>

<task type="auto">
  <name>Task 3: Integrate operational endpoints into central router</name>
  <files>core/server/index.ts</files>
  <read_first>core/server/api/system.ts, core/server/api/media.ts</read_first>
  <action>
    Integrate endpoint pipelines:
    1. Update index.ts to import system API and media API modules.
    2. Mount endpoints protected under session gate checkAuth middleware.
    3. Serve media upload files statically via GET /media/* routes from media/uploads/.
  </action>
  <verify>
    Ensure GET /api/media and GET /api/system/stats requests return successfully.
  </verify>
  <acceptance_criteria>
    - index.ts mounts /api/system and /api/media routes.
    - index.ts static serves files under media/uploads/ on GET /media/*.
  </acceptance_criteria>
  <done>Operational and media endpoints are fully integrated into index.ts router</done>
</task>

<task type="auto">
  <name>Task 4: Write unit tests for operations and media APIs</name>
  <files>core/server/api/system.test.ts, core/server/api/media.test.ts</files>
  <read_first>core/server/api/system.ts, core/server/api/media.ts</read_first>
  <action>
    Test operational logic:
    1. Write system.test.ts testing that POST /api/system/state updates toggled configurations in memory.
    2. Write media.test.ts testing that POST /api/media/upload successfully processes multipart files and rejects unsafe file extensions.
  </action>
  <verify>
    Run `bun test core/server/api/system.test.ts` and `bun test core/server/api/media.test.ts`.
  </verify>
  <acceptance_criteria>
    - system.test.ts runs successfully without failures.
    - media.test.ts rejects unauthorized extensions.
  </acceptance_criteria>
  <done>System and media manager test suites are green and fully covered</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Verify bun test executes and all system/media assertions pass.
- [ ] Test uploading a safe image asset and verify successful delivery.
</verification>

<success_criteria>
- Maintenance Mode successfully stops background task schedulers.
- Media upload pipeline verifies and stores files.
</success_criteria>

<output>
After completion, create `.planning/phases/B-server/B-03-SUMMARY.md`
</output>
