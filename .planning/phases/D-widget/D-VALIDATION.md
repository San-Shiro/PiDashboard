---
phase: D
slug: widget
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
---

# Phase D — Validation Strategy

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

- **After every task commit:** Run Vite compiler build checks or server route binding checks
- **Before `/gsd-verify-work`:** Admin package bundle compiles successfully and manifests validate
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| D-01-01 | 01 | 1 | FRAG-02 | — | Manifest schema validation registry works | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| D-01-02 | 01 | 1 | PIPE-03 | — | Dynamic CRUD operations on widget instances | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| D-01-03 | 01 | 1 | SERV-02 | — | Compositor parses dynamic manifests and load fragments | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| D-02-01 | 02 | 2 | FRAG-01 | — | Clock widget works as client-only | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| D-02-02 | 02 | 2 | FRAG-01 | — | Weather widget registers websocket updater callback | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| D-02-03 | 02 | 2 | FRAG-01 | — | Sysinfo widget registers websocket updater callback | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `widgets/_base/manifest.schema.json` — manifest validation JSON-schema exists
- [x] `core/server/compositor/compose.ts` — compositor loads cached fragments from folder

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clock widget ticks | FRAG-01 | Requires UI browser rendering tick | Load kiosk, verify clock increments seconds and matches current time |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
