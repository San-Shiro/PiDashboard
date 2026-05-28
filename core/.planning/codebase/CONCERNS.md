# Technical Debt, Fragile Areas, & Gotchas: PiDashboard

This document outlines the known issues, technical debt, performance risks, and fragile modules within the PiDashboard project.

---

## 1. ⚠️ Critical Gotchas & Lock Exceptions (EPERM)

- **Atomic File Renames on Windows:** 
  During layout publishing, the compositor writes a temporary config buffer (`active.json.tmp`) and atomically renames it to `active.json`. Under Windows local environments, background processes (like file indexers, IDE file-watchers, or local server tasks) can hold locks on the file, causing Bun to throw `EPERM: operation not permitted` rename errors.
- **IPC Watcher Differences:**
  On Linux, the watcher binds to `tmpfs` under `/tmp/widgets/` for extreme performance. On Windows, it falls back to caching inside the local folder `state/cache/widgets/`, which can have slower write cycles and different locking behaviors.

---

## 2. 🛡️ Security Concerns

- **Default Administrator Password:**
  If `secrets/admin.passhash` is absent at startup, the system automatically writes a pre-hashed entry matching `"admin"`. While extremely convenient for developer onboarding and automated test suites, this default configuration must be overwritten immediately before deploying to a public network.
- **Local Network HTTP & Cookies:**
  The system uses cookie-based sessions with the `Secure` flag. In local home network setups without a valid SSL certificate (running over plain `http://`), some modern web browsers might reject storing the session cookie. In staging/development environments, session security configurations must allow relaxed secure policies, while enforcing strict HTTPS in production.

---

## 3. 🧵 Fragile Codebase Modules

- **WebSocket Reconnection Heap Safety:**
  Since the kiosk browser runs inside a low-resource WPE WebKit container with 512MB RAM, any socket disconnect/reconnect loops can slowly build up memory leaks (e.g. accumulating uncollected event listeners). Reconnections in `client.js` fragments must be kept garbage-collection friendly and perform clean-ups.
- **Subprocess Spawns (`systemctl`):**
  Restarting widget daemons executes system-level commands like `systemctl restart pidash-sysinfo.service`. If the host Bun server process lacks root permissions or is not running inside systemd, these executions will fail.

---

## 4. 🧹 Technical Debt & Missing APIs

- **Theme & Marketplace Stubs:**
  The admin dashboard features layout editing capabilities but lacks persistent backend endpoints for template marketplace syncs or cloud theme imports. Stubs for **Docs**, **Themes**, and **Marketplace** have been hidden from the main tab navigations to ensure only fully functional core screens are shown to the user.
