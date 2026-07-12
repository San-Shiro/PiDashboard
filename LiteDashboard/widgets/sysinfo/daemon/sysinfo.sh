#!/bin/bash
# Sysinfo daemon for daemon-bridge.ts

while true; do
  CPU=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}')
  RAM_TOTAL=$(free | grep Mem | awk '{print $2}')
  RAM_USED=$(free | grep Mem | awk '{print $3}')
  RAM_PCT=$(echo "scale=2; $RAM_USED / $RAM_TOTAL * 100" | bc)
  if [ -z "$CPU" ]; then CPU="0.0"; fi
  if [ -z "$RAM_PCT" ]; then RAM_PCT="0.0"; fi
  if [ -z "$TEMP" ]; then TEMP="\"N/A\""; fi
  if [ -z "$DISK_PCT" ]; then DISK_PCT="\"N/A\""; fi
  
  echo "{\"cpu\": $CPU, \"ram\": $RAM_PCT, \"temp\": $TEMP, \"disk\": $DISK_PCT}"
  sleep 2
done
