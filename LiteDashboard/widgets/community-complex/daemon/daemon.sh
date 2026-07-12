#!/bin/bash

# PiDashboard will inject PIDASH_IPC_FILE with the correct path
IPC_FILE=${PIDASH_IPC_FILE:-"/tmp/widgets/community-complex.json"}

echo "[Community Complex Daemon] Starting. Writing to: $IPC_FILE"

# Loop every 2 seconds
while true; do
  # Fetch data from public API (WorldTimeAPI for a fast, simple JSON response)
  # We use curl with silent (-s) and timeout (--max-time)
  API_RESPONSE=$(curl -s --max-time 1 "http://worldtimeapi.org/api/timezone/Etc/UTC")
  
  if [ -z "$API_RESPONSE" ]; then
    TIME_STR=$(date +"%H:%M:%S")
  else
    # Naive extraction of time using grep to avoid needing 'jq' dependency
    # E.g. "datetime": "2026-07-11T13:35:10.123Z" -> "13:35:10"
    TIME_STR=$(echo "$API_RESPONSE" | grep -o '"datetime":"[^"]*"' | cut -d'T' -f2 | cut -d'.' -f1)
    if [ -z "$TIME_STR" ]; then
      TIME_STR=$(date +"%H:%M:%S")
    fi
  fi

  # Generate a mock metric (0-100)
  METRIC=$((RANDOM % 101))

  # Build JSON payload
  JSON_DATA="{\"time\":\"$TIME_STR\",\"loadMetrics\":$METRIC}"

  # Write atomically
  TMP_FILE="${IPC_FILE}.tmp"
  echo "$JSON_DATA" > "$TMP_FILE"
  mv "$TMP_FILE" "$IPC_FILE"

  # Sleep for 2 seconds
  sleep 2
done
