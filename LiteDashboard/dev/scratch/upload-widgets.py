import os
import sys
import paramiko

HOST = "192.168.31.239"
USER = "rpsaini"
PASS = "Saini159357"
REMOTE_WIDGETS_DIR = "/home/rpsaini/PiDashboard/widgets"

def sync_dir(sftp, local_dir, remote_dir):
    try:
        sftp.mkdir(remote_dir)
    except IOError:
        pass # Already exists
        
    for item in os.listdir(local_dir):
        if item.startswith('.') or item.startswith('_'):
            continue
        local_path = os.path.join(local_dir, item)
        remote_path = remote_dir + '/' + item
        
        if os.path.isdir(local_path):
            sync_dir(sftp, local_path, remote_path)
        else:
            print(f"  Uploading: {item}")
            sftp.put(local_path, remote_path)

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to Pi Zero 2W at {HOST}...")
        client.connect(HOST, username=USER, password=PASS, timeout=15)
        sftp = client.open_sftp()
        
        print("Connected! Syncing widgets...")
        local_widgets_dir = os.path.join(os.getcwd(), 'widgets')
        
        # Iterate over all folders in widgets/ and sync them
        for folder in os.listdir(local_widgets_dir):
            if folder.startswith('.') or folder.startswith('_'):
                continue
            local_folder_path = os.path.join(local_widgets_dir, folder)
            if not os.path.isdir(local_folder_path):
                continue
                
            print(f"Syncing: {folder}")
            sync_dir(sftp, local_folder_path, f"{REMOTE_WIDGETS_DIR}/{folder}")
            
        print("\nAll widgets successfully synced to Pi Zero!")
        
        # Restart pidashboard service to reload cached fragments
        print("Restarting pidashboard service on Pi to refresh cache...")
        stdin, stdout, stderr = client.exec_command(f"echo '{PASS}' | sudo -S systemctl restart pidashboard.service")
        # Read to ensure it runs
        stdout.read()
        print("Service restarted successfully!")
        
        # Restart cage/kiosk to pick up UI changes if necessary
        print("Triggering kiosk refresh...")
        client.exec_command(f"echo '{PASS}' | sudo -S killall cage")
        print("Done!")
        
    except Exception as e:
        print(f"Failed to sync widgets: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()

if __name__ == '__main__':
    main()
