#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════════
  PiDashboard — One-Click Deployer (runs from Windows/Mac/Linux via SSH)
═══════════════════════════════════════════════════════════════════════════

Usage:
    python deploy-pidashboard.py                      # Uses defaults
    python deploy-pidashboard.py 192.168.1.50 pi raspberry

Prerequisites:
    pip install paramiko

What it does:
    1. Connects to the Pi via SSH (Paramiko)
    2. Verifies the Pi is running 64-bit OS (required for Bun)
    3. Creates & uploads a tar.gz archive of the active LiteDashboard app
    4. Uploads the pi-kiosk-setup.sh installer script
    5. Executes the installer (installs packages, configures kiosk)
    6. Pi reboots → dashboard appears on HDMI automatically
═══════════════════════════════════════════════════════════════════════════
"""

import paramiko
import tarfile
import time
import sys
import os
import io

# ── Configuration (override via command-line args) ───────────────────
DEFAULT_HOST = "192.168.31.239"
DEFAULT_USER = "rpsaini"
DEFAULT_PASS = "Saini159357"

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)  # Parent of deploy/
APP_ROOT = os.path.join(PROJECT_ROOT, "LiteDashboard")
ARTIFACTS_DIR = os.path.join(PROJECT_ROOT, "archive", "artifacts")
SETUP_SCRIPT = os.path.join(SCRIPT_DIR, "pi-kiosk-setup.sh")


def parse_args():
    """Parse optional CLI args: host user password"""
    host = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_HOST
    user = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_USER
    pwd  = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_PASS
    return host, user, pwd


def create_archive(app_root: str) -> str:
    """Create a tar.gz of LiteDashboard contents, excluding local/runtime files."""
    if not os.path.isdir(app_root):
        raise FileNotFoundError(f"Active app workspace not found: {app_root}")

    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    archive_path = os.path.join(ARTIFACTS_DIR, "pi-dashboard.tar.gz")

    exclude_dirs = {
        ".git", "node_modules", ".planning", ".agent",
        "__pycache__", ".vscode", "dev", "state", "tmp_widgets",
    }
    exclude_exts = {".pyc", ".log"}

    print(f"       Archiving {app_root}...")
    with tarfile.open(archive_path, "w:gz") as tar:
        for root, dirs, files in os.walk(app_root):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for f in files:
                if os.path.splitext(f)[1] in exclude_exts:
                    continue
                if f == "pi-dashboard.tar.gz":
                    continue
                full = os.path.join(root, f)
                arcname = os.path.relpath(full, app_root)
                tar.add(full, arcname=arcname)

    size_mb = os.path.getsize(archive_path) / (1024 * 1024)
    print(f"       Archive: {size_mb:.1f} MB")
    return archive_path


def main():
    host, user, pwd = parse_args()

    print("")
    print("═" * 57)
    print("  PiDashboard — One-Click Deployer")
    print("═" * 57)
    print(f"  Target:  {user}@{host}")
    print(f"  Project: {PROJECT_ROOT}")
    print(f"  App:     {APP_ROOT}")
    print("")

    # ── Step 1: Create archive ──────────────────────────────────────
    print("[1/5] Creating project archive...")
    archive_path = create_archive(APP_ROOT)

    # ── Step 2: Connect ─────────────────────────────────────────────
    print(f"\n[2/5] Connecting to {host}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(host, username=user, password=pwd,
                       timeout=30, banner_timeout=30, auth_timeout=30)
    except Exception as e:
        print(f"       ✗ Connection failed: {e}")
        print(f"       Make sure SSH is enabled and the Pi is reachable.")
        sys.exit(1)
    print("       ✓ Connected")

    # ── Step 3: Verify 64-bit ───────────────────────────────────────
    print("\n[3/5] Verifying Pi architecture...")
    stdin, stdout, stderr = client.exec_command("uname -m")
    arch = stdout.read().decode().strip()
    print(f"       Architecture: {arch}")
    if arch not in ("aarch64", "arm64"):
        print("       ✗ ERROR: Pi OS must be 64-bit (aarch64).")
        print("         Bun runtime does not support 32-bit ARM.")
        print("         Please reflash with 'Raspberry Pi OS Lite (64-bit)'.")
        client.close()
        sys.exit(1)
    print("       ✓ 64-bit confirmed")

    # ── Step 4: Upload files ────────────────────────────────────────
    print("\n[4/5] Uploading files...")
    remote_home = f"/home/{user}"
    sftp = client.open_sftp()

    sftp.put(archive_path, f"{remote_home}/pi-dashboard.tar.gz")
    print("       ✓ Dashboard archive uploaded")

    sftp.put(SETUP_SCRIPT, f"{remote_home}/pi-kiosk-setup.sh")
    print("       ✓ Setup script uploaded")

    sftp.close()

    # Clean up local archive
    os.remove(archive_path)

    # ── Step 5: Execute installer ───────────────────────────────────
    print(f"\n[5/5] Running installer on Pi (this takes 3-5 minutes)...\n")
    print("─" * 57)

    transport = client.get_transport()
    chan = transport.open_session()
    chan.get_pty(width=220, height=50)

    cmd = (f"chmod +x {remote_home}/pi-kiosk-setup.sh && "
           f"echo '{pwd}' | sudo -S bash {remote_home}/pi-kiosk-setup.sh {user}")
    chan.exec_command(cmd)

    # Stream output until the Pi reboots
    try:
        while True:
            if chan.recv_ready():
                data = chan.recv(8192)
                # Handle encoding for Windows terminals
                text = data.decode("utf-8", errors="replace")
                sys.stdout.write(text)
                sys.stdout.flush()
            if chan.exit_status_ready() and not chan.recv_ready():
                break
            time.sleep(0.1)
    except Exception as e:
        msg = str(e).lower()
        if any(k in msg for k in ("connection", "eof", "closed", "reset")):
            pass  # Expected — Pi rebooted
        else:
            print(f"\n[warning] {e}")

    print("\n" + "─" * 57)
    print("")
    print("═" * 57)
    print("  ✓ Deployment Complete!")
    print("")
    print(f"  The Pi is rebooting. In ~30 seconds:")
    print(f"    • HDMI display → PiDashboard kiosk (no cursor)")
    print(f"    • Admin panel  → http://{host}:3000/admin/")
    print(f"    • SSH access   → ssh {user}@{host}")
    print("═" * 57)

    try:
        client.close()
    except Exception:
        pass


if __name__ == "__main__":
    main()
