#!/bin/bash

# Weather Daemon using Open-Meteo
# Requires jq and curl

while true; do
  
  if [ -z "$PIDASH_CONFIG" ]; then
    PIDASH_CONFIG="{}"
  fi
  
  # Read single instance config
  LAT=$(echo "$PIDASH_CONFIG" | jq -r ".locationData.latitude // empty")
  LON=$(echo "$PIDASH_CONFIG" | jq -r ".locationData.longitude // empty")
  UNITS=$(echo "$PIDASH_CONFIG" | jq -r ".units // \"celsius\"")
  NAME=$(echo "$PIDASH_CONFIG" | jq -r ".locationData.name // \"Unknown\"")
  
  OUT="{}"

  if [ -n "$LAT" ] && [ -n "$LON" ]; then
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
    THEME="sunny"
    ICON="☀️"
    if [ "$WCODE" -ge 95 ]; then COND="Thunderstorm"; THEME="thunder"; ICON="⛈️";
    elif [ "$WCODE" -ge 61 ]; then COND="Rain"; THEME="rainy"; ICON="🌧️";
    elif [ "$WCODE" -ge 51 ]; then COND="Drizzle"; THEME="rainy"; ICON="🌦️";
    elif [ "$WCODE" -ge 3 ]; then COND="Cloudy"; THEME="cloudy"; ICON="☁️";
    elif [ "$WCODE" -ge 1 ]; then COND="Partly Cloudy"; THEME="cloudy"; ICON="⛅";
    fi
    
    OUT="{ \"location\": \"$NAME\", \"temperature\": $TEMP, \"humidity\": $HUMIDITY, \"feels_like\": $FEELS, \"wind\": $WIND, \"condition\": \"$COND\", \"theme\": \"$THEME\", \"icon\": \"$ICON\" }"
  fi
  
  echo "$OUT" > "$PIDASH_IPC_FILE"
  
  # Calculate sleep seconds from config
  REFRESH_MINS=$(echo "$PIDASH_CONFIG" | jq -r ".refreshMinutes // 10")
  SLEEP_SECS=$((REFRESH_MINS * 60))
  if [ "$SLEEP_SECS" -lt 10 ]; then
    SLEEP_SECS=10
  fi

  # Sleep checking for commands every second
  for ((i=0; i<SLEEP_SECS; i++)); do
    CMD_FILE="$PIDASH_IPC_DIR/$PIDASH_DAEMON_ID.cmd.json"
    if [ -f "$CMD_FILE" ]; then
      ACTION=$(jq -r ".action // empty" "$CMD_FILE")
      if [ "$ACTION" = "refresh" ] || [ "$ACTION" = "config_update" ]; then
        NEW_CONFIG=$(jq -c ".config // empty" "$CMD_FILE")
        if [ -n "$NEW_CONFIG" ]; then
          PIDASH_CONFIG="$NEW_CONFIG"
        fi
        rm -f "$CMD_FILE"
        break
      fi
      rm -f "$CMD_FILE"
    fi
    sleep 1
  done
done
