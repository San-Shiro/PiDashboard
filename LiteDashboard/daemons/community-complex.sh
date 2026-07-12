#!/bin/bash

WIDGET_ID="community-complex"
OUT_FILE="${PIDASH_IPC_FILE:-/tmp/widgets/$WIDGET_ID.json}"
TMP_DIR=$(dirname "$OUT_FILE")

mkdir -p "$TMP_DIR"

while true; do
  # Get current time
  TIME_STR=$(date +"%H:%M:%S")
  
  # Generate a random load metric (0-100)
  LOAD=$((RANDOM % 101))
  
  # Write to temp file then move to ensure atomic write
  TMP_OUT="$OUT_FILE.tmp"
  echo "{\"time\": \"$TIME_STR\", \"loadMetrics\": $LOAD}" > "$TMP_OUT"
  mv "$TMP_OUT" "$OUT_FILE"
  
  sleep 1
done
