import paramiko
import os
import sys

HOST = "192.168.31.239"
USER = "rpsaini"
PASS = "Saini159357"

LOCAL_SYS = os.path.join(os.getcwd(), 'core', 'server', 'api', 'system.ts')
REMOTE_SYS = "/home/rpsaini/PiDashboard/core/server/api/system.ts"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    print(f"Connecting to Pi at {HOST}...")
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    sftp = client.open_sftp()
    
    print(f"Uploading system.ts fix...")
    sftp.put(LOCAL_SYS, REMOTE_SYS)
    
    print("Restarting pidashboard...")
    stdin, stdout, stderr = client.exec_command(f"echo '{PASS}' | sudo -S systemctl restart pidashboard.service")
    stdout.read()
    
    print("Backend fix uploaded successfully.")
except Exception as e:
    print(f"Failed to upload: {e}")
finally:
    client.close()
