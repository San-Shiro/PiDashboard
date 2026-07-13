# PiDashboard — One-Click Deployment

Deploy PiDashboard to a fresh Raspberry Pi OS Lite (64-bit) installation with a single command.

## Prerequisites

### On your PC
```bash
pip install paramiko
```

### On the Raspberry Pi
- **OS**: Raspberry Pi OS Lite (**64-bit**) — Bookworm or Trixie
- **SSH**: Enabled (via `raspi-config` or by placing an empty `ssh` file in `/boot/firmware/`)
- **Network**: Pi connected to the same network as your PC

> [!CAUTION]
> Bun does **not** support 32-bit ARM. You **must** use the 64-bit OS image.

## Usage

### Default (uses hardcoded IP/user/pass)
```bash
python deploy/deploy-pidashboard.py
```

### Custom target
```bash
python deploy/deploy-pidashboard.py <PI_IP> <USERNAME> <PASSWORD>
```

**Example:**
```bash
python deploy/deploy-pidashboard.py 192.168.1.50 pi raspberry
```

## What It Does

The deployer runs two stages:

### Stage 1: `deploy-pidashboard.py` (runs on your PC)
1. Archives the PiDashboard project into a `.tar.gz`
2. Connects to the Pi via SSH (Paramiko)
3. Verifies the Pi is running 64-bit OS
4. Uploads the archive + setup script
5. Executes the setup script remotely

### Stage 2: `pi-kiosk-setup.sh` (runs on the Pi)

| Step | Action |
|------|--------|
| 1 | Install `cage`, `cog`, `curl`, `git` via apt |
| 2 | Install Bun **as the user** (not root — avoids path issues) |
| 3 | Unpack PiDashboard to `~/PiDashboard/` |
| 4 | Create `pidashboard.service` (Bun backend server) |
| 5 | Configure kiosk: getty auto-login + `.bash_profile` launcher |
| 6 | Apply HDMI stability fixes to `config.txt` and `cmdline.txt` |
| 7 | Enable services and reboot |

## After Deployment

| What | URL |
|------|-----|
| Kiosk display | Shows automatically on HDMI |
| Admin panel | `http://<pi-ip>:3000/admin/` |
| SSH access | `ssh <user>@<pi-ip>` |

## Architecture Decisions

These decisions were made after extensive debugging and are baked into the scripts:

### Why getty auto-login instead of a systemd service for the kiosk?
Cage (the Wayland compositor) needs a **real login session** to access the GPU via libseat/logind. 
- Running cage as a systemd service with `PAMName=login` → crashes with **SIGTRAP (exit 133)**
- Running cage as root without PAMName → **"Could not get primary session"** error
- The getty auto-login pattern provides a real TTY session with proper seat access ✓

### Why `-P wl` and not `-P fdo` for cog?
The `fdo` WPE backend is **deprecated** in recent cog versions and crashes with `Could not initialize EGL (0x3001)`. The `wl` (Wayland) backend is the modern replacement.

### Why install Bun as the user?
Running `curl | bash` under `sudo` installs Bun into `/root/.bun/` instead of `/home/<user>/.bun/`, causing the `pidashboard.service` (which runs as the user) to fail with "command not found".

### HDMI stability fixes
| Config | Purpose |
|--------|---------|
| `hdmi_blanking=0` | Prevent HDMI power-saving blanking |
| `hdmi_force_hotplug=1` | Force HDMI output even without display detection |
| `hdmi_drive=2` | Force digital HDMI mode (not DVI) |
| `hdmi_ignore_cec=1` | Stop TV CEC commands from triggering display blinks |
| `config_hdmi_boost=7` | Maximum HDMI signal strength for long/cheap cables |
| `consoleblank=0` | Disable Linux console blanking |
| `vt.global_cursor_default=0` | Hide the text-mode console cursor |

### Cursor hiding (3 layers)
1. **CSS**: `cursor: none !important` in the compositor HTML output
2. **Wayland**: `XCURSOR_THEME=transparent` with a custom 1px transparent theme
3. **Hardware**: `WLR_NO_HARDWARE_CURSORS=1` disables the hardware cursor plane
