#!/bin/bash
# GPIO state daemon for PiDashboard
# Reads pin states and writes to tmpfs for WebSocket push

GPIO_BASE="/sys/class/gpio"
OUTPUT="/tmp/widgets/gpio.json"
PINS=(17 27 22 23 24 25 5 6 12 13 16 18 19 20 21 26)

mkdir -p /tmp/widgets

while true; do
  JSON='{"pins":{'
  FIRST=1
  for PIN in "${PINS[@]}"; do
    if [ -d "$GPIO_BASE/gpio$PIN" ]; then
      DIR=$(cat "$GPIO_BASE/gpio$PIN/direction" 2>/dev/null || echo "in")
      VAL=$(cat "$GPIO_BASE/gpio$PIN/value" 2>/dev/null || echo "0")
      [ $FIRST -eq 0 ] && JSON+=","
      JSON+="\"$PIN\":{\"mode\":\"$DIR\",\"value\":$VAL}"
      FIRST=0
    fi
  done
  JSON+='}}'
  echo "$JSON" > "$OUTPUT"
  sleep 2
done
