# Phase F: Logging & Tiered Error Recovery - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add robust operations tooling, file logs rotation, crash analytics, and backoff retries. Expose rotational boundaries and JSONL error streams.

</domain>

<decisions>
## Implementation Decisions

### Structured JSON Logging (LOGG-01)
- **D-01:** Implement structured JSON format everywhere (both console output and rotated file logs) to simplify integration with external log aggregators like Datadog/ELK.
- **D-02:** Standardize log levels: `DEBUG`, `INFO`, `WARN`, `ERROR`.
- **D-03:** Standardize 11 distinct category buckets to capture specific system segments:
  - `AUTH`, `SERVER`, `COMPOSITOR`, `CANVAS`, `TEMPLATE`, `MEDIA`, `WIDGETS`, `SCHEDULER`, `WATCHER`, `WEBSOCKET`, `SYSTEM`.
- **D-04:** Log entries must follow a structured single-line format:
  ```json
  { "timestamp": "ISO-8601", "level": "INFO", "category": "SERVER", "message": "Host listening on port 3000", "meta": {} }
  ```

### Log File Rotation (LOGG-02)
- **D-05:** Rotated backups strategy: The active log file (`state/logs/server.log`) rotates to `server.1.log` (up to `server.8.log`) when it exceeds 5MB in size.
- **D-06:** Aggregate Footprint Cap: Retain at most 8 compressed/uncompressed rotated backups, capping the total file footprint strictly under 45MB.

### Exponential Backoff with Jitter (LOGG-03)
- **D-07:** Implement Exponential Backoff with Jitter for Tier 1b fetching timers:
  - Base interval is multiplied by `2^fails` up to a hard cap of 8x (or 10 minutes).
  - Add a small random jitter (+/- 1-5 seconds) to prevent thundering herd queries.
  - Reset to the default manifest interval instantly upon a successful HTTP query.
- **D-08:** Persistent Crash Recorder: Write every crash, network timeout, or server recovery failure atomically as a single-line JSON object to `state/logs/events.jsonl` (JSON Lines).

### the agent's Discretion
- **D-09:** Singleton implementation pattern for the central Logger class in `core/server/utils/logger.ts`.
- **D-10:** File stream write buffering vs. direct synchronous writes.
- **D-11:** Exact formatting of metadata fields in JSON structures.

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `core/server/api/scheduler.ts`: Contains Tier 1b fetch timers where HTTP failures happen. We can hook the scheduler backoff interval adjustment and `events.jsonl` writer here.
- `core/server/index.ts`: The main entry point where auth requests, API handlers, static routing, and server events can be comprehensively logged.

### Established Patterns
- Flat file database reads/writes.
- Isolated try/catch blocks protecting the async server lifecycle.

### Integration Points
- `core/server/utils/logger.ts`: The central logger script.
- `core/server/api/scheduler.ts`: Enforcing fetch backoffs and logging errors.
- `core/server/index.ts`: Logging API, WS, and routing events.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: F-logs*
*Context gathered: 2026-05-28*
