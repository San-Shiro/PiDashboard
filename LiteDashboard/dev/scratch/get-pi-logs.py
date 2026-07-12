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
        
        print("\n=== LATEST PIDASHBOARD SERVICE LOGS ===")
        stdin, stdout, stderr = client.exec_command("journalctl -u pidashboard.service -n 50 --no-pager")
        print(stdout.read().decode('utf-8'))
        
        print("\n=== SYSTEM ERRORS / WARNINGS ===")
        stdin, stdout, stderr = client.exec_command("journalctl -p 3 -n 20 --no-pager")
        print(stdout.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Failed to fetch logs: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()

if __name__ == '__main__':
    main()
