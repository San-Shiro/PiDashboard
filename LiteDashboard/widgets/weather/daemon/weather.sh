#!/bin/bash

# Weather Daemon using Open-Meteo
# Requires jq and curl

while true; do
  OUT="{"
  
  if [ -z "$PIDASH_CONFIG" ]; then
    PIDASH_CONFIG="{}"
  fi
  
  # Proceed assuming jq is installed. Use absolute path if necessary, but jq should be in PATH.

  # Extract instance IDs
  INSTANCES=$(echo "$PIDASH_CONFIG" | jq -r 'keys[] | select(. != "_isInstances")')
  
  FIRST=1
  for INST in $INSTANCES; do
    LAT=$(echo "$PIDASH_CONFIG" | jq -r ".\"$INST\".locationData.latitude // empty")
    LON=$(echo "$PIDASH_CONFIG" | jq -r ".\"$INST\".locationData.longitude // empty")
    UNITS=$(echo "$PIDASH_CONFIG" | jq -r ".\"$INST\".units // \"celsius\"")
    NAME=$(echo "$PIDASH_CONFIG" | jq -r ".\"$INST\".locationData.name // \"Unknown\"")
    
    if [ -n "$LAT" ] && [ -n "$LON" ]; then
      if [ "$FIRST" -eq 1 ]; then
        FIRST=0
      else
        OUT="$OUT,"
      fi
      
      TEMP_UNIT=""
      if [ "$UNITS" = "fahrenheit" ]; then
        TEMP_UNIT="&temperature_unit=fahrenheit&wind_speed_unit=mph"
      fi
      
      URL="https://api.open-meteo.com/v1/forecast?latitude=$LAT&longitude=$LON&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m${TEMP_UNIT}"
      RES=$(curl -s "$URL")
      
      TEMP=$(echo "$RES" | jq '.current.temperature_2m // null')
      HUMIDITY=$(echo "$RES" | jq '.current.relative_humidity_2m // null')
      FEELS=$(echo "$RES" | jq '.current.apparent_temperature // null')
      WIND=$(echo "$RES" | jq '.current.wind_speed_10m // null')
      WCODE=$(echo "$RES" | jq '.current.weather_code // 0')
      
      COND="Clear"
      if [ "$WCODE" -ge 95 ]; then COND="Thunderstorm";
      elif [ "$WCODE" -ge 61 ]; then COND="Rain";
      elif [ "$WCODE" -ge 51 ]; then COND="Drizzle";
      elif [ "$WCODE" -ge 3 ]; then COND="Cloudy";
      elif [ "$WCODE" -ge 1 ]; then COND="Partly Cloudy";
      fi
      
      OUT="$OUT \"$INST\": { \"location\": \"$NAME\", \"temperature\": $TEMP, \"humidity\": $HUMIDITY, \"feels_like\": $FEELS, \"wind\": $WIND, \"condition\": \"$COND\" }"
    fi
  done
  
  OUT="$OUT }"
  echo "$OUT" > "$PIDASH_IPC_FILE"
  
  # Sleep for 10 minutes
  sleep 600
done
