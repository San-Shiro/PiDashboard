import urllib.request
import sys

def main():
    try:
        url = "http://192.168.31.239:3000/"
        print(f"Fetching composite HTML from {url}...")
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8')
            
        print("\n=== COMPOSITE HTML (First 150 lines) ===")
        lines = html.split('\n')
        for i, line in enumerate(lines[:150]):
            print(f"{i+1:3d}: {line}")
            
        print("\n=== COMPOSITE HTML (Widgets script blocks) ===")
        # Look for script tags
        import re
        scripts = re.findall(r'<script>([\s\S]*?)</script>', html)
        print(f"Found {len(scripts)} script tags.")
        for idx, script in enumerate(scripts):
            if 'WIDGET CODE' in script:
                print(f"\n--- Script {idx} (Widget) ---")
                print('\n'.join(script.split('\n')[:30]))
                print("...")
                
    except Exception as e:
        print(f"Failed to fetch HTML: {e}", file=sys.stderr)

if __name__ == '__main__':
    main()
