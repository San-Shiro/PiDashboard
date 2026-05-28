---
phase: D-widget
plan: 02
type: execute
wave: 2
depends_on: ["01"]
files_created:
  - "widgets/clock/manifest.json"
  - "widgets/clock/fragment/clock.html"
  - "widgets/weather/manifest.json"
  - "widgets/weather/fragment/weather.html"
  - "widgets/sysinfo/manifest.json"
  - "widgets/sysinfo/fragment/sysinfo.html"
autonomous: true
requirements:
  - "FRAG-01"
  - "FRAG-02"
must_haves:
  truths:
    - "Clock widget fragment displays dynamic times and dates without external server polling."
    - "Weather widget fragment registers window updaters and displays temperature and condition updates dynamically."
    - "Sysinfo widget fragment registers updaters and displays system loads, memory usage, and thermal values."
  artifacts:
    - path: "widgets/clock/manifest.json"
      provides: "Clock widget metadata and configuration options schema"
    - path: "widgets/clock/fragment/clock.html"
      provides: "Clock vanilla JS/CSS/HTML fragment"
    - path: "widgets/weather/manifest.json"
      provides: "Weather widget manifest configuration options schema"
    - path: "widgets/weather/fragment/weather.html"
      provides: "Weather vanilla JS/CSS/HTML fragment registering global updaters"
    - path: "widgets/sysinfo/manifest.json"
      provides: "Sysinfo widget manifest configuration options schema"
    - path: "widgets/sysinfo/fragment/sysinfo.html"
      provides: "Sysinfo vanilla JS/CSS/HTML fragment registering global updaters"
---

<objective>
Implement canonical modular widget fragments for Clock (Tier 1a), Weather (Tier 1b), and Sysinfo (Tier 2).

Purpose: Delivers highly visual, lightweight, zero-framework widgets that operate completely client-side.
Output: Clock, Weather, and Sysinfo manifests and vanilla HTML/CSS/JS fragments.
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
@.planning/phases/D-widget/D-01-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build Clock widget manifest and self-contained fragment</name>
  <files>widgets/clock/manifest.json, widgets/clock/fragment/clock.html</files>
  <action>
    Create Clock widget:
    1. Create widgets/clock/manifest.json defining core metadata, tier: "1a" (client-only), showSeconds boolean and format (12h/24h) options in configSchema.
    2. Create widgets/clock/fragment/clock.html. The snippet must render time and date, use query selectors scoped strictly inside its parent `[data-widget="clock"]` to prevent global contamination, and tick every 1000ms using a clean `setInterval`.
  </action>
  <verify>
    Verify Clock fragment renders correctly and configures based on user settings.
  </verify>
  <acceptance_criteria>
    - clock.html uses standard scoping and ticks time.
    - configSchema defines format and showSeconds options.
  </acceptance_criteria>
  <done>Clock widget fragment and configuration metadata manifest is complete</done>
</task>

<task type="auto">
  <name>Task 2: Build Weather widget manifest and self-contained fragment</name>
  <files>widgets/weather/manifest.json, widgets/weather/fragment/weather.html</files>
  <action>
    Create Weather widget:
    1. Create widgets/weather/manifest.json defining tier: "1b" (Bun-fetched), location and units (metric/imperial) options in configSchema.
    2. Create widgets/weather/fragment/weather.html. Scopes styling, and registers `window.__widgetUpdaters["weather"]` to update DOM values instantly when websocket data arrives.
  </action>
  <verify>
    Verify Weather fragment registers global updater and updates temp/condition correctly.
  </verify>
  <acceptance_criteria>
    - weather.html registers window weather updater callback.
    - configSchema defines location and units options.
  </acceptance_criteria>
  <done>Weather widget fragment and configuration metadata manifest is complete</done>
</task>

<task type="auto">
  <name>Task 3: Build Sysinfo widget manifest and self-contained fragment</name>
  <files>widgets/sysinfo/manifest.json, widgets/sysinfo/fragment/sysinfo.html</files>
  <action>
    Create Sysinfo widget:
    1. Create widgets/sysinfo/manifest.json defining tier: "2" (native daemon), and standard metadata.
    2. Create widgets/sysinfo/fragment/sysinfo.html. Scopes styling, and registers `window.__widgetUpdaters["sysinfo"]` to update CPU, Memory, thermal degree Celsius and uptime.
  </action>
  <verify>
    Verify Sysinfo fragment registers updater and binds CPU/Memory metrics correctly.
  </verify>
  <acceptance_criteria>
    - sysinfo.html registers window sysinfo updater callback.
  </acceptance_criteria>
  <done>Sysinfo widget fragment and configuration metadata manifest is complete</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Run `npm run build --workspace=admin` to verify that there are zero compilation failures.
</verification>

<success_criteria>
- Vanilla clock fragment ticks on interval.
- Weather and sysinfo fragments bind global websocket updaters successfully.
</success_criteria>

<output>
After completion, create `.planning/phases/D-widget/D-02-SUMMARY.md`
</output>
