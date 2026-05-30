#!/bin/bash
echo "=== 1. Setup Password ==="
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"password":"test1234"}' \
  http://localhost:3000/api/auth/setup
echo ""

echo "=== 2. Login ==="
curl -s -c /tmp/pi-cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"password":"test1234"}' \
  http://localhost:3000/api/auth/login
echo ""

echo "=== 3. Auth Status (authenticated) ==="
curl -s -b /tmp/pi-cookies.txt http://localhost:3000/api/auth/status
echo ""

echo "=== 4. Widget Registry ==="
curl -s -b /tmp/pi-cookies.txt http://localhost:3000/api/widgets/registry | head -c 500
echo ""

echo "=== 5. System Stats ==="
curl -s -b /tmp/pi-cookies.txt http://localhost:3000/api/system/stats
echo ""

echo "=== 6. Templates ==="
curl -s -b /tmp/pi-cookies.txt http://localhost:3000/api/templates | head -c 500
echo ""

echo "=== 7. Media Files ==="
curl -s -b /tmp/pi-cookies.txt http://localhost:3000/api/media
echo ""

echo "=== 8. System State ==="
curl -s -b /tmp/pi-cookies.txt http://localhost:3000/api/system/state
echo ""

echo "=== 9. Kiosk Display ==="
curl -s -o /dev/null -w "HTTP %{http_code}, %{size_download} bytes" http://localhost:3000/
echo ""

echo "=== 10. Admin Panel ==="
curl -s -o /dev/null -w "HTTP %{http_code}, %{size_download} bytes" http://localhost:3000/admin/
echo ""

echo "=== ALL TESTS COMPLETE ==="
