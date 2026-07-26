# PiDashboard - AI Handoff Document

## What is this project?
PiDashboard is a lightweight, high-performance smart dashboard system explicitly optimized for the Raspberry Pi Zero 2W (512MB RAM constraint). 
It features a strict decoupled architecture:
1. **Admin Control Panel**: A React/Tailwind application that runs *entirely client-side* on the user's PC/phone to drag-and-drop layouts.
2. **Kiosk Display Client**: A zero-framework vanilla HTML/JS renderer running on the Pi display.
3. **Backend / IPC**: A Bun server that composites the layout into a single HTML file and uses an in-memory RAM disk (`/tmp/widgets/*.json`) to bridge data between background daemons (fetchers) and the frontend display via WebSockets.

## What were we doing?
We were building the **Community Widgets** architecture, specifically testing how 3rd-party widgets can be installed without modifying the core dashboard code.
We successfully developed a **Live Flight Tracker** widget in two distinct ways to validate the architecture:

1. **Version 1 (`community-flight-tracker`)**: A `pull` tier widget. The Bun backend automatically imports our `fetch.js` and schedules it every 30s to fetch from the OpenSky API and write to the state file.
2. **Version 2 (`community-flight-tracker-go`)**: A `push` tier widget. A custom Go daemon (`main.go` cross-compiled for ARM/ARM64) manages its own loop and writes directly to the IPC RAM disk.

Both were packaged as `.wig` files (ZIPs) and successfully imported via the Admin Panel.

## Recent Fixes
1. **Core Installer Bug:** We fixed `core/server/api/widgets.ts` because it was failing to append newly installed widgets to `config/active-widgets.json`. Without this, the Admin Panel couldn't see the new widgets.
2. **Sandbox API Crash:** We fixed `flight.html`. It was using `window.PiWidget.register({...})` which is for native widgets. Community widgets are iframed and MUST use `window.widget.register({...})`. This typo was causing a fatal JavaScript crash, resulting in a blank kiosk screen.

## Current State & Known Issues (Start Here)
The user has published both widgets to the kiosk display.
* **The problem:** The Go version of the widget is currently crashing on the backend.
* **The logs:** The `daemonManager` is reporting that `community-flight-tracker-go` is repeatedly crashing with **`exit code 126`** (Permission Denied).
* **The cause:** When the `.wig` ZIP file is extracted by `widgets.ts`, the execute permissions (`chmod +x`) on the cross-compiled Go binaries (`flight-daemon-arm` and `flight-daemon-arm64`) are lost. When `community-flight-tracker-go.sh` tries to run `./flight-daemon-arm64`, it is denied execution.

## Next Steps Planned
1. **Fix the Go Daemon Permission Issue:** Update `community-flight-tracker-go.sh` in the `widgets/community-flight-tracker-go/daemon/` folder to run `chmod +x flight-daemon-*` *before* attempting to execute the binary. You will also need to update the scratch folder and re-zip `flight-tracker-go.wig` in the `community-widgets` directory so future installs have the fix.
2. **Verify Display:** Ensure the kiosk correctly renders the Leaflet map and updates the aircraft positions in real-time.
3. **Continue Expansion:** If the user is satisfied, continue brainstorming and building more complex community plugins.
