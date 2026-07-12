import paramiko
import os
import sys

HOST = "192.168.31.239"
USER = "rpsaini"
PASS = "Saini159357"
LOCAL_CANVAS = r"F:\VSCodium\Github\PiDashboard\LiteDashboard\canvases\active.json"
REMOTE_CANVAS = "/home/rpsaini/PiDashboard/canvases/active.json"

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to Pi at {HOST}...")
        client.connect(HOST, username=USER, password=PASS, timeout=15)
        sftp = client.open_sftp()
        
        print("Uploading active.json...")
        sftp.put(LOCAL_CANVAS, REMOTE_CANVAS)
        sftp.close()
        print("Active canvas uploaded successfully!")
        
        # Restart pidashboard
        print("Restarting pidashboard service on Pi...")
        stdin, stdout, stderr = client.exec_command(f"echo '{PASS}' | sudo -S systemctl restart pidashboard.service")
        stdout.read()
        print("Service restarted.")
        
        # Kill cage to trigger kiosk reload
        print("Refreshing kiosk display...")
        client.exec_command(f"echo '{PASS}' | sudo -S killall cage")
        print("Kiosk display refreshed successfully!")
        
    except Exception as e:
        print(f"Failed to deploy canvas: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()

if __name__ == '__main__':
    main()
