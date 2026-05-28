---
phase: F-logs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - "core/server/index.ts"
  - "core/server/api/scheduler.ts"
files_created:
  - "core/server/utils/logger.ts"
autonomous: true
requirements:
  - "LOGG-01"
  - "LOGG-02"
  - "LOGG-03"
must_haves:
  truths:
    - "Central logger singleton outputs structured single-line JSON logs for both files and console."
    - "Active server.log rotates when it hits 5MB, keeping at most 8 backups and capping total footprint under 45MB."
    - "Consecutive fetch failures trigger jittered exponential backoffs up to 8x and write to events.jsonl."
  artifacts:
    - path: "core/server/utils/logger.ts"
      provides: "Structured JSON logger with levels, categories, console/file outputs, and rotation logic"
      contains: "logger"
    - path: "core/server/api/scheduler.ts"
      provides: "Http fetch backoffs, state cache resetting, and JSONL events crash logging"
      contains: "events.jsonl"
---

<objective>
Implement structured JSON logger utility, rotation-aware log file shifting system, and jittered exponential retry backoffs for widget fetchers.

Purpose: Deploys professional logging, crash analysis, and self-healing reliability mechanisms suitable for low-resource daemons.
Output: Logger singletons, 5MB log file rotators, and events.jsonl recorders.
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
@.planning/phases/F-logs/F-CONTEXT.md
@.planning/phases/F-logs/F-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Centralized Structured JSON Logger</name>
  <files>core/server/utils/logger.ts</files>
  <read_first>
    - core/server/index.ts
  </read_first>
  <action>
    Create core/server/utils/logger.ts:
    1. Implement central Logger class with standard severity levels: DEBUG, INFO, WARN, ERROR.
    2. Enforce structured JSON logging for BOTH console output (process.stdout) and log files to ensure ELK/Datadog compatibility.
    3. Ensure log lines conform to a single-line JSON format carrying keys: timestamp, level, category, message, and optional meta:
       `{"timestamp":"2026-05-28T21:00:00.000Z","level":"INFO","category":"SERVER","message":"Server started","meta":{}}`
    4. Implement methods info(), warn(), error(), debug() with category restriction filters (AUTH, SERVER, COMPOSITOR, CANVAS, TEMPLATE, MEDIA, WIDGETS, SCHEDULER, WATCHER, WEBSOCKET, SYSTEM).
    5. Ensure target file write directories (state/logs/) are initialized recursively.
  </action>
  <verify>
    Run npm run build --workspace=admin to check logger compilation.
  </verify>
  <acceptance_criteria>
    - core/server/utils/logger.ts exports a singleton logger instance.
    - Logger outputs stringified JSON objects to console.
    - Logs write cleanly to state/logs/server.log.
  </acceptance_criteria>
  <done>Structured JSON logger with levels and categories is complete</done>
</task>

<task type="auto">
  <name>Task 2: Build Rotation-Aware logs filesystem shift</name>
  <files>core/server/utils/logger.ts</files>
  <read_first>
    - core/server/utils/logger.ts
  </read_first>
  <action>
    Implement log rotation inside core/server/utils/logger.ts file appending routines:
    1. On log write, check size of state/logs/server.log.
    2. If size is >= 5,000,000 bytes (5MB):
       - Delete server.8.log if exists.
       - Rename server.7.log to server.8.log, server.6.log to server.7.log, ..., server.log to server.1.log recursively.
       - Create a new, blank server.log and write the new log record.
    3. Ensure total footprint across active and all 8 backup files never exceeds 45MB, protecting SD card space.
  </action>
  <verify>
    Check compile state.
  </verify>
  <acceptance_criteria>
    - File size check runs synchronously or atomically on file appends.
    - Shift renaming propagates log backups sequentially.
    - Capped at at most 8 rotated log backup files.
  </acceptance_criteria>
  <done>Rotation-aware log file shifter capping disk footprint at 45MB is operational</done>
</task>

<task type="auto">
  <name>Task 3: Implement JSONL crash events recorder and fetch exponential backoff</name>
  <files>core/server/api/scheduler.ts, core/server/index.ts</files>
  <read_first>
    - core/server/api/scheduler.ts
    - core/server/index.ts
  </read_first>
  <action>
    Integrate logs, persistent events, and jittered exponential retry backoffs:
    1. Import the singleton logger into core/server/index.ts and core/server/api/scheduler.ts. Wrap main server actions and route handlers in info/warn/error logs matching category definitions.
    2. Inside core/server/api/scheduler.ts, implement recordEvent(event, widgetId, error, meta) to append single-line JSON objects atomically to `state/logs/events.jsonl` (JSON Lines).
    3. Modify startWidgetScheduler() fetch routine:
       - On HTTP fetch failure, record a "fetch_failed" event in events.jsonl.
       - Track failure count in fetchAttempts Map: attempts = (fetchAttempts.get(id) || 0) + 1.
       - Calculate backed off interval: Math.min(baseInterval * Math.pow(2, attempts), baseInterval * 8) (max 8x or 10 minutes).
       - Add Jitter: const jitter = (Math.random() * 4 - 2) * 1000 (adds/subtracts 1-2 seconds).
       - Cancel active setInterval ticker for the widget: clearInterval(fetchTimers.get(id)).
       - Schedule a single-shot setTimeout retry utilizing the backed off interval.
       - If retry succeeds:
         - Clear attempt count: fetchAttempts.delete(id).
         - Re-register the standard base setInterval ticker.
         - Record a "fetch_recovered" event in events.jsonl and logger.
  </action>
  <verify>
    Verify compilation and verify Bun server boots cleanly.
  </verify>
  <acceptance_criteria>
    - Failures write single-line JSON entries to state/logs/events.jsonl.
    - Fetch timers back off exponentially (2x, 4x, 8x max cap) upon consecutive request failures.
    - Poll timers restore to base manifest intervals cleanly upon successful recoveries.
  </acceptance_criteria>
  <done>JSONL crash events recorder and fetchers exponential backoffs are fully integrated</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] Run `npm run build --workspace=admin` to ensure Vite compilations are green.
</verification>

<success_criteria>
- Structured JSON outputs written cleanly to console and files.
- Backup log rotations shift logs under a strict 45MB footprint.
- Scheduler fetchers back off exponentially on errors and recover smoothly.
</success_criteria>

<output>
After completion, create `.planning/phases/F-logs/F-01-SUMMARY.md`
</output>
