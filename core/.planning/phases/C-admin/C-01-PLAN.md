---
phase: C-admin
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - "admin/package.json"
  - "admin/vite.config.ts"
  - "admin/src/main.tsx"
  - "admin/src/index.css"
autonomous: true
requirements:
  - "FRAG-03"
must_haves:
  truths:
    - "Vite compiles static client assets successfully."
    - "Vite local server correctly proxies /api requests to Bun."
  artifacts:
    - path: "admin/vite.config.ts"
      provides: "Proxy routing configurations and HTML bundles builds"
      contains: "proxy"
    - path: "admin/package.json"
      provides: "Pruned react and tailwind dependency manifest"
      contains: "\"tailwindcss\":"
    - path: "admin/src/main.tsx"
      provides: "ReactDOM root mounting node"
---

<objective>
Extract Vite React configuration architectures, package dependencies, and main entry roots.

Purpose: Creates a lightweight, high-performance static build pipeline for the React admin SPA.
Output: Custom Vite config, pruned packages manifests, and baseline SPA mounting endpoints.
</objective>

<execution_context>
@~/.gemini/antigravity/get-shit-done/workflows/execute-plan.md
@~/.gemini/antigravity/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/C-admin/C-VALIDATION.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Populate pruned package.json with admin dependencies</name>
  <files>admin/package.json</files>
  <read_first>src-anything/UI-Draft1/package.json</read_first>
  <action>
    Populate Vite package specifications:
    1. Clean admin/package.json to include dependencies: react, react-dom, @tanstack/react-query, lucide-react, tailwind-merge, react-colorful, and tsx.
    2. Add devDependencies: vite, typescript, tailwindcss, autoprefixer, postcss.
  </action>
  <verify>
    Check package schema and keys formatting correctness.
  </verify>
  <acceptance_criteria>
    - package.json lists vite as a devDependency.
    - package.json lists react and tailwindcss as core specifications.
  </acceptance_criteria>
  <done>Admin dependency package configurations are pruned and finalized</done>
</task>

<task type="auto">
  <name>Task 2: Write Vite and PostCSS build configurations</name>
  <files>admin/vite.config.ts</files>
  <action>
    Build compilation pipelines:
    1. Create admin/vite.config.ts importing viteReact and tailwind modules.
    2. Add dynamic development proxies redirecting GET/POST `/api/*` and `/ws/*` sockets calls to the port 3000 Bun backend.
    3. Configure bundle builds outputs to target `admin/dist`.
  </action>
  <verify>
    Vite compiler builds successfully without configuration errors.
  </verify>
  <acceptance_criteria>
    - vite.config.ts exports defineConfig settings.
    - vite.config.ts proxies `/api` endpoints to http://localhost:3000.
  </acceptance_criteria>
  <done>Vite building systems and server routing proxies are configured</done>
</task>

<task type="auto">
  <name>Task 3: Scaffold index.css and entrance roots</name>
  <files>admin/src/main.tsx, admin/src/index.css</files>
  <read_first>src-anything/UI-Draft1/apps/web/src/index.css</read_first>
  <action>
    Scaffold entrance files:
    1. Create admin/src/index.css injecting tailwind baseline directives (@tailwind base; @tailwind components; @tailwind utilities;) and root dark CSS variable colors.
    2. Create admin/src/main.tsx mounting standard React root elements inside div node id "root".
  </action>
  <verify>
    Verify files exists on disk and are syntax error free.
  </verify>
  <acceptance_criteria>
    - index.css contains Tailwind directives.
    - main.tsx imports ReactDOM mounting methods.
  </acceptance_criteria>
  <done>React baseline roots and Tailwind files are successfully scaffolded</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Verify workspaces links compile correctly.
- [ ] Verify Vite config successfully routes server setups.
</verification>

<success_criteria>
- Vite build configurations finalized.
- Admin packages linked to server workspaces.
</success_criteria>

<output>
After completion, create `.planning/phases/C-admin/C-01-SUMMARY.md`
</output>
