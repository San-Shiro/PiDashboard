# Requirements: PiDashboard

**Defined:** 2026-05-28
**Core Value:** Deliver premium, responsive, and visually stunning dashboard kiosk displays on low-resource hardware by decoupling the React-based admin control panel from a zero-framework, Bun-composited HTML display client.

## v1 Requirements

### Core Server & Compositor (SERV)
- [x] **SERV-01**: Bun HTTP and WebSocket server running as a single lightweight daemon on the Pi.
- [x] **SERV-02**: Compositor reads canvas JSON and dynamic widget fragments, wrapping them in structured containers and outputting a single vanilla HTML page.
- [x] **SERV-03**: Kiosk display script dynamically handles window scaling and auto-fit using vanilla JS to match display resolutions.

### Drag-and-Drop Layout (LAYT)
- [ ] **LAYT-01**: Admin dashboard provides interactive drag-and-drop widget arrangement with resizing, z-index layering, and opacity sliders.
- [ ] **LAYT-02**: Save and load layouts as named templates (canvases/saved/*.json) and activate layouts client-side.
- [x] **LAYT-03**: Published layouts are written atomically to `canvases/active.json` to act as the single source of truth for the display page.

### Widget Fragments (FRAG)
- [ ] **FRAG-01**: Widgets are packaged as self-contained HTML/CSS/JS snippet files (fragments) with zero dependencies on JS frameworks.
- [ ] **FRAG-02**: All widgets contain a standardized JSON manifest defining properties, configuration schema, and execution tier (Tier 1a, Tier 1b, or Tier 2).
- [ ] **FRAG-03**: Admin panel renders dynamic forms for each widget manifest's configuration schema (`ManifestField`).

### IPC & WebSocket Pipeline (PIPE)
- [ ] **PIPE-01**: Bun watches `/tmp/widgets/*.json` in-memory RAM disk using `fs.watch` for immediate IPC updates.
- [ ] **PIPE-02**: Bun scheduler manages Tier 1b widgets' polling intervals and fetches remote HTTP data, saving it to the tmpfs IPC folder.
- [ ] **PIPE-03**: Real-time push websocket sends data updates, full kiosk reloads, and maintenance alerts using a strict 3-message protocol.

### Security, Media, & Operations (SECO)
- [x] **SECO-01**: Web admin is protected by an Argon2 password session gate with secure cookies.
- [x] **SECO-02**: Media manager API handles image/video asset uploads, metadata retrieval, and references validation against active canvases.
- [x] **SECO-03**: Maintenance mode pauses all polling intervals and stops active daemons, rendering a minimal, low-resource static page on kiosks to drop RAM usage.

### Logging & Crash Recovery (LOGG)
- [ ] **LOGG-01**: Structured, lightweight logging system records messages across 4 levels and 11 distinct system categories.
- [ ] **LOGG-02**: Log files are automatically rotated and capped at a strict 45MB max disk footprint to avoid filling system storage.
- [ ] **LOGG-03**: Persistent JSONL crash recorder tracks error events, enabling exponential backoff on fetch retries.

## v2 Requirements
- **MKT-01**: Local marketplace interface to install custom user widget fragments from zip archives.
- **DISP-02**: Support for driving multiple distinct physical kiosk displays from a single server instance with unique canvases.

## Out of Scope

| Feature | Reason |
|:---|:---|
| React on Kiosk Display | React bundles are heavy. Vanilla HTML is used to keep display RAM usage to ~5KB. |
| Background Database Engines | Heavy memory footprint. Flat JSON and memory-mapped files suffice. |

## Traceability

| Requirement | Phase | Status |
|:---|:---|:---|
| SERV-01 | Phase B | Complete |
| SERV-02 | Phase B | Complete |
| SERV-03 | Phase B | Complete |
| LAYT-01 | Phase C | Pending |
| LAYT-02 | Phase C | Pending |
| LAYT-03 | Phase B | Complete |
| FRAG-01 | Phase D | Pending |
| FRAG-02 | Phase D | Pending |
| FRAG-03 | Phase C | Pending |
| PIPE-01 | Phase E | Pending |
| PIPE-02 | Phase E | Pending |
| PIPE-03 | Phase D | Pending |
| SECO-01 | Phase B | Complete |
| SECO-02 | Phase B | Complete |
| SECO-03 | Phase B | Complete |
| LOGG-01 | Phase F | Pending |
| LOGG-02 | Phase F | Pending |
| LOGG-03 | Phase F | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-28*
*Last updated: 2026-05-28 after Phase B completion*
