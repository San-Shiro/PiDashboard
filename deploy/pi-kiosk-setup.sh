#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  PiDashboard — One-Click Kiosk Installer for Raspberry Pi OS Lite 64-bit
# ═══════════════════════════════════════════════════════════════════════
#
#  Tested on: Raspberry Pi Zero 2W — Pi OS Lite (64-bit, Bookworm/Trixie)
#  Requires:  Fresh Pi OS Lite install with SSH enabled and a user account.
#
#  This script is uploaded and executed by deploy-pidashboard.py via Paramiko.
#  It must be run with: sudo bash pi-kiosk-setup.sh <username>
# ═══════════════════════════════════════════════════════════════════════

set -e

# ── Resolve target user ──────────────────────────────────────────────
PI_USER="${1:-$(logname 2>/dev/null || echo pi)}"
USER_HOME="/home/$PI_USER"
DASH_DIR="$USER_HOME/PiDashboard"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  PiDashboard Kiosk Installer"
echo "  User: $PI_USER   Home: $USER_HOME"
echo "═══════════════════════════════════════════════════"
echo ""

# ── 1. System packages ──────────────────────────────────────────────
echo "[1/7] Updating APT & installing kiosk packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq cage cog curl unzip git > /dev/null 2>&1
echo "       ✓ cage, cog, curl, git installed"

# ── 2. Install Bun (as the PI_USER, NOT as root) ────────────────────
echo "[2/7] Installing Bun runtime..."
if [ -d "$USER_HOME/.bun" ]; then
    echo "       ✓ Bun already installed"
else
    # Install as the target user so it lands in /home/<user>/.bun
    su - "$PI_USER" -c 'curl -fsSL https://bun.sh/install | bash' > /dev/null 2>&1
    echo "       ✓ Bun installed to $USER_HOME/.bun"
fi

# Verify Bun works
BUN_BIN="$USER_HOME/.bun/bin/bun"
if [ ! -x "$BUN_BIN" ]; then
    echo "       ✗ ERROR: Bun binary not found at $BUN_BIN"
    exit 1
fi
echo "       ✓ Bun verified: $($BUN_BIN --version 2>/dev/null || echo 'ok')"

# ── 3. Unpack PiDashboard ───────────────────────────────────────────
echo "[3/7] Unpacking PiDashboard..."
ARCHIVE="$USER_HOME/pi-dashboard.tar.gz"
if [ -f "$ARCHIVE" ]; then
    rm -rf "$DASH_DIR"
    mkdir -p "$DASH_DIR"
    tar -xzf "$ARCHIVE" -C "$DASH_DIR"
    chown -R "$PI_USER:$PI_USER" "$DASH_DIR"
    rm -f "$ARCHIVE"
    echo "       ✓ Dashboard unpacked to $DASH_DIR"
else
    echo "       ⚠ No archive found — assuming dashboard already in place"
fi

# ── 4. Create pidashboard.service (backend only) ────────────────────
echo "[4/7] Creating pidashboard.service..."
cat > /etc/systemd/system/pidashboard.service << EOF
[Unit]
Description=PiDashboard Backend Server
After=network.target

[Service]
Type=simple
User=$PI_USER
WorkingDirectory=$DASH_DIR
ExecStart=$USER_HOME/.bun/bin/bun run core/tools/server.ts
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
echo "       ✓ pidashboard.service created"

# ── 5. Configure kiosk display (getty auto-login pattern) ────────────
#    Why NOT a systemd service for cage?
#    • cage needs a real login session for DRM/seat access
#    • systemd services with PAMName=login crash with SIGTRAP (exit 133)
#    • systemd services as root lose logind seat ("No data available")
#    • The getty auto-login pattern gives cage a real TTY session
# ─────────────────────────────────────────────────────────────────────
echo "[5/7] Configuring kiosk display..."

# 5a. Disable any leftover kiosk.service from previous attempts
systemctl stop kiosk.service 2>/dev/null || true
systemctl disable kiosk.service 2>/dev/null || true
rm -f /etc/systemd/system/kiosk.service

# 5b. Configure getty@tty1 for auto-login (no password prompt)
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/override.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $PI_USER --noclear %I \$TERM
EOF

systemctl unmask getty@tty1.service 2>/dev/null || true
systemctl enable getty@tty1.service
echo "       ✓ Auto-login configured on tty1"

# 5c. Create .bash_profile kiosk launcher
#     Launches cage+cog ONLY when logged into tty1 (not SSH sessions)
#     Key fixes baked in:
#       • -P wl (not fdo — fdo is deprecated and crashes EGL)
#       • XCURSOR_THEME=transparent (fully invisible cursor)
#       • WLR_NO_HARDWARE_CURSORS=1 (no hardware cursor plane)
PROFILE="$USER_HOME/.bash_profile"

# Remove any previous kiosk block
sed -i '/# --- PiDashboard Kiosk Start ---/,/# --- PiDashboard Kiosk End ---/d' "$PROFILE" 2>/dev/null || true

cat >> "$PROFILE" << 'KIOSK_EOF'

# --- PiDashboard Kiosk Start ---
if [ "$(tty)" = "/dev/tty1" ]; then
    export XDG_RUNTIME_DIR="/run/user/$(id -u)"
    mkdir -p "$XDG_RUNTIME_DIR"
    export WLR_NO_HARDWARE_CURSORS=1
    export WLR_LIBINPUT_NO_DEVICES=1
    export XCURSOR_SIZE=1
    export XCURSOR_THEME=transparent
    # Wait for Bun backend to be ready
    for i in $(seq 1 15); do
        curl -s http://localhost:3000 > /dev/null 2>&1 && break
        sleep 1
    done
    exec cage -d -- cog -P wl http://localhost:3000
fi
# --- PiDashboard Kiosk End ---
KIOSK_EOF

chown "$PI_USER:$PI_USER" "$PROFILE"
echo "       ✓ Kiosk launcher added to .bash_profile"

# 5d. Create transparent cursor theme (makes cursor fully invisible)
CURSOR_DIR="/usr/share/icons/transparent/cursors"
mkdir -p "$CURSOR_DIR"
python3 -c "
import struct
magic = b'Xcur'
header = struct.pack('<III', 16, 0x10000, 1)
toc = struct.pack('<III', 0xfffd0002, 28, 36)
img = struct.pack('<IIIII', 36, 0xfffd0002, 1, 1, 0)
img += struct.pack('<I', 0)  # yhot
pixel = struct.pack('<I', 0x00000000)  # fully transparent ARGB
data = magic + header + toc + img + pixel
names = ['left_ptr','default','top_left_arrow','crosshair','hand2',
         'pointer','watch','xterm','text','arrow','grab','grabbing',
         'hand1','link','progress','wait','help','move','copy',
         'not-allowed','no-drop','all-scroll','col-resize','row-resize',
         'n-resize','s-resize','e-resize','w-resize','ne-resize',
         'nw-resize','se-resize','sw-resize','ew-resize','ns-resize',
         'nesw-resize','nwse-resize','context-menu','cell','vertical-text',
         'alias','zoom-in','zoom-out']
for name in names:
    with open('$CURSOR_DIR/' + name, 'wb') as f:
        f.write(data)
"
cat > /usr/share/icons/transparent/index.theme << EOF
[Icon Theme]
Name=Transparent
Comment=Invisible cursor for kiosk mode
Inherits=default
EOF
echo "       ✓ Transparent cursor theme created"

# ── 6. HDMI stability & screen blanking prevention ──────────────────
echo "[6/7] Configuring HDMI stability..."

CONFIG_TXT="/boot/firmware/config.txt"
CMDLINE_TXT="/boot/firmware/cmdline.txt"

# 6a. config.txt HDMI fixes
HDMI_FIXES=(
    "hdmi_blanking=0"           # Prevent HDMI blanking
    "hdmi_force_hotplug=1"      # Force HDMI even if no display detected
    "hdmi_drive=2"              # Force digital HDMI mode (not DVI)
    "hdmi_ignore_cec=1"         # Ignore CEC commands from TV
    "hdmi_ignore_cec_init=1"    # Don't send CEC init on boot
    "config_hdmi_boost=7"       # Max HDMI signal strength
    "disable_splash=1"          # No boot splash (cleaner kiosk boot)
)

for fix in "${HDMI_FIXES[@]}"; do
    key="${fix%%=*}"
    if ! grep -q "^${key}=" "$CONFIG_TXT" 2>/dev/null; then
        # Add under [all] section
        sed -i "/\[all\]/a ${fix}" "$CONFIG_TXT"
        echo "       + $fix"
    fi
done

# 6b. cmdline.txt kernel parameters
KERNEL_FIXES=(
    "consoleblank=0"             # Disable console blanking
    "vt.global_cursor_default=0" # Hide text-mode cursor
)

CMDLINE=$(cat "$CMDLINE_TXT")
for fix in "${KERNEL_FIXES[@]}"; do
    if [[ "$CMDLINE" != *"$fix"* ]]; then
        sed -i "s|$| ${fix}|" "$CMDLINE_TXT"
        echo "       + $fix (kernel)"
    fi
done

# 6c. Blank underlying console VTs (prevents cursor bleed-through)
cat > /etc/systemd/system/blank-console.service << EOF
[Unit]
Description=Blank console VTs for kiosk mode
After=multi-user.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/bash -c 'for tty in /dev/tty{1..6}; do setterm --blank force --powersave off --cursor off > \$tty 2>/dev/null; done'

[Install]
WantedBy=multi-user.target
EOF
systemctl enable blank-console.service > /dev/null 2>&1
echo "       ✓ HDMI stability configured"

# ── 7. Enable services & finalize ───────────────────────────────────
echo "[7/7] Enabling services..."
systemctl daemon-reload
systemctl enable pidashboard.service
echo "       ✓ pidashboard.service enabled"
echo "       ✓ getty@tty1 auto-login enabled"
echo "       ✓ blank-console.service enabled"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✓ Installation Complete!"
echo ""
echo "  Boot sequence:"
echo "    1. pidashboard.service → starts Bun server"
echo "    2. getty auto-login → logs in $PI_USER on tty1"
echo "    3. .bash_profile → waits for server, launches cage+cog"
echo "    4. Dashboard appears on HDMI — no cursor, no blanking"
echo ""
echo "  Admin panel: http://<pi-ip>:3000/admin/"
echo ""
echo "  Rebooting in 5 seconds..."
echo "═══════════════════════════════════════════════════"
sleep 5
reboot
