# Decoupled Raspberry Pi Zero 2 W Dashboard Architecture (Technical Spec)

This document outlines the detailed architectural specifications, configurations, code shapes, and resource budgets for the local smart dashboard running on a **Raspberry Pi Zero 2 W (512MB RAM)**.

---

## 1. Overall System Architecture & Philosophy

The system implements a highly decoupled, three-tier model built on the Unix philosophy:

*   **Data Generation Layer**: Isolated, single-purpose background daemons fetch, parse, and format data independently.
*   **Storage & Transport Layer**: A `tmpfs` RAM disk acting as a high-speed, non-volatile IPC. A lightweight Bun server exposes these states over HTTP.
*   **Visualization Layer**: A WPE WebKit kiosk browser polls the local endpoints and updates the layout.

```
┌─────────────────────────────────────────────┐
│              Pi Zero 2 W                    │
│                                             │
│  ┌──────────┐    ┌──────────┐    ┌────────┐ │
│  │ weather  │    │ lyrics   │    │ clock  │ │
│  │ .binary  │    │ .binary  │    │ .bin   │ │
│  └────┬─────┘    └────┬─────┘    └───┬────┘ │
│       │               │              │      │
│       └───────────────┴──────────────┘      │
│                       │                     │
│              writes to /tmp/*.json           │
│                       │                     │
│              ┌─────────────────┐            │
│              │   Bun server    │            │
│              │  (just serves   │            │
│              │  static files   │            │
│              │  + /tmp JSON)   │            │
│              └────────┬────────┘            │
│                       │                     │
└───────────────────────┼─────────────────────┘
                        │
           ┌────────────┴────────────┐
           │                         │
    ┌──────▼──────┐          ┌───────▼──────┐
    │  Display    │          │  Admin panel │
    │  (WPE kiosk)│          │  (your phone)│
    │  polls /api │          │  edits config│
    └─────────────┘          └──────────────┘
```

---

## 2. Shared Storage & Transport Layer

### IPC RAM Disk Config
To eliminate persistent SD card write-wear and minimize I/O overhead, widget states are stored on a memory-mapped disk. Add this entry to `/etc/fstab`:
```bash
tmpfs /tmp/widgets tmpfs defaults,size=16M 0 0
```

### Dumb Backend Web Server (Bun)
The Bun server has three jobs: serving static display assets, serving files from the RAM disk, and managing `config.json`.
```javascript
Bun.serve({
  async fetch(req) {
    const url = new URL(req.url)
    
    // Serve any widget data from /tmp RAM disk
    if (url.pathname.startsWith('/api/widget/')) {
      const name = url.pathname.split('/')[3]
      const file = Bun.file(`/tmp/widgets/${name}.json`)
      return new Response(file, {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Config read/write APIs
    if (url.pathname === '/config') {
      if (req.method === 'GET')
        return new Response(Bun.file('./config.json'))
      if (req.method === 'POST') {
        await Bun.write('./config.json', await req.text())
        return new Response('ok')
      }
    }
    
    // Serve static frontend assets
    return new Response(Bun.file(`./public${url.pathname}`))
  }
})
```

---

## 3. Daemon Contract & Data Schemas

Every widget daemon operates inside its own loop and updates `/tmp/widgets/<name>.json` with a validated structure.

### JSON Data Shapes

#### Weather (`/tmp/widgets/weather.json`)
```json
{
  "temp": 18,
  "feels_like": 15,
  "condition": "Partly Cloudy",
  "icon": "cloud-sun",
  "humidity": 72,
  "updated_at": 1716890400
}
```

#### Lyrics (`/tmp/widgets/lyrics.json`)
```json
{
  "title": "Bohemian Rhapsody",
  "artist": "Queen",
  "current_line": "Is this the real life?",
  "next_line": "Is this just fantasy?",
  "progress": 0.42
}
```

#### System Info (`/tmp/widgets/sysinfo.json`)
```json
{
  "cpu_temp": 52.4,
  "cpu_percent": 18,
  "mem_used_mb": 187,
  "mem_total_mb": 512,
  "uptime_hours": 14
}
```

#### Home Automation (`/tmp/widgets/automation.json`)
```json
{
  "scene": "evening",
  "lights_on": true,
  "next_event": "Sunset at 20:34",
  "triggered_rules": ["dim_at_sunset"]
}
```

---

## 4. Daemon Structure (Go Boilerplate Example)

Background daemons run an infinite cycle, fetch and format telemetry data, and atomically overwrite their JSON file.

```go
package main

import (
    "encoding/json"
    "os"
    "time"
)

type WeatherData struct {
    Temp      float64 `json:"temp"`
    Condition string  `json:"condition"`
    Icon      string  `json:"icon"`
    Humidity  int     `json:"humidity"`
    UpdatedAt int64   `json:"updated_at"`
}

func fetchWeather() WeatherData {
    // API logic goes here
    return WeatherData{Temp: 18.0, Condition: "Clear"}
}

func main() {
    os.MkdirAll("/tmp/widgets", 0755)
    
    for {
        data := fetchWeather()
        bytes, _ := json.Marshal(data)
        os.WriteFile("/tmp/widgets/weather.json", bytes, 0644)
        
        time.Sleep(5 * time.Minute)
    }
}
```

---

## 5. Frontend Polling Lifecycle (`display.js`)

The kiosk layout schedules updates dynamically. Non-urgent components poll at larger intervals to conserve Pi CPU cycles.

```javascript
const WIDGETS = ['weather', 'lyrics', 'sysinfo', 'automation']
const POLL_INTERVALS = {
  weather:    60000,  // 60 seconds
  lyrics:      1000,  // 1 second (real-time lyrics sync)
  sysinfo:     5000,  // 5 seconds
  automation: 10000,  // 10 seconds
}

async function poll(widgetName) {
  try {
    const data = await fetch(`/api/widget/${widgetName}`)
      .then(r => r.json())
    
    // Execute matching UI renderer block
    WIDGET_RENDERERS[widgetName](data)
  } catch (e) {
    // Graceful recovery: preserve stale state or show indicators instead of crashing
  }
}

// Kick off dynamic polling loops
WIDGETS.forEach(name => {
  poll(name)
  setInterval(() => poll(name), POLL_INTERVALS[name])
})
```

---

## 6. Service Management (DietPi Systemd)

Systemd guarantees that individual widget processes are isolated and auto-restart if a fatal runtime exception occurs.

Paths are set under `/etc/systemd/system/`:
*   `signage-server.service`: Boots the Bun server.
*   `signage-display.service`: Launches `cog`/WPE WebKit kiosk (starts after network and server resolve).
*   `widget-weather.service`: Daemon for weather loop.
*   `widget-lyrics.service`: Daemon for lyric processing.
*   `widget-sysinfo.service`: Daemon for CPU/thermal stats.
*   `widget-automation.service`: Daemon for home automation.

### Example Service Configuration (`/etc/systemd/system/widget-weather.service`)
```ini
[Unit]
Description=Weather Widget Data Provider
After=network.target

[Service]
ExecStart=/usr/local/bin/widgets/weather
Restart=always
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
```

---

## 7. Memory Profile (512MB RAM Budget)

Operating on 32-bit DietPi, the system profile guarantees low resource overhead:

| Component | Technical Stack | Purpose | RAM Usage |
| :--- | :--- | :--- | :--- |
| **Operating System** | DietPi 32-bit | OS base services, kernel & daemon layers | ~40 MB |
| **Web Server** | Bun | Flat asset distribution and IPC file reading | ~15 MB |
| **Kiosk Engine** | WPE WebKit (cog) | Accelerated HTML layout presentation | ~70 MB |
| **Networking Stack** | OS | Active Wi-Fi / Bluetooth / SSH services | ~15 MB |
| **Widget Daemons** | Go / Rust / C | Combined background process footprints | ~10 MB |
| **Video Decoding** | Hardware Buffer | Direct hardware-accelerated video buffers | ~50 MB |
| **IPC Mount** | `tmpfs` | Memory-mapped shared volume footprint | ~1 MB |
| **Total Combined Memory**| | | **~201 MB** |
| **System Headroom** | | | **~311 MB** |

---

## 8. Extension Pipeline

Adding a new widget avoids code updates to the core network stack:
1.  **Daemon**: Write a binary that writes `/tmp/widgets/new_widget.json`.
2.  **Service**: Create a systemd service wrapper at `/etc/systemd/system/widget-new_widget.service`.
3.  **UI**: Add a renderer mapping block inside `display.js`.
4.  **Layout**: Map placement properties (coordinates `x`, `y`, scale, and `opacity`) inside `config.json`.
