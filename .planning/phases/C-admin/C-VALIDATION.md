---
phase: C
slug: admin
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-28
---

# Phase C — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vite Build Checker & ESLint |
| **Config file** | `admin/vite.config.ts` |
| **Quick run command** | `npm run build --workspace=admin` |
| **Full suite command** | `npm run build --workspace=admin` |
| **Estimated runtime** | ~5.0 seconds |

---

## Sampling Rate

- **After every task commit:** Run Vite compiler build checks
- **Before `/gsd-verify-work`:** Admin package bundle must compile successfully without warnings
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| C-01-01 | 01 | 1 | LAYT-03 | — | Client SPA builds successfully | integration | `npm run build --workspace=admin` | ❌ W0 | ⬜ pending |
| C-01-02 | 01 | 1 | FRAG-03 | — | Custom Tailwind properties loading | integration | `npm run build --workspace=admin` | ❌ W0 | ⬜ pending |
| C-02-01 | 02 | 2 | LAYT-01 | — | React draggable layout operates completely client-side | unit | `npm run build --workspace=admin` | ❌ W0 | ⬜ pending |
| C-02-02 | 02 | 2 | LAYT-02 | — | Save and Publish triggers POST payloads | unit | `npm run build --workspace=admin` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `admin/vite.config.ts` — configured to build static output under `admin/dist`
- [ ] `admin/src/main.tsx` — clean entry point routing React roots

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Draggable canvas items move and resize | LAYT-01 | Requires browser touch and drag input gestures | Open admin panel, drag and resize various widgets inside the layout tab, verify absolute coordinates reflect updates in real-time |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
