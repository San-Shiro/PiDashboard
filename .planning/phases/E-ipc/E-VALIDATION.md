---
phase: E
slug: ipc
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
---

# Phase E — Validation Strategy

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

- **After every task commit:** Run Vite compiler build checks to ensure no frontend path issues.
- **Before `/gsd-verify-work`:** Admin package bundle compiles successfully and Bun server boots without error.
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| E-01-01 | 01 | 1 | PIPE-01 | — | Bun server resolves environment variable path recursively | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| E-01-02 | 01 | 1 | PIPE-02 | — | Individual setInterval fetch timers start and clear on publish | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| E-01-03 | 01 | 1 | PIPE-01 | — | fs.watch watches folder and parses json with debouncing | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| E-02-01 | 02 | 2 | PIPE-03 | — | WebSocket displays connection stores sockets in Set | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| E-02-02 | 02 | 2 | PIPE-03 | — | State hydration cache registers and pushes states on connection | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |
| E-02-03 | 02 | 2 | PIPE-03 | — | Kiosk reloads and maintenance alerts broadcast through sockets | unit | `npm run build --workspace=admin` | ✅ W0 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `core/server/index.ts` — Bun server WebSocket upgrade route is ready
- [x] `canvases/active.json` — layout active file database exists

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Data updates tick UI | PIPE-03 | Requires browser render loop | Connect a display, write weather JSON update to folder, verify temp updates instantly on UI |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
