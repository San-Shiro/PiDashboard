import paramiko
import sys

HOST = "192.168.31.239"
USER = "rpsaini"
PASS = "Saini159357"

def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to Pi at {HOST}...")
        client.connect(HOST, username=USER, password=PASS, timeout=15)
        
        print("\n=== SYSTEMD WIDGET / DAEMON SERVICES ===")
        stdin, stdout, stderr = client.exec_command("systemctl list-units --type=service | grep -E 'pidashboard|blank|quote|sysinfo|weather|music'")
        print(stdout.read().decode('utf-8', errors='ignore').encode('ascii', errors='ignore').decode('ascii'))
        
        print("\n=== ALL SYSTEMD OVERRIDES OR WIDGET SERVICES ===")
        stdin, stdout, stderr = client.exec_command("systemctl list-unit-files | grep -E 'pidashboard|blank|quote|sysinfo|weather|music'")
        print(stdout.read().decode('utf-8', errors='ignore').encode('ascii', errors='ignore').decode('ascii'))
        
    except Exception as e:
        print(f"Failed to check: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()

if __name__ == '__main__':
    main()
