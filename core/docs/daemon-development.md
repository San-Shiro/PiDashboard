# Daemon Development Guide (Tier 2)

Tier 2 widgets are backed by standalone systemd daemons (written in high-efficiency compiled languages like Go, Rust, or C++) that interface with native OS layers (e.g. ALSA, MPD, system sensors). They communicate with the dashboard using a zero-database, memory-mapped tmpfs file watcher pipeline.

---

## ⚡ 1. The IPC Pipeline Concept

To achieve a near-zero memory footprint and avoid physical disk wear, Tier 2 daemons communicate by writing single-line JSON payloads directly to an in-memory tmpfs RAM disk folder `/tmp/widgets/`.

```
┌─────────────────────────────────┐
│     Tier 2 Background Daemon    │
│  (Go / Rust / Compiled Binary)  │
└────────────────┬────────────────┘
                 │ Writes JSON
                 ▼
┌─────────────────────────────────┐
│        tmpfs IPC RAM Disk       │
│      (/tmp/widgets/*.json)      │
└────────────────┬────────────────┘
                 │ fs.watch Event
                 ▼
┌─────────────────────────────────┐
│            Bun Server           │
│  (In-Memory WebSocket Broadcast)│
└────────────────┬────────────────┘
                 │ Socket Push (<1.5ms)
                 ▼
┌─────────────────────────────────┐
│      Kiosk Display Client       │
│  (Vanilla DOM Updater Callback) │
└─────────────────────────────────┘
```

---

## 📋 2. Communication Contract

### File Location
The daemon must write its data payload to:
`/tmp/widgets/<widget-id>.json` (or map to the path specified by the environment variable `PIDASH_IPC_DIR`).

### JSON Payload Schema
The payload must be a flat, validated JSON object. Do not nest data heavily to keep serialization costs minimized.
```json
{
  "active": true,
  "metric_a": 42.8,
  "metric_b": "normal",
  "alerts": []
}
```

### Safety & Lock File Management
Daemons should write to a temporary file in `/tmp/widgets/` first, then atomically rename it to `<widget-id>.json`. This guarantees that the Bun server watcher never reads a half-written file.

---

## 🐹 3. Example Go Daemon (`daemon/main.go`)

Below is a complete, minimal Go daemon that reads system memory and writes to the IPC pipeline:

```go
package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

type SysMetrics struct {
	Timestamp    int64   `json:"timestamp"`
	Goroutines   int     `json:"goroutines"`
	MemoryAlloc  uint64  `json:"memory_alloc_mb"`
	NumCPU       int     `json:"num_cpu"`
}

func getIpcDir() string {
	// Support environment variable path override for local Windows dev caching
	if envPath := os.Getenv("PIDASH_IPC_DIR"); envPath != "" {
		return envPath
	}
	return "/tmp/widgets"
}

func main() {
	ipcDir := getIpcDir()
	widgetID := "sysinfo"
	targetPath := filepath.Join(ipcDir, fmt.Sprintf("%s.json", widgetID))
	tempPath := filepath.Join(ipcDir, fmt.Sprintf("%s.tmp", widgetID))

	// Ensure directory exists
	_ = os.MkdirAll(ipcDir, 0755)

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	fmt.Printf("[daemon] Started sysmetrics monitoring to: %s\n", targetPath)

	for range ticker.C {
		var mem runtime.MemStats
		runtime.ReadMemStats(&mem)

		metrics := SysMetrics{
			Timestamp:   time.Now().Unix(),
			Goroutines:  runtime.NumGoroutine(),
			MemoryAlloc: mem.Alloc / 1024 / 1024,
			NumCPU:      runtime.NumCPU(),
		}

		payload, err := json.Marshal(metrics)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Serialization error: %v\n", err)
			continue
		}

		// 1. Write atomically to temp file
		err = ioutil.WriteFile(tempPath, payload, 0644)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Write error: %v\n", err)
			continue
		}

		// 2. Rename atomically to trigger fs.watch cleanly
		err = os.Rename(tempPath, targetPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Rename error: %v\n", err)
		}
	}
}
```

---

## ⚙️ 4. Deploying via systemd

To run the daemon as a persistent background process on the Pi, deploy it as a systemd service.

### Service File Template (`/etc/systemd/system/pi-dashboard-widget-sysinfo.service`)
```ini
[Unit]
Description=Pi Dashboard Widget — System metrics Go Daemon
After=pi-dashboard.service
Requires=pi-dashboard.service

[Service]
Type=simple
User=pi
ExecStart=/opt/pi-dashboard/core/widgets/sysinfo/daemon/bin/sysinfod
Restart=on-failure
RestartSec=2
NoNewPrivileges=true

# Security sandboxing
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/tmp/widgets

StandardOutput=journal
SyslogIdentifier=pi-dashboard-widget-sysinfo

[Install]
WantedBy=multi-user.target
```

### Activation Commands
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pi-dashboard-widget-sysinfo.service
```
