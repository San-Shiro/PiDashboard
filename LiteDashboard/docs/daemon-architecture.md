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

---

## 3. Handling Complex Scripts (Environment Injection)

**Question:** *What if someone creates a very complex script? How will the script know what file to update, etc.?*

This is solved via **Environment Variable Injection**. When the `DaemonManager` spawns the external script (whether it's Python, Go, Node, or Bash), it automatically injects a rich set of environment variables. The script doesn't need to guess where things are; it just reads the environment.

### Injected Environment Variables:

| Environment Variable | Description |
|----------------------|-------------|
| `PIDASH_IPC_DIR` | The absolute path to the directory where the daemon should write its JSON file (e.g., `/tmp/widgets/`). |
| `PIDASH_IPC_FILE` | The exact absolute path to the JSON file this daemon should update (e.g., `/tmp/widgets/weather.json`). |
| `PIDASH_DAEMON_ID` | The ID of the daemon running (e.g., `weather-fetcher`). |
| `PIDASH_CONFIG` | A JSON string of the widget's current configuration (if applicable) so the daemon knows user settings (e.g., `{"units":"celsius"}`). |
| `PIDASH_API_URL` | The URL to the PiDashboard local API (e.g., `http://127.0.0.1:3000`). Useful if a complex daemon needs to fetch canvas info or interact via REST. |

### Example: A Complex Python Script

A complex weather daemon written in Python can simply use these variables instead of hardcoding paths:

```python
import os
import json
import time
import requests

# 1. The script reads where it needs to write its data
ipc_file = os.environ.get("PIDASH_IPC_FILE", "/tmp/widgets/default.json")

# 2. It reads the widget configuration set by the user in the Admin Panel
config_json = os.environ.get("PIDASH_CONFIG", "{}")
config = json.loads(config_json)
units = config.get("units", "celsius")

# 3. Complex logic (API calls, ML, scraping) happens here
while True:
    data = fetch_complex_weather_data(units)
    
    # 4. Atomic write to the IPC file
    temp_file = f"{ipc_file}.tmp"
    with open(temp_file, "w") as f:
        json.dump(data, f)
    os.rename(temp_file, ipc_file) # Atomic rename prevents read errors
    
    time.sleep(300) # Sleep for 5 minutes
```

### Why this supports maximum complexity:
- **Any Language:** Go, Rust, Python, Bash can all read environment variables easily.
- **No Path Guessing:** The daemon doesn't care if it's running on a Pi (using `/tmp/widgets/`) or a Windows dev machine (using `state/ipc/`). The `PIDASH_IPC_FILE` tells it exactly where to write.
- **Configuration Aware:** By passing `PIDASH_CONFIG`, complex scripts can adapt to user settings without needing to query a database or API.

---

## 4. Health Monitoring

### Strategy: File mtime (for `ipc_file` mode)

The simplest and most universal approach. The daemon writes a JSON file. The DaemonManager checks the file's modification time:

```typescript
// Every healthCheckIntervalSec (default 15s):
function checkHealth(daemon: ManagedDaemon): boolean {
  const ipcPath = process.env.PIDASH_IPC_FILE; // Path derived from config
  
  if (!existsSync(ipcPath)) {
    return daemon.uptimeSec < daemon.manifest.health.startupGraceSec;
  }
  
  const mtime = statSync(ipcPath).mtimeMs;
  const staleSec = (Date.now() - mtime) / 1000;
  return staleSec < daemon.manifest.health.maxStaleSec;
}
```

**Why file mtime?**
- Works for ANY language
- No heartbeat messages to implement
- The IPC file is already being written — no extra work for daemon authors

### Unhealthy → Action
If unhealthy, the server sends SIGTERM, waits 5s, sends SIGKILL, and attempts a restart using the configured backoff policy.

---

## 5. Dependency Management

### Declaration in daemon.json

```json
{
  "dependencies": {
    "system": ["mpv", "python3", "jq"],
    "check": "which mpv && python3 --version"
  }
}
```

### Dependency Check Flow
1. Run `check` command. If exit code 0, proceed.
2. If missing, check `system` array. Report missing packages to admin panel.
3. **Do NOT auto-install system packages** (Security risk, needs sudo). Show clear message in admin panel: `"⚠ sysinfo daemon requires: mpv. Install with: sudo apt install mpv"`
4. For pip/npm dependencies, CAN auto-install into a sandboxed virtual environment.

---

## 6. Resource Budgeting

The DaemonManager enforces a global ceiling (e.g., 100MB out of 512MB Pi total).

```typescript
// Every 30 seconds:
function checkMemory(daemon: ManagedDaemon): void {
  const rss = getProcessRSS(daemon.pid); 
  daemon.currentMemoryMB = rss / 1024 / 1024;
  
  if (daemon.currentMemoryMB > daemon.manifest.resources.maxMemoryMB) {
    killDaemon(daemon, 'memory_exceeded');
  }
}
```

If the budget is exceeded, the admin panel shows an alert.

---

## 7. Community Widget Distribution

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

**Installation**: Copy the folder into `widgets/`. The server discovers it, the admin panel shows it, placing it on a canvas auto-starts the daemon.
