---
phase: B-server
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - "core/server/index.ts"
  - "core/server/api/auth.ts"
  - "core/server/config/manager.ts"
  - "core/server/api/auth.test.ts"
autonomous: true
requirements:
  - "SERV-01"
  - "SECO-01"
must_haves:
  truths:
    - "Bun server starts and binds successfully to port 3000."
    - "Argon2 session gate correctly validates login cookies."
  artifacts:
    - path: "core/server/index.ts"
      provides: "HTTP and WebSocket routing host"
      contains: "Bun.serve"
    - path: "core/server/api/auth.ts"
      provides: "Async session verification using Bun.password"
      contains: "Bun.password.verify"
    - path: "core/server/config/manager.ts"
      provides: "Atomic flat JSON configuration reading and writing"
  key_links:
    - from: "core/server/index.ts"
      to: "core/server/api/auth.ts"
      via: "API authentication route handling"
---

<objective>
Configure the central Bun HTTP server, config managers, and Argon2 cookie auth handlers.

Purpose: Establishes a zero-dependency, secure backend serving client admin modules and display kiosk endpoints.
Output: Core server entrypoint, configuration managers, security APIs, and login unit tests.
</objective>

<execution_context>
@~/.gemini/antigravity/get-shit-done/workflows/execute-plan.md
@~/.gemini/antigravity/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/B-server/B-RESEARCH.md
@.planning/phases/B-server/B-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build robust config manager</name>
  <files>core/server/config/manager.ts</files>
  <action>
    Create a robust configuration file read/write manager supporting atomic operations:
    1. Read config from config/config.json with default fallback configuration.
    2. Write config by writing to a temporary file config.json.tmp and renaming it to config.json atomically.
    3. Export get() and set() helper methods.
  </action>
  <verify>
    Execute simple read/write assertions.
  </verify>
  <acceptance_criteria>
    - manager.ts contains atomic write-rename logic.
    - manager.ts handles fallback configurations gracefully.
  </acceptance_criteria>
  <done>Config manager is operational and supports safe file writes</done>
</task>

<task type="auto">
  <name>Task 2: Build secure Argon2 Auth API and Session gate</name>
  <files>core/server/api/auth.ts</files>
  <read_first>core/server/config/manager.ts</read_first>
  <action>
    Implement zero-dependency security gate:
    1. Export login handler verifying password via Bun.password.verify against argon2 hashes saved under secrets/admin.passhash.
    2. Set a secure, httpOnly signed session cookie containing token payload.
    3. Export checkAuth middleware reading and validating signed cookie hashes.
  </action>
  <verify>
    Run auth tests.
  </verify>
  <acceptance_criteria>
    - auth.ts uses Bun.password.verify for hash comparison.
    - auth.ts writes secure, httpOnly, signed session cookies.
  </acceptance_criteria>
  <done>Argon2 cookie security gate is fully operational</done>
</task>

<task type="auto">
  <name>Task 3: Configure Bun.serve main router and entry point</name>
  <files>core/server/index.ts</files>
  <read_first>core/server/api/auth.ts</read_first>
  <action>
    Configure backend routing:
    1. Create Bun.serve listening on port 3000.
    2. Define routes: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/status protected by checkAuth.
    3. Serve pre-compiled Vite admin assets statically from admin/dist/ for remaining routes.
  </action>
  <verify>
    Verify Bun server starts and responds to HTTP requests.
  </verify>
  <acceptance_criteria>
    - index.ts configures Bun.serve.
    - index.ts handles /api/auth routes.
    - index.ts fallback serves admin/dist static directory.
  </acceptance_criteria>
  <done>Bun backend router successfully binds to port 3000 and resolves endpoints</done>
</task>

<task type="auto">
  <name>Task 4: Write auth integration unit tests</name>
  <files>core/server/api/auth.test.ts</files>
  <read_first>core/server/api/auth.ts</read_first>
  <action>
    Create test suite using bun test runner:
    1. Add assertions for valid and invalid credentials against a hashed test password.
    2. Test httpOnly cookie header existence on successful authentication.
    3. Test token validation middleware outcomes on mock requests.
  </action>
  <verify>
    Run `bun test core/server/api/auth.test.ts`
  </verify>
  <acceptance_criteria>
    - auth.test.ts executes successfully without exceptions.
    - Test validates correct and incorrect credentials.
  </acceptance_criteria>
  <done>Argon2 session test suite is green and fully covered</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Verify bun test executes and all assertions pass.
- [ ] Verify core server runs and returns 200 on basic API routes.
</verification>

<success_criteria>
- Core Bun server setup complete.
- Session gating verified through green unit tests.
</success_criteria>

<output>
After completion, create `.planning/phases/B-server/B-01-SUMMARY.md`
</output>
