# Archive

This directory contains reference-only material that is not part of the active PiDashboard implementation.

## Contents

- `workspaces/core/`: Previous top-level active workspace before `LiteDashboard/` was chosen as canonical.
- `workspaces/core_legacy_archive/`: Earlier legacy workspace snapshot.
- `prototypes/src-anything/`: UI draft exports and prototype app experiments.
- `artifacts/`: Historical generated bundles and backups.
- `handoffs/`: Old handoff notes that are useful for context but no longer define the active source of truth.

## Rules

- Do not make product changes directly in archived folders.
- Do not wire deployment, tests, or docs to archived code unless the task is explicitly archival research.
- If something from here is needed again, copy it into `../LiteDashboard/` and adapt it to the current app structure.
