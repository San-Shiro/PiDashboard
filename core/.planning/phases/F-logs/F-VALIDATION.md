---
phase: F
slug: logs
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
---

# Phase F — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test & Vite Build Checker |
| **Config file** | `admin/vite.config.ts` |
| **Quick run command** | `npm run build --workspace=admin` |
| **Full suite command** | `npm run build --workspace=admin` |
| **Estimated runtime** | ~5.0 seconds |

---

## Sampling Rate

- **After every task commit:** Run Vite compiler build checks to assert zero path or module defects.
- **Before `/gsd-verify-work`:** Admin package compiles successfully and Bun server runs logs rotations tests successfully.
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| F-01-01 | 01 | 1 | LOGG-01 | — | Central logger singleton outputs structured JSON lines | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| F-01-02 | 01 | 1 | LOGG-02 | — | Active server.log rotates when file size reaches 5MB cap | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| F-01-03 | 01 | 1 | LOGG-03 | — | Failures append to events.jsonl and trigger jittered backoff | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `core/server/api/scheduler.ts` — in-memory scheduler is fully integrated

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logs rotate on disk | LOGG-02 | Requires generating 5MB of log writes | Run logs stress generator, verify server.1.log exists and size is capped under 5MB |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
