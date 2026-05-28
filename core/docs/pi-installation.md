# Pi Installation & Deployment Guide

This guide provides step-by-step instructions for deploying and running PiDashboard on a Raspberry Pi Zero 2W (or any standard Pi model) running DietPi or Raspberry Pi OS Lite.

---

## 📋 1. Prerequisites

Before installing, ensure your Raspberry Pi is flashed with a clean OS:
- **OS Choice (Recommended):** DietPi (32-bit/64-bit) or Raspberry Pi OS Lite (Bullseye/Bookworm). Keep the install minimal.
- **Hardware:** Raspberry Pi Zero 2W, 512MB RAM, >= 8GB MicroSD card.
- **Display Connection:** HDMI connected to your kiosk monitor.

---

## ⚡ 2. Dependencies Setup

Run the package updates and install necessary system tools:

```bash
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl unzip git cog fonts-noto-color-emoji
```

### Install Bun Runtime
PiDashboard runs its server using Bun. Install it for the system user:
```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
```

---

## 📁 3. Workspace Installation

Clone the repository and consolidate the files in your installation folder (e.g. `/opt/pi-dashboard/`):

```bash
sudo mkdir -p /opt/pi-dashboard
sudo chown -R $USER:$USER /opt/pi-dashboard
cd /opt/pi-dashboard

# Copy workspace core folder content inside /opt/pi-dashboard/
cp -r /path-to-source/core/* .
```

### Install NPM Workspace Packages
Run installation within the new `/opt/pi-dashboard/` workspace:
```bash
npm install
npm run build:admin
```

---

## 💾 4. tmpfs RAM-Disk Setup

To avoid physical SD card wear from continuous background writes, we must map `/tmp/widgets` to a RAM-disk.

1. **Mount tmpfs dynamically:**
   ```bash
   sudo mkdir -p /tmp/widgets
   sudo mount -t tmpfs -o size=32M,mode=0755 tmpfs /tmp/widgets
   ```

2. **Make the mount persistent across reboots:**
   Append the following line to `/etc/fstab`:
   ```text
   tmpfs /tmp/widgets tmpfs defaults,size=32M,mode=0755 0 0
   ```

Verify the mount is active by running `df -h /tmp/widgets`.

---

## ⚙️ 5. systemd Service Deployment

Deploy the Bun server and background kiosks as persistent system daemons.

### 5a. The PiDashboard Backend Service (`/etc/systemd/system/pi-dashboard.service`)
```ini
[Unit]
Description=Pi Dashboard — Bun compositor + admin server
After=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/pi-dashboard
ExecStart=/home/pi/.bun/bin/bun run server/index.ts
Restart=always
RestartSec=3
Environment=PORT=3000
NoNewPrivileges=true
StandardOutput=journal
SyslogIdentifier=pi-dashboard

[Install]
WantedBy=multi-user.target
```

### 5b. The Kiosk Kiosk Display Service (`/etc/systemd/system/pi-dashboard-kiosk.service`)
This service uses **Cog** (a lightweight WPE WebKit kiosk browser) to render the dashboard at fullscreen using hardware-accelerated DRM/GBM layers without loading a heavy desktop environment.

```ini
[Unit]
Description=Pi Dashboard — WPE WebKit fullscreen kiosk
After=pi-dashboard.service graphical.target
Requires=pi-dashboard.service

[Service]
Type=simple
User=pi
Environment=DISPLAY=:0
ExecStartPre=/bin/sleep 5
ExecStart=/usr/bin/cog --platform=drm http://127.0.0.1:3000/display/main
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
```

---

## 🚀 6. Activating the Services

Start the services and enable them to load automatically on boot:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pi-dashboard.service
sudo systemctl enable --now pi-dashboard-kiosk.service
```

### Checking Status
```bash
sudo systemctl status pi-dashboard.service
sudo journalctl -u pi-dashboard.service -n 50 -f
```
Your dashboard will boot fullscreen on the connected monitor in under 12 seconds!
