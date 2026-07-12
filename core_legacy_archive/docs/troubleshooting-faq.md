# Troubleshooting & FAQ Guide

This guide helps resolve common configuration, deployment, and operational issues on the PiDashboard kiosk system.

---

## 🔍 1. Kiosk Display Troubleshooting

### The Kiosk Screen is Completely Blank
1. **Check Backend Status:**
   Verify if the Bun host process server is running on the Pi:
   ```bash
   sudo systemctl status pi-dashboard.service
   ```
2. **Verify Browser Display Port:**
   Ensure WPE WebKit/Cog can query the server on port 3000:
   ```bash
   curl -I http://127.0.0.1:3000/display/main
   ```
   If it returns a `200 OK`, the server is running perfectly and WPE WebKit is experiencing a DRM/GBM display-link mismatch.
3. **Verify Display Service Logs:**
   ```bash
   sudo journalctl -u pi-dashboard-kiosk.service -n 50 --no-pager
   ```
   If you see `eglCreateImageKHR failed` or DRM initialization failures, verify your HDMI cable connection and ensure the Pi's graphics driver is set to `vc4-kms-v3d` or `vc4-fkms-v3d` inside `/boot/config.txt`.

### Screen Displays "Maintenance Standby" Overlay
The kiosk has entered **Maintenance Mode** (suspend standby state). 
* To restore widgets rendering, navigate to the Web Admin Panel -> **System tab** and click **Resume Display** (which calls `POST /api/system/state` with `{ "maintenanceMode": false }`).
* Alternatively, run a direct cURL command to force-exit maintenance:
  ```bash
  curl -X PATCH http://127.0.0.1:3000/api/system/state \
    -H 'Content-Type: application/json' \
    -d '{"maintenanceMode": false}'
  ```

---

## 📡 2. IPC & Widgets Troubleshooting

### A Specific Widget Displays No Data / Stays Blank
1. **Identify the Execution Tier:** Verify if the widget is Tier 1b (server-fetched) or Tier 2 (background daemon).
2. **For Tier 1b Widgets:**
   - Check the scheduler event logs to see if exponential backoffs have been triggered:
     ```bash
     cat /opt/pi-dashboard/state/cache/logs/events.jsonl | tail -n 20
     ```
   - Check for DNS or API key failures inside `server.log`.
3. **For Tier 2 Widgets:**
   - Ensure the associated background systemd daemon is active:
     ```bash
     sudo systemctl status pi-dashboard-widget-<widget-id>.service
     ```
   - Verify that the daemon is writing JSON payloads inside the RAM-disk `tmpfs` folder:
     ```bash
     ls -l /tmp/widgets/
     cat /tmp/widgets/<widget-id>.json
     ```
   - Ensure the daemon systemd service does NOT have `PrivateTmp=true` configured, as this isolates the `/tmp` folder namespace and blocks the IPC pipeline.

---

## 🔒 3. Authentication & Configuration Troubleshooting

### How to Reset the Admin Password
If you have forgotten your Web Admin password:
1. Log in to the Pi terminal via SSH.
2. Remove the existing password hash file:
   ```bash
   rm /opt/pi-dashboard/secrets/admin.passhash
   ```
3. Refresh the Web Admin Panel in your laptop browser. The setup screen will re-render, allowing you to establish a new password instantly.

---

## 📋 4. Log Inspection

PiDashboard divides diagnostic logs into 11 distinct category domains. Inspect these files for diagnostics:

* **Bun Server Process Standard Outputs (systemd journal):**
  ```bash
  sudo journalctl -u pi-dashboard.service -n 100 -f
  ```
* **Structured Application Logs (Capped 45MB Ceiling):**
  ```bash
  tail -n 50 /opt/pi-dashboard/state/cache/logs/server.log
  ```
* **Scheduler Event Log (failures, recoveries, updates):**
  ```bash
  tail -n 50 /opt/pi-dashboard/state/cache/logs/events.jsonl
  ```

---

## ⚙️ 5. Version Verification & Releases

### How to Check the Running Version
To verify the active running system version:
1. Check the local Git repository tags:
   ```bash
   git describe --tags
   ```
   *Example Output:* `v1.0` (Milestone MVP tagged release).
2. Read the widget manifests package versions inside `widgets/<widget-id>/manifest.json` under the `"version"` string field.
