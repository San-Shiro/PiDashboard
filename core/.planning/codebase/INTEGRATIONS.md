# External Integrations & IPC Protocols: PiDashboard

This document outlines the authentication gateway, RAM-disk IPC structures, WebSocket protocol, and systemd integrations.

---

## 1. Authentication Layer

PiDashboard uses a local, self-contained secure session gate that requires zero external third-party identity providers.

### A. Credentials Verification
- **Path hash:** Stored in `secrets/admin.passhash` using the **Argon2id** algorithm.
- **Dynamic verification:** Verified inside `core/server/api/auth.ts` via `Bun.password.verify()`.
- **First-run setup:** If `admin.passhash` is missing, the backend exposes the `/api/auth/setup` route and allows initializing a password.

### B. Session Verification Flow
- **Token:** Secure v4 UUID generated on successful authentication.
- **In-memory cache:** Stored in a lightweight backend `activeSessions` set.
- **State transit:** Passed to client browser as an `HttpOnly`, `Secure`, `SameSite=Strict` cookie named `session_token`.
- **Auth verification middleware:** Active on all administrative endpoints under `/api/*`.

---

## 2. IPC RAM-Disk (tmpfs) Pipeline

The inter-process communication (IPC) connects background system services (Tier 2 Daemons) with the kiosk display client.

```
┌─────────────────────────────────┐
│     Background Go Daemon        │ (Writes JSON metrics every 3s)
└────────────────┬────────────────┘
                 │ (Atomic Write & Rename)
                 ▼
┌─────────────────────────────────┐
│    tmpfs RAM-Disk IPC Directory │ (e.g., /tmp/widgets/sysinfo.json)
└────────────────┬────────────────┘
                 │ (In-memory fs.watch Trigger)
                 ▼
┌─────────────────────────────────┐
│     Bun Server Watcher          │ (Instantly reads and broadcasts)
└────────────────┬────────────────┘
                 │ (WebSocket push: type 'data')
                 ▼
┌─────────────────────────────────┐
│      Kiosk Display Client       │ (Vanilla JS updates DOM in ~5ms)
└─────────────────────────────────┘
```

- **Mechanism:** Background daemons (e.g., Go CPU monitor) compile stats and write them directly as raw JSON into the tmpfs folder (`/tmp/widgets/`).
- **File Watcher:** Bun initializes `fs.watch` on the IPC directory. When a file is updated, Bun reads the content and pushes it to all connected sockets.
- **Pi-Optimization:** Operates entirely in RAM-disk (`tmpfs`) on the Raspberry Pi Zero 2W, ensuring **zero write wear** to the SD card.

---

## 3. Custom WebSocket Protocol

The system utilizes a lightweight 3-message protocol under `ws://host:port/ws` to manage display updates:

| Message Type | JSON Payload | Description |
| :--- | :--- | :--- |
| **`data`** | `{ "type": "data", "widget_id": "sysinfo", "payload": { ... } }` | Transmits real-time metric updates to active display widgets. |
| **`reload`**| `{ "type": "reload" }` | Instructs the kiosk display client to refresh the page when a new layout is published. |
| **`maintenance`** | `{ "type": "maintenance", "enabled": true }` | Shifts the display kiosk to a minimal, low-resource static standby page. |

---

## 4. systemd Service Controls

For Tier 2 daemons (like lyrics players or sysinfo monitors), the admin panel provides process management controls:
- **Restart request:** When the admin clicks "Restart" in the services list, the server executes a subprocess command:
  ```bash
  systemctl restart pidash-sysinfo.service
  ```
- **Platform fallback:** If systemd commands fail or are not supported (such as in local Windows/OSX developer sandboxes), the server falls back to logging a warning and simulating a restart state.
