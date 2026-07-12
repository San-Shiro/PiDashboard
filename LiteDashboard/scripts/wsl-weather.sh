#!/bin/bash
# Weather Daemon for daemon-bridge.ts
# Reads location from /tmp/widgets/weather-config.json if available
# Falls back to simulated data for testing

CONFIG_FILE="/tmp/widgets/weather-config.json"

# Default location
LOCATION="Your City"

while true; do
  # Try to read configured location
  if [ -f "$CONFIG_FILE" ]; then
    LOC=$(cat "$CONFIG_FILE" 2>/dev/null | grep -o '"location":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$LOC" ]; then
      LOCATION="$LOC"
    fi
  fi

  # Try real weather from wttr.in (lightweight, no API key needed)
  WEATHER=$(curl -sf "wttr.in/${LOCATION// /+}?format=j1" 2>/dev/null)

  if [ -n "$WEATHER" ] && echo "$WEATHER" | grep -q "current_condition"; then
    # Parse real weather data
    TEMP=$(echo "$WEATHER" | grep -o '"temp_C":"[^"]*"' | head -1 | cut -d'"' -f4)
    HUMIDITY=$(echo "$WEATHER" | grep -o '"humidity":"[^"]*"' | head -1 | cut -d'"' -f4)
    WIND=$(echo "$WEATHER" | grep -o '"windspeedKmph":"[^"]*"' | head -1 | cut -d'"' -f4)
    FEELS=$(echo "$WEATHER" | grep -o '"FeelsLikeC":"[^"]*"' | head -1 | cut -d'"' -f4)
    DESC=$(echo "$WEATHER" | grep -o '"weatherDesc":\[{"value":"[^"]*"}' | head -1 | grep -o '"value":"[^"]*"' | cut -d'"' -f4)

    # Default values if parsing fails
    TEMP=${TEMP:-"--"}
    HUMIDITY=${HUMIDITY:-"--"}
    WIND=${WIND:-"--"}
    FEELS=${FEELS:-$TEMP}
    DESC=${DESC:-"Unknown"}

    echo "{\"condition\":\"$DESC\",\"temperature\":$TEMP,\"humidity\":$HUMIDITY,\"wind\":$WIND,\"feels_like\":$FEELS,\"location\":\"$LOCATION\"}"
  else
    # Fallback: simulated data for testing / offline
    conditions=("Sunny" "Clear" "Partly Cloudy" "Haze" "Thunderstorm")
    temps=(38 35 40 42 33)
    idx=$((RANDOM % 5))
    cond=${conditions[$idx]}
    temp=${temps[$idx]}

    echo "{\"condition\":\"$cond\",\"temperature\":$temp,\"humidity\":$((RANDOM % 30 + 30)),\"wind\":$((RANDOM % 20 + 10)),\"feels_like\":$((temp + RANDOM % 5 - 2)),\"location\":\"$LOCATION\"}"
  fi

  sleep 300
done
