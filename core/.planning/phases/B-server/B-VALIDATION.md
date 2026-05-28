---
phase: B
slug: server
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
---

# Phase B — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun Native Test (`bun test`) |
| **Config file** | none — natively supported by Bun |
| **Quick run command** | `bun test` |
| **Full suite command** | `bun test` |
| **Estimated runtime** | ~0.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun test`
- **After every plan wave:** Run `bun test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| B-01-01 | 01 | 1 | SERV-01 | T-B-01 | Secure Argon2 session cookie validation | integration | `bun test core/server/api/auth.test.ts` | ❌ W0 | ⬜ pending |
| B-01-02 | 01 | 1 | SECO-01 | T-B-02 | Redirect to /login if unauthenticated | integration | `bun test core/server/api/auth.test.ts` | ❌ W0 | ⬜ pending |
| B-02-01 | 02 | 2 | SERV-02 | — | Dynamically composed HTML outputs valid elements | unit | `bun test core/server/compositor/compose.test.ts` | ❌ W0 | ⬜ pending |
| B-02-02 | 02 | 2 | SERV-03 | — | Kiosk viewport auto-scales active sizes | manual | (manual verification) | — | ⬜ pending |
| B-03-01 | 03 | 3 | SECO-03 | — | Disabling workers on maintenance request | unit | `bun test core/server/api/system.test.ts` | ❌ W0 | ⬜ pending |
| B-03-02 | 03 | 3 | SECO-02 | T-B-03 | Validate uploaded files are safe image types | integration | `bun test core/server/api/media.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `core/server/compositor/compose.test.ts` — stubs for compositor validation tests
- [ ] `core/server/api/auth.test.ts` — stubs for login session gate validation tests
- [ ] `core/server/api/media.test.ts` — stubs for upload payload validation tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Viewport scaling on screen resize | SERV-03 | Requires browser viewport resize events and visual inspections | Resize browser window during live preview and check that CSS custom properties scale accordingly |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 1s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
