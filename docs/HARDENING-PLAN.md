# PiDashboard Core Hardening Plan

> **Status:** Phases 0–4 implemented. Phase 3 command channel is complete,
> including the ack channel (3.4) and per-sender instance scoping (3.5). Command
> acks ride a lightweight `ack` signal keyed by (widget, instance) — extracted
> from the daemon's `_ack` state field server-side so it is never persisted —
> and `patch`/`cmd` from iframe widgets are scoped to the sender's own instance,
> derived from the posting iframe (`e.source`) rather than the claimed value.
> **Scope:** Close the security/robustness gaps in core, then design the two
> subsystems that are currently unfinished — the UI↔daemon command channel and
> hardware (GPIO / multi-board) support.
> **Non-goal for now:** MagicMirror compatibility shim. That comes after core is polished.
>
> **Known pre-existing test failures (not introduced here):** `Compositor > handles
> empty canvas` (brittle assertion — `data-widget=` appears inside the WS client
> script string) and `Canvas Validator > rejects unknown widget_id` (validator
> was deliberately changed to warn-and-drop rather than hard-fail). Both predate
> this work; decide separately whether to update the tests or revert the behavior.
>
> **Note on `widget_state_save`:** no browser/iframe path emits it (it is a direct
> WS message), so there is no forgeable instance to scope at the kiosk. Its
> server-side instance name is regex-sanitized. If a widget-facing save path is
> added later, apply the same `e.source` scoping used for `patch`/`cmd`.

## Guiding principle

The state file *is* the architecture. Every mechanism added below rides the
existing file-based pipeline rather than introducing a parallel transport.
Commands are files. Acknowledgements are state. GPIO is a daemon.

---

## Phase 0 — Stop the bleeding

Independent, mechanical fixes. No design decisions, no migration risk. Ship first.

| # | Fix | Location | Why it matters |
|---|-----|----------|----------------|
| 0.1 | Delete cookie logging | `core/server/api/auth.ts:32` | Logs session tokens on every authenticated request, into a buffer that unauthenticated WS clients can subscribe to |
| 0.2 | Sanitize `manifest.id` before path join | `core/server/api/widgets.ts:45` | `id: "../core"` → `rmSync` deletes core, `cpSync` writes arbitrary files → RCE |
| 0.3 | Whitelist `layout.transition`, clamp `filter.blur` | `core/engine/validators/canvas-validator.ts` | Both interpolate unescaped into `style="..."` → attribute break → XSS |
| 0.4 | Remove duplicate `?v=` cache-bust | `core/engine/compositor.ts:342,419` | Produces `pi-theme.js?v=1?v=2`; SDK re-downloads every load despite `max-age=86400` |
| 0.5 | Fix `verifyDependencies` | `core/server/daemon/daemon-manager.ts:386` | `spawnSync('command', …)` — shell builtin, never throws, always reports zero missing deps |
| 0.6 | Fix import path | `core/tools/validate-widgets.ts:3` | Points at `../server/engine/validators/…` which does not exist; CLI is dead |
| 0.7 | Bail frame loop when no callbacks registered | `core/sdk/pi-widget.js:195` | Unconditional `requestAnimationFrame` recursion burns CPU on an idle Pi Zero |
| 0.8 | Batch + rate-limit kiosk log POSTs; drop `console.log` interception in prod | `core/engine/compositor.ts:511-525` | One HTTP POST per log line; an error inside a 60fps loop is a self-DoS |
| 0.9 | Raise default `maxStaleSec`, split liveness from freshness | `core/server/daemon/daemon-manager.ts:165` | 30s default kills any daemon polling slower than that (weather at 10min → permanent crash loop) |
| 0.10 | Add `test` script + CI | `package.json` | Six real test files exist and nothing runs them |

**Exit criterion:** `bun test` green in CI; no session tokens in logs.

---

## Phase 1 — Make the sandbox real

**Problem.** Trust is self-declared by the widget and defaults to the most
privileged tier.

- `core/tools/server.ts:61` — `if (!manifest.trust) manifest.trust = 'core'`
- `core/engine/compositor.ts:334` — only `trust === 'community'` is iframed;
  `core`, `verified`, **and `unsafe`** all render inline in the top-level page
- `core/server/api/widgets.ts` — install never calls `validateWidget`

Net effect: a downloaded `.wig` that omits `trust`, or writes `"trust": "core"`,
executes unsandboxed with access to `window.__piWs`, `fetch`, and cookies.

### 1.1 Trust by provenance, not by claim

Server-owned registry at `config/widget-provenance.json` (outside any
widget directory, since widget dirs contain attacker-controlled content):

```json
{ "weather": { "source": "builtin", "trust": "core" },
  "community-flight-tracker": { "source": "installed", "trust": "community", "installedAt": "..." } }
```

Resolution rules:
- Widget shipped in the repo tree at first boot → `builtin`, may claim up to `core`
- Widget arriving via `/api/widgets/install` → `installed`, capped at `community`
- Unknown / missing provenance → **`community`** (default deny, never `core`)
- A manifest may request *less* privilege than provenance allows, never more

### 1.2 Explicit trust → isolation table

Replace the single equality check with a table, so a new tier can never
accidentally fall through to the privileged branch:

| trust | isolation |
|-------|-----------|
| `core` | inline, full page scope |
| `verified` | inline, shadow DOM |
| `community` | iframe, `sandbox="allow-scripts"` |
| `unsafe` | iframe, `sandbox="allow-scripts"`, no daemon/command access |

### 1.3 Validate on install

Call `validateWidget` in the install path and reject on error. Enforce
`id` matching `/^[a-z0-9][a-z0-9-]{0,63}$/`, and require installed widget ids
to carry the `community-` prefix (the delete endpoint already assumes this).

**Migration impact:** low. Of 37 widgets, only `volume-osd` omits `trust`
(silently promoted to `core` today). `verified` widgets move from bare-inline to
shadow-DOM-inline. Nothing regresses to a *more* privileged tier.

**Verification:** an installed `.wig` declaring `"trust": "core"` must still
render inside an iframe.

---

## Phase 2 — Authenticate the transport

**Problem.** `core/tools/server.ts:225` upgrades WebSockets with no auth, and
`core/server/ws/display.ts:124` takes the client's word for its role. An
unauthenticated LAN client can claim `role: 'admin'`, then spawn daemons via
`preview`, read logs via `subscribe_logs`, and write files via
`widget_state_save`.

### 2.1 Server-assigned roles

- Remove `role` from the `hello` message and from `handleHeartbeat` entirely.
- The server derives role from the session cookie presented at upgrade:
  valid admin session → `admin`; everything else → `display`.
- `display` is receive-mostly: it may send `patch` and `cmd` scoped to its own
  instances (Phase 3), and nothing else.
- `preview` and `subscribe_logs` become admin-only, enforced server-side.

The kiosk browser stays unauthenticated but unprivileged — no device token
needed, because `display` can no longer do anything dangerous.

### 2.2 Session hygiene

- Enforce server-side session expiry (currently only the cookie `Max-Age`
  expires; the in-memory session is immortal until restart)
- Rate-limit `/api/auth/login`
- Raise minimum password length from 4

---

## Phase 3 — The capability & command channel

This phase answers the open design question: **how do buttons and input fields
talk to daemons?** It is also the correct fix for the `handleCmd` ownership hole
— they are the same problem.

**Problem today.** `handleCmd` (`display.ts:185`) forwards any `{daemon, data}`
verbatim, and `PiWidget.cmd(daemon, payload)` lets the widget name the target.
One widget can command any other widget's daemon. There is no validation, no
acknowledgement, and no response path — a button cannot know whether it worked.

### 3.1 Declare the command surface in the manifest

Parallel to the existing `configSchema`:

```json
"commands": [
  { "name": "set_volume", "params": { "level": { "type": "number", "min": 0, "max": 100 } } },
  { "name": "next_track" }
]
```

### 3.2 The client never names the daemon

The client sends its **own instance id** and a command name:

```json
{ "type": "cmd", "instance": "w_abc123", "name": "next_track", "params": {} }
```

The server resolves `instance → widget → manifest → daemon`, checks `name`
against `manifest.commands`, validates `params` against the declared types, then
writes the command file. Cross-widget command injection becomes structurally
impossible, because the daemon id never crosses the trust boundary.

Ownership data already exists — `reconcile()` builds `${manifest.daemon}__${widget.id}`.

### 3.3 Transport: reuse the existing `.cmd.json`

Already used for `config_update` and `refresh`. Extend with an id:

```json
{ "id": "c17", "action": "next_track", "params": {}, "ts": 1234567890 }
```

Stays language-agnostic — a bash daemon can `cat` it. No new transport.

### 3.4 Acknowledgement rides the state channel

The daemon writes an ack into its normal state file:

```json
{ "track": "Blue Monday", "_ack": { "id": "c17", "ok": true } }
```

The existing IPC watcher → state broadcast path delivers this to the UI for
free. The SDK correlates by id and resolves a promise, making
`await widget.callDaemon(…)` work with **no new plumbing**.

### 3.5 Buttons vs input fields — the ownership rule

> If it changes what the widget **is**, it's config.
> If it changes what the widget is **showing right now**, it's state.

- **Buttons** → a named command from `manifest.commands`, validated server-side
- **Ephemeral input** (notepad text, toggle position) → `patchState`, widget-owned,
  persisted when `manifest.persist`; must be scoped to the sender's own instance
  (it currently is not)
- **Configuration input** (API key, city) → admin-only via the canvas API,
  triggers `refresh`

### 3.6 Backpressure

Rate-limit commands per instance (~10/s). A touchscreen button held down must
not translate into unbounded file writes.

---

## Phase 4 — Board profiles & GPIO as a capability

### Current state

Worse than it appears, which is good news — there is little to preserve:

- **`gpioBindings` are write-only.** Saved to `config.json`, read back by the GET
  endpoint, and **acted on by nothing**. There is no edge watcher. The GPIO
  button feature is a UI that persists dead configuration.
- **`daemons/gpio-daemon.sh` is orphaned.** It writes `/tmp/widgets/gpio.json`;
  the IPC watcher watches `state/ipc/`. It also hardcodes a *different* pin list
  than `AVAILABLE_PINS` in `gpio.ts`.
- **sysfs GPIO is deprecated.** `/sys/class/gpio` is gone on modern kernels
  without `CONFIG_GPIO_SYSFS`, and the Pi 5 (RP1) changed GPIO numbering
  entirely. This code will not work on a Pi 5.
- **No board detection exists anywhere.**

### 4.1 Board profiles (the WLED-shaped part)

```
boards/
  raspberry-pi-zero-2w.json
  raspberry-pi-4b.json
  raspberry-pi-5.json
  generic-linux.json        # GPIO disabled
```

Each profile declares:

- GPIO backend: `libgpiod` | `sysfs` | `none`, plus chip name
- Pin map with per-pin capability (`in`, `out`, `pwm`, `i2c`, `spi`, `reserved`)
- RAM class (drives `runtimeTier` admission)
- Feature flags

**Detection:** read `/proc/device-tree/model`, match to a profile, otherwise fall
back to `generic-linux` with GPIO disabled rather than guessing. Allow an
override in `config.json` for unlisted boards.

### 4.2 GPIO as a daemon, not a special-case API

Collapse GPIO into the architecture that already exists:

- The GPIO daemon writes pin states to `state/ipc/gpio.json` → flows through the
  existing state pipeline to widgets via `onState` for free
- It accepts `set_pin` / `set_mode` through the **Phase 3 command channel**,
  with the same manifest validation and ownership checks
- Input edges (button presses) become state changes widgets can subscribe to
- `gpioBindings` finally gets a consumer: the daemon watches edges and emits actions

Keep a thin `/api/gpio/*` REST facade for the admin pin-configuration UI, but
route all *runtime* control through the command channel.

### 4.3 Capability gating — where `runtimeTier` earns its place

`runtimeTier` is currently a decorative badge in the admin UI and
`displayTarget` is validated then ignored. Give them meaning:

- Board profile declares a RAM class; a `heavy` widget on a `lite` board warns or refuses
- A widget declaring `permissions.gpio: [17, 27]` is granted only pins the board
  profile marks available **and** the admin has approved
- Enforce daemon memory/CPU ceilings (ulimit / cgroup) by `runtimeTier` — today a
  single runaway community binary can consume all 512MB and take down the kiosk

### 4.4 Privilege

GPIO needs `gpio` group membership, not root. The installer handles that; the
server must never run as root.

---

## Sequencing

```
Phase 0 ──────────────────────────────► ship immediately, independent
Phase 1 ──────────────────────────────► sandbox becomes real
Phase 2 ──────────────────────────────► identity becomes trustworthy
             └── Phase 3 ─────────────► commands scoped to a trustworthy sender
                          └── Phase 4 ► GPIO rides the command channel
```

Phase 3 depends on Phase 2: commands cannot be scoped to a sender whose identity
is spoofable. Phase 4 depends on Phase 3: GPIO control is a command.

## Open decisions

1. **Kiosk auth** — recommend unauthenticated-but-unprivileged `display` over a
   device token. Simpler, and Phase 2.1 removes the need.
2. **GPIO REST facade** — keep a thin admin-only REST surface for pin
   configuration, or force everything through the command channel?
3. **Board profile coverage** — which boards ship in v1 beyond Pi Zero 2W?
4. **`unsafe` tier** — keep it as a distinct tier with no daemon access, or drop
   it and fold into `community`?
