#!/bin/bash
# Login
curl -s -c /tmp/pi-cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"password":"test1234"}' http://localhost:3000/api/auth/login > /dev/null

echo "=== List canvases ==="
curl -s -b /tmp/pi-cookies.txt http://localhost:3000/api/templates | python3 -c "
import json,sys
data=json.load(sys.stdin)
for t in data['templates']:
    print(f'  id={t[\"id\"]}  name={t.get(\"name\",\"?\")}')
if not data['templates']:
    print('  (no canvases)')
"

echo ""
echo "=== Apply first canvas ==="
FIRST_ID=$(curl -s -b /tmp/pi-cookies.txt http://localhost:3000/api/templates | python3 -c "
import json,sys
data=json.load(sys.stdin)
if data['templates']: print(data['templates'][0]['id'])
else: print('NONE')
")

if [ "$FIRST_ID" = "NONE" ]; then
  echo "  No canvases to apply"
else
  echo "  Applying: $FIRST_ID"
  curl -s -b /tmp/pi-cookies.txt -X POST "http://localhost:3000/api/templates/$FIRST_ID/apply"
  echo ""
fi

echo ""
echo "=== Test kiosk display ==="
RESULT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
echo "  HTTP status: $RESULT"
if [ "$RESULT" = "200" ]; then
  echo "  SUCCESS - kiosk display renders!"
else
  echo "  FAIL - checking error..."
  curl -s http://localhost:3000/ | head -c 200
fi
