# Daemon Lifecycle Management Architecture

## The Problem

Currently, daemons are managed **manually**:
- `start-testing.sh` hardcodes 6 `daemon-bridge` launches with `&`
- `pidashboard.service` only starts the Bun server — daemons are not started
- No health checks — if a daemon crashes silently, the widget just stops updating
- No dependency management — if a daemon needs `mpv` or `python3`, it's on the user to install
- No activation awareness — ALL daemons run even if their widget isn't on the active canvas
- Community authors have no standard way to package, install, or run their daemon scripts

## Design Principles

1. **The Bun server manages all daemons** — one process to rule them all
2. **Only run what's needed** — if a widget isn't on the active canvas, its daemon doesn't run
3. **Two communication modes** — IPC file (write JSON, simple) or daemon-bridge (stdio, bidirectional)
4. **Health monitoring built in** — detect crashed/stuck daemons automatically
5. **Dependency declaration** — daemon manifest declares what it needs, server checks/installs
6. **Zero config for simple daemons** — a bash script that writes JSON should Just Work™

---

## 1. Daemon Manifest (`daemon.json`)

Each daemon lives in `widgets/<widget-id>/daemon/` alongside the widget fragment:

```
widgets/sysinfo/
├── sysinfo.html           # Visual template
├── manifest.json          # Widget manifest
└── daemon/
    ├── daemon.json        # Daemon manifest (NEW)
    ├── sysinfo.sh         # The actual script
    └── requirements.txt   # Optional: Python deps, etc.
```

### daemon.json Schema

```json
{
  "id": "sysinfo",
  "name": "System Info Collector",
  "version": "1.0.0",

  "runtime": {
    "command": "./sysinfo.sh",
    "shell": true,
    "cwd": "daemon",
    "env": {
      "UPDATE_INTERVAL": "5"
    }
  },

  "communication": {
    "mode": "ipc_file",
    "ipcFilename": "sysinfo.json"
  },

  "health": {
    "strategy": "file_mtime",
    "maxStaleSec": 30,
    "startupGraceSec": 10
  },

  "restart": {
    "policy": "on-failure",
    "maxRestarts": 5,
    "backoffBaseSec": 2,
    "backoffMaxSec": 120
  },

  "resources": {
    "maxMemoryMB": 20,
    "cpuWeight": "low"
  },

  "dependencies": {
    "system": [],
    "check": "which bash"
  }
}
```

### Communication Modes

| Mode | How it works | When to use |
|------|-------------|-------------|
| `ipc_file` | Daemon writes JSON to `/tmp/widgets/<file>.json`. Server watches via existing tmpfs-watcher. | Simple, one-way data flow. Any language. Most community daemons. |
| `stdio_bridge` | Server spawns daemon, reads JSON lines from stdout, sends commands via stdin. Uses existing `daemon-bridge.ts` logic. | Bidirectional (daemon sends data AND receives commands). Music player, GPIO control. |
| `websocket` | Daemon connects to `ws://localhost:3000/ws/daemon` itself. Uses existing WS daemon protocol. | Long-running services that want to manage their own connection. Advanced use. |

### Fallback: No daemon.json

If a widget has `"daemon": "sysinfo"` in its manifest but no `daemon/daemon.json`, the DaemonManager looks for:
1. `daemon/sysinfo.sh` → runs as `ipc_file` mode with defaults
2. `daemons/sysinfo.sh` → legacy location, same defaults

This maintains backward compatibility with the existing 4 bash daemons.

---

## 2. DaemonManager (Central Controller)

A new module: `core/server/daemon/daemon-manager.ts`

### Lifecycle State Machine

```
                  ┌─────────┐
         install  │         │  uninstall
        ┌────────►│ STOPPED │◄────────┐
        │         │         │         │
        │         └────┬────┘         │
        │              │ start        │
        │              ▼              │
        │         ┌─────────┐         │
        │         │STARTING │         │
        │         │(grace)  │         │
        │         └────┬────┘         │
        │              │ healthy      │
        │              ▼              │
   ┌────┴────┐   ┌─────────┐   ┌─────┴────┐
   │ BACKOFF │◄──│ RUNNING │──►│ CRASHED  │
   │(waiting)│   │(healthy)│   │(detected)│
   └────┬────┘   └─────────┘   └──────────┘
        │              ▲
        │   restart    │
        └──────────────┘
```

### Core API

```typescript
class DaemonManager {
  // Called on server startup and when active canvas changes
  reconcile(activeCanvas: CanvasConfig): void

  // Manual control (from admin panel API)
  startDaemon(daemonId: string): void
  stopDaemon(daemonId: string): void
  restartDaemon(daemonId: string): void

  // Status
  getStatus(): DaemonStatus[]
  getDaemonLog(daemonId: string, lines?: number): string[]

  // Lifecycle
  shutdownAll(): Promise<void>  // graceful shutdown on SIGTERM
}

interface DaemonStatus {
  id: string
  state: 'stopped' | 'starting' | 'running' | 'crashed' | 'backoff'
  pid: number | null
  uptimeSec: number
  restartCount: number
  lastError: string | null
  lastDataAt: number | null      // timestamp of last successful data output
  memoryMB: number | null
  healthy: boolean
}
```

### Reconciliation (the key algorithm)

When the active canvas changes (widget added/removed, canvas switched), the DaemonManager **reconciles**:

```
1. Read active canvas → extract list of widget_ids that have daemons
2. For each required daemon:
   - If already RUNNING → keep it (no restart needed)
   - If STOPPED → start it
   - If CRASHED/BACKOFF → let restart policy handle it
3. For each currently running daemon:
   - If NOT in the active canvas → stop it (free resources)
```

This means:
- **Adding a sysinfo widget** to the canvas automatically starts the sysinfo daemon
- **Removing the sysinfo widget** automatically stops it
- **Switching canvases** stops daemons for the old canvas and starts ones for the new canvas
- On a Pi Zero 2W, only the daemons you actually need are consuming RAM

### Integration Point

The reconciliation is triggered from:
1. **Server startup** — `server.ts` calls `daemonManager.reconcile(canvas)` after loading the active canvas
2. **Canvas publish** — when admin panel saves/publishes a canvas, the API handler calls `reconcile(newCanvas)`
3. **Widget add/remove** — when a widget instance is added/removed from a canvas

---

## 3. Health Monitoring

### Strategy: File mtime (for `ipc_file` mode)

The simplest and most universal approach. The daemon writes a JSON file. The DaemonManager checks the file's modification time:

```typescript
// Every healthCheckIntervalSec (default 15s):
function checkHealth(daemon: ManagedDaemon): boolean {
  const ipcPath = join(IPC_DIR, daemon.manifest.communication.ipcFilename);
  
  if (!existsSync(ipcPath)) {
    // File doesn't exist yet — is daemon still in startup grace period?
    return daemon.uptimeSec < daemon.manifest.health.startupGraceSec;
  }
  
  const mtime = statSync(ipcPath).mtimeMs;
  const staleSec = (Date.now() - mtime) / 1000;
  return staleSec < daemon.manifest.health.maxStaleSec;
}
```

**Why file mtime?**
- Works for ANY language (bash, Python, Go, Rust, Node)
- No protocol overhead — the daemon just writes its normal JSON file
- No heartbeat messages to implement
- The IPC file is already being written — no extra work for daemon authors

### Strategy: Stdout heartbeat (for `stdio_bridge` mode)

For bidirectional daemons, health is determined by whether the process is alive AND producing output:

```typescript
// Process alive check:
if (child.exitCode !== null) return false;  // process died

// Output freshness check:
const staleSec = (Date.now() - lastStdoutLineAt) / 1000;
return staleSec < daemon.manifest.health.maxStaleSec;
```

### Strategy: WebSocket ping (for `websocket` mode)

Daemons connected via WebSocket get periodic ping/pong health checks from the existing WS handler.

### Unhealthy → Action

When a daemon is detected as unhealthy:

```
1. Log warning: "[DaemonManager] sysinfo unhealthy (no data for 30s)"
2. Send SIGTERM to the process
3. Wait 5 seconds for graceful exit
4. If still alive, send SIGKILL
5. Increment restartCount
6. If restartCount < maxRestarts:
   - Enter BACKOFF state
   - Wait: min(backoffBaseSec * 2^(restartCount-1), backoffMaxSec)
   - Restart
7. If restartCount >= maxRestarts:
   - Enter CRASHED state permanently
   - Log error: "[DaemonManager] sysinfo exceeded restart limit (5/5), giving up"
   - Notify admin panel via WebSocket (red status indicator)
```

---

## 4. Dependency Management

### Declaration in daemon.json

```json
{
  "dependencies": {
    "system": ["mpv", "python3", "jq"],
    "pip": ["requests", "psutil"],
    "check": "which mpv && python3 --version"
  }
}
```

### Dependency Check Flow

```
On daemon start:
  1. Run `check` command (if provided)
     → If exit code 0: dependencies met, proceed
     → If exit code != 0: dependencies missing

  2. If missing, check `system` array:
     → For each: `which <pkg>` to verify availability
     → Report missing packages to admin panel

  3. Do NOT auto-install system packages
     → Security risk, needs sudo, could break things
     → Instead: show clear message in admin panel:
       "⚠ sysinfo daemon requires: mpv (not found). Install with: sudo apt install mpv"

  4. For pip/npm dependencies:
     → CAN auto-install into a virtual environment / local node_modules
     → pip: `python3 -m venv daemon/.venv && daemon/.venv/bin/pip install -r requirements.txt`
     → npm: `cd daemon && npm install` (only if package.json exists)
     → These are sandboxed and safe
```

### Why Not Auto-Install System Packages?

On a Pi Zero 2W:
- `apt install` requires sudo → security implications
- A rogue community widget manifest could install anything
- Package installation uses significant disk space and RAM
- Could break other system services

**Better approach**: The admin panel shows a "Dependencies" tab per widget with clear instructions. The user consciously installs what they need.

---

## 5. Resource Budgeting

### Per-Daemon Memory Limits

```json
{
  "resources": {
    "maxMemoryMB": 20
  }
}
```

On Linux, the DaemonManager uses `cgroups` (if available) or periodic `/proc/<pid>/status` polling:

```typescript
// Every 30 seconds:
function checkMemory(daemon: ManagedDaemon): void {
  if (!daemon.pid) return;
  
  const rss = getProcessRSS(daemon.pid);  // reads /proc/<pid>/status
  daemon.currentMemoryMB = rss / 1024 / 1024;
  
  if (daemon.currentMemoryMB > daemon.manifest.resources.maxMemoryMB) {
    console.warn(`[DaemonManager] ${daemon.id} exceeds memory limit ` +
      `(${daemon.currentMemoryMB.toFixed(1)}MB > ${daemon.manifest.resources.maxMemoryMB}MB)`);
    // Kill and restart (counts toward restart limit)
    killDaemon(daemon, 'memory_exceeded');
  }
}
```

### Total Resource Budget

The DaemonManager enforces a global ceiling:

```typescript
const TOTAL_DAEMON_MEMORY_BUDGET_MB = 100;  // Out of 512MB Pi total

function canStartDaemon(daemon: DaemonManifest): boolean {
  const currentTotal = runningDaemons.reduce((sum, d) => sum + (d.currentMemoryMB || 0), 0);
  return (currentTotal + (daemon.resources.maxMemoryMB || 20)) <= TOTAL_DAEMON_MEMORY_BUDGET_MB;
}
```

If the budget is exceeded, the admin panel shows: "⚠ Cannot start weather daemon: daemon memory budget exceeded (92/100 MB). Remove a widget or increase the budget in settings."

---

## 6. Admin Panel Integration

### API Endpoints (new)

```
GET    /api/daemons              → list all daemon statuses
GET    /api/daemons/:id          → single daemon status + recent log
POST   /api/daemons/:id/restart  → manual restart
POST   /api/daemons/:id/stop     → manual stop
POST   /api/daemons/:id/start    → manual start
GET    /api/daemons/:id/log      → last N lines of stdout/stderr
```

### Admin Panel UI

A "Daemons" section showing:

```
┌──────────────────────────────────────────────────────┐
│ 🟢 sysinfo          Running  │ 12m uptime  │  8 MB  │
│ 🟢 daily-quote      Running  │  3h uptime  │  2 MB  │
│ 🟡 music-player     Starting │  --         │  -- MB │
│ 🔴 weather-fetcher  Crashed  │ 3/5 restarts│  Error │
│ ⚫ gpio-daemon      Stopped  │ (not on canvas)      │
└──────────────────────────────────────────────────────┘
```

---

## 7. Full Lifecycle: Widget Placement → Daemon Running

```
1. User places a "sysinfo" widget on the canvas in Admin Panel
2. User clicks "Publish"
3. Server receives POST /api/canvas/publish with new canvas JSON
4. Server saves canvas → triggers daemonManager.reconcile(newCanvas)
5. DaemonManager sees "sysinfo" widget has daemon: "sysinfo"
6. Loads widgets/sysinfo/daemon/daemon.json
7. Runs dependency check: `which bash` → passes
8. Checks resource budget: 8MB requested, 42/100 MB used → OK
9. Spawns: `bash ./sysinfo.sh` with cwd = widgets/sysinfo/daemon/
10. State → STARTING (10s grace period)
11. sysinfo.sh writes /tmp/widgets/sysinfo.json for the first time
12. tmpfs-watcher picks it up → stateStore.patch → WS broadcast
13. Health check passes (file mtime < 30s) → State → RUNNING
14. Kiosk display receives data, auto-binding updates DOM
15. If daemon crashes → detected by health check → restart with backoff
16. If user removes sysinfo widget → reconcile → daemon stopped
```

---

## 8. Directory Structure (Final)

```
widgets/sysinfo/
├── sysinfo.html              # Widget visual template
├── manifest.json             # Widget manifest (has "daemon": "sysinfo")
└── daemon/
    ├── daemon.json           # Daemon lifecycle config
    └── sysinfo.sh            # The script

widgets/music-player/
├── music-player.html
├── manifest.json
└── daemon/
    ├── daemon.json           # mode: "stdio_bridge", deps: ["mpv"]
    └── music-player.sh

widgets/weather/
├── weather.html
├── manifest.json
└── daemon/
    ├── daemon.json
    ├── weather-fetcher.py    # Python script fetching Open-Meteo API
    └── requirements.txt      # requests
```

### Migration from Current Layout

```diff
- daemons/daily-quote.sh        → widgets/daily-quote/daemon/daily-quote.sh
- daemons/music-player.sh       → widgets/music-player/daemon/music-player.sh
- daemons/network-info.sh       → widgets/network-info/daemon/network-info.sh
- daemons/gpio-daemon.sh        → widgets/gpio-display/daemon/gpio-daemon.sh
- scripts/wsl-sysinfo.sh        → widgets/sysinfo/daemon/sysinfo.sh (+ platform variants)
- scripts/wsl-weather.sh        → widgets/weather/daemon/weather-fetcher.sh
```

Each daemon moves INTO its widget folder. This is the key insight: **a widget is a self-contained package** — template + manifest + daemon + dependencies. Community authors distribute a single folder.

---

## 9. Community Widget Distribution

With this architecture, a community widget is a single folder:

```
my-awesome-widget/
├── my-awesome-widget.html    # Visual template (data-bind, zero JS)
├── manifest.json             # Widget + daemon declaration
└── daemon/
    ├── daemon.json           # Lifecycle config
    ├── fetcher.py            # Data producer script
    └── requirements.txt      # Python dependencies
```

**Installation**: Copy the folder into `widgets/`. That's it. The server discovers it, the admin panel shows it, placing it on a canvas auto-starts the daemon.

**Uninstallation**: Delete the folder. The reconciler stops the daemon.

---

## Open Questions

> [!IMPORTANT]
> **Platform-specific daemons**: Some daemons use Linux-only tools (`iwconfig`, `/proc/`). Should `daemon.json` support platform variants? e.g., `"command_linux": "./sysinfo.sh"`, `"command_darwin": "./sysinfo-mac.sh"`, `"command_win32": "./sysinfo.ps1"`?

> [!IMPORTANT]
> **Log rotation**: Daemon stdout/stderr will be captured. How much log history should we keep? Suggestion: ring buffer of last 500 lines per daemon in memory, with optional file logging to `state/logs/daemons/<id>.log` (rotation at 1MB).

> [!IMPORTANT]
> **Daemon-to-daemon communication**: Should daemons be able to read each other's IPC files? Example: a "smart-display" daemon might want to read both weather AND sysinfo state to decide what to show. Currently they can — `/tmp/widgets/` is globally readable. Should we restrict this for community daemons?
