#!/bin/bash
# Buttons daemon for daemon-bridge.ts

CLICKS=0
echo "{\"clicks\": $CLICKS}"

# Read cmd JSON lines from stdin
while read -r line ; do
  if echo "$line" | grep -q '"action":"click"'; then
    CLICKS=$((CLICKS+1))
    echo "{\"clicks\": $CLICKS}"
  fi
done
