# Documentation Audit — `core/docs/`

Audit of 6 documentation files against the actual codebase in `core/`.

---

## 🔴 Critical Inaccuracies (Docs vs Code Mismatch)

These are claims in the documentation that **contradict what the code actually does**.

### 1. Manifest Schema Mismatch — [widget-development.md](file:///F:/VSCodium/Github/PiDashboard/core/docs/widget-development.md)

The documented manifest uses `"name"` for configSchema field keys, but the **actual manifests** use `"key"`:

| Doc Example (Line 48–71)        | Actual Code ([clock/manifest.json](file:///F:/VSCodium/Github/PiDashboard/core/widgets/clock/manifest.json)) |
|-|-|
| `"name": "targetDate"`          | `"key": "showSeconds"` |
| `"name": "themeColor"`          | `"key": "format"` |

The doc also shows a `defaults` block (`width`, `height`, `zIndex`) that **no actual widget manifest has**. Real manifests use an `entrypoints` object instead:

```diff
# Doc claims:
- "defaults": { "width": 300, "height": 180, "zIndex": 10 }

# Actual widget manifests have:
+ "entrypoints": { "fragment": "fragment/clock.html" }
```

> [!CAUTION]
> Anyone following the widget development guide will create manifests that don't match the schema at [_base/manifest.schema.json](file:///F:/VSCodium/Github/PiDashboard/core/widgets/_base/manifest.schema.json). The schema requires `entrypoints` (with `fragment` required), not `defaults`.

### 2. Logger Backup Count — [codebase-explanation.md](file:///F:/VSCodium/Github/PiDashboard/core/docs/codebase-explanation.md)

| Doc Claim (Line 63) | Actual Code ([logger.ts:22](file:///F:/VSCodium/Github/PiDashboard/core/server/utils/logger.ts#L22)) |
|-|-|
| "rolls from `server.log` to `server.8.log`, enforcing a strict **45MB** ceiling" | `MAX_BACKUPS = 8`, so total = 9 files × 5MB = **45MB** ✅ (this one is actually correct) |

However, the doc says **"11 distinct category domains"** (Line 61). The actual code defines exactly **11 categories** at [logger.ts:6-17](file:///F:/VSCodium/Github/PiDashboard/core/server/utils/logger.ts#L6-L17): AUTH, SERVER, COMPOSITOR, CANVAS, TEMPLATE, MEDIA, WIDGETS, SCHEDULER, WATCHER, WEBSOCKET, SYSTEM — ✅ matches.

### 3. Log File Location Not Mentioned — [codebase-explanation.md](file:///F:/VSCodium/Github/PiDashboard/core/docs/codebase-explanation.md#L60-L64)

The doc says logs rotate from `server.log` to `server.8.log` but **never states where they live**. Actual path: `state/cache/logs/server.log` ([logger.ts:19-20](file:///F:/VSCodium/Github/PiDashboard/core/server/utils/logger.ts#L19-L20)). This is important for operators troubleshooting on Pi.

### 4. README File Links Are Absolute Local Paths — [README.md](file:///F:/VSCodium/Github/PiDashboard/core/docs/README.md#L11-L20)

All 5 navigation links use `file:///f:/VSCodium/Github/PiDashboard/core/docs/...` paths. These are **local Windows filesystem paths** that will be broken for:
- Any GitHub visitor viewing the README
- Any collaborator cloning the repo
- The Pi itself

> [!CAUTION]
> These should be **relative markdown links** like `[Pi Installation](./pi-installation.md)`.

### 5. Go Example Uses Deprecated `ioutil` — [daemon-development.md](file:///F:/VSCodium/Github/PiDashboard/core/docs/daemon-development.md#L68)

The Go daemon example imports `"io/ioutil"` and calls `ioutil.WriteFile()` (Line 124). The `ioutil` package was **deprecated in Go 1.16** (2021). Should use `os.WriteFile()` instead.

```diff
- "io/ioutil"
+ // No ioutil import needed

- err = ioutil.WriteFile(tempPath, payload, 0644)
+ err = os.WriteFile(tempPath, payload, 0644)
```

### 6. `PrivateTmp=true` Conflicts with `/tmp/widgets` — [daemon-development.md](file:///F:/VSCodium/Github/PiDashboard/core/docs/daemon-development.md#L161)

The systemd service template has `PrivateTmp=true` (Line 161) AND `ReadWritePaths=/tmp/widgets` (Line 163). `PrivateTmp=true` gives the service **its own private `/tmp` namespace**, meaning it cannot access the real `/tmp/widgets` that the Bun server watches. These two directives contradict each other.

> [!WARNING]
> This will silently break IPC. The daemon will write to a namespaced `/tmp` that the Bun server can't see. Either remove `PrivateTmp=true` or change to `PrivateTmp=false`.

---

## 🟡 Missing Content / Gaps

### 7. No API Reference

The server exposes **20+ REST API endpoints** across auth, canvas, templates, widgets, media, and system domains ([index.ts](file:///F:/VSCodium/Github/PiDashboard/core/server/index.ts)). There is **no API reference doc**. Endpoints like:
- `POST /api/auth/setup` — first-run password creation
- `GET /api/widgets/registry` — widget catalog
- `POST /api/widgets/instances` — instantiate widget
- `PATCH /api/widgets/instances/:id` — update config
- `POST /api/templates/:id/apply` — apply a template preset
- `GET /api/system/state` — maintenance mode status
- `GET /api/system/wifi` / `GET /api/system/bluetooth`

…are undocumented. Anyone building integrations, custom admin UIs, or automation scripts has no reference.

### 8. No Scheduler / Backoff / IPC Internals Documented

The [scheduler.ts](file:///F:/VSCodium/Github/PiDashboard/core/server/api/scheduler.ts) implements sophisticated behavior:
- **Exponential backoff** with jitter (2^n, max 8x cap)
- **Auto-recovery detection** (restores base interval on success after failures)
- **Event journaling** to `state/cache/logs/events.jsonl`
- **100ms debounce** on `fs.watch` to collapse rapid OS write events
- **State hydration** on WebSocket connect (pushes cached state immediately)
- **Cross-platform IPC dir** resolution (`PIDASH_IPC_DIR` env → Linux `/tmp/widgets` → Windows `state/cache/widgets`)

None of this is documented anywhere. The codebase-explanation.md only covers the high-level "why", not the "how".

### 9. No Compositor Documentation

[compose.ts](file:///F:/VSCodium/Github/PiDashboard/core/server/compositor/compose.ts) (7.3KB) is the heart of the kiosk rendering pipeline. The docs mention it in passing but never explain:
- How fragments are composed into a single HTML page
- The auto-scale `ResizeObserver` injection
- How `data-widget` and `data-config` attributes are injected
- The WebSocket reconnection logic embedded in the output

### 10. No `CONTRIBUTING.md` or Project Root README

There's no top-level `README.md` at `/core/` or at the repo root `F:\VSCodium\Github\PiDashboard\` for GitHub visitors. The docs README lives inside `core/docs/` which isn't the conventional location.

### 11. No Troubleshooting / FAQ Section

Common operational issues aren't covered:
- What if the kiosk goes blank? (Check `systemctl status`, check logs)
- What if widgets stop updating? (Check tmpfs mount, daemon status, backoff events)
- How to reset the admin password?
- How to view live logs? (`journalctl -u pi-dashboard -f`)
- What if the SD card runs out of space?

### 12. No Environment Variables Reference

The codebase uses several env vars that are never documented together:
- `PIDASH_IPC_DIR` — custom IPC directory override
- `PORT` — server port (hardcoded to 3000 in code, but env-configurable in systemd)
- `DISPLAY` — for kiosk service

### 13. Widget Development: No Tier 2 Fragment Example

[widget-development.md](file:///F:/VSCodium/Github/PiDashboard/core/docs/widget-development.md) shows Tier 1a and 1b examples but **no Tier 2 fragment example** showing how the kiosk receives daemon-written data via the `__widgetUpdaters` callback. The daemon guide shows the Go writer, but the receiving fragment side is missing.

---

## 🟢 Quality / Polish Improvements

### 14. User Guide References Non-Existent Features

[user-guide.md](file:///F:/VSCodium/Github/PiDashboard/core/docs/user-guide.md) describes:
- **Z-Index Controls** / sliders (Line 31) — may not be implemented in the admin React UI
- **Opacity Slider** for glassmorphic elements (Line 32) — verify against admin source
- **"Lock Screen" button** in navigation footer (Line 17)

These should be verified against the actual admin panel React components.

### 15. No Versioning / Changelog Mention

The docs don't mention:
- Current project version (v1.0 was tagged)
- How to check what version is running
- Where to find release notes

### 16. Installation Guide: Missing `secrets/` Directory Setup

The [pi-installation.md](file:///F:/VSCodium/Github/PiDashboard/core/docs/pi-installation.md) installation steps don't mention creating the `secrets/` directory. The auth setup endpoint writes to `secrets/admin.passhash` ([index.ts:90](file:///F:/VSCodium/Github/PiDashboard/core/server/index.ts#L90)), and the code doesn't auto-create the directory.

### 17. Installation Guide: Missing `state/cache/` Directory

The [logger.ts](file:///F:/VSCodium/Github/PiDashboard/core/server/utils/logger.ts#L19) writes to `state/cache/logs/`. The logger auto-creates the `logs/` dir but assumes `state/cache/` exists. Similarly, on Windows dev, the IPC dir falls back to `state/cache/widgets/`. None of this is mentioned in setup.

### 18. Daemon Guide: No Signal Handling or Graceful Shutdown

The Go example has no `SIGTERM`/`SIGINT` handling. For a systemd-managed daemon, this means:
- No cleanup on `systemctl stop`
- Potential for half-written tmp files during shutdown
- No flush of last known state

### 19. No Diagram / Visual for Widget Tier Comparison

A table or diagram comparing Tier 1a vs 1b vs 2 (data source, update mechanism, example use case) would greatly help developers decide which tier to use.

---

## 📊 Summary

| Category | Count |
|----------|-------|
| 🔴 Critical Inaccuracies | 6 |
| 🟡 Missing Content | 7 |
| 🟢 Quality Polish | 6 |
| **Total Issues** | **19** |

### Priority Fixes (do these first)
1. Fix manifest schema mismatch in widget-development.md (**#1**)
2. Convert README links to relative paths (**#4**)
3. Fix `PrivateTmp` conflict in daemon systemd template (**#6**)
4. Replace deprecated `ioutil` in Go example (**#5**)
5. Add API reference doc (**#7**)
