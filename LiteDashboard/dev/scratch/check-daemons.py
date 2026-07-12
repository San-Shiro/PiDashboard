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
        
        print("\n=== FILES IN /tmp/widgets/ ===")
        stdin, stdout, stderr = client.exec_command("ls -la /tmp/widgets/")
        print(stdout.read().decode('utf-8'))
        
        print("\n=== FILES CONTENT (LATEST VALUES) ===")
        for file in ['sysinfo.json', 'weather.json', 'music-player.json', 'daily-quote.json']:
            stdin, stdout, stderr = client.exec_command(f"cat /tmp/widgets/{file} 2>/dev/null")
            content = stdout.read().decode('utf-8').strip()
            print(f"{file}: {content if content else 'Not Found or Empty'}")
            
        print("\n=== RUNNING DAEMON PROCESSES ===")
        stdin, stdout, stderr = client.exec_command("ps aux | grep -E 'daemons/|scripts/|sysinfo|weather|music-player' | grep -v grep")
        print(stdout.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Failed to check: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        client.close()

if __name__ == '__main__':
    main()
