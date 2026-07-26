#!/bin/bash
# GPIO state daemon for PiDashboard
# Reads pin states and writes to IPC for WebSocket push
# Uses PIDASH_IPC_FILE env var set by daemon manager

GPIO_BASE="/sys/class/gpio"
OUTPUT="${PIDASH_IPC_FILE:-state/ipc/gpio-display.json}"
CONFIG="${PIDASH_CONFIG:-{}}"

# Parse pin list from config, or use defaults
PINS=($(echo "$CONFIG" | grep -oP '"pins"\s*:\s*\[([0-9,\s]+)\]' | grep -oP '[0-9]+' 2>/dev/null))
if [ ${#PINS[@]} -eq 0 ]; then
  PINS=(17 27 22 23 24 25 5 6 12 13 16 18 19 20 21 26)
fi

POLL_INTERVAL="${POLL_INTERVAL:-2}"

mkdir -p "$(dirname "$OUTPUT")"

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
  JSON+='},"ts":'$(date +%s)'}'
  echo "$JSON" > "$OUTPUT"
  sleep "$POLL_INTERVAL"
done
