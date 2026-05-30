#!/bin/bash
# Complex Weather Daemon for daemon-bridge.ts

conditions=("Sunny" "Clear" "Partly Cloudy" "Haze" "Thunderstorm")
temps=(38 35 40 42 33)

while true; do
  idx=$((RANDOM % 5))
  cond=${conditions[$idx]}
  temp=${temps[$idx]}
  
  echo "{\"condition\":\"$cond\",\"temperature\":$temp,\"humidity\":$((RANDOM % 30 + 30)),\"wind\":$((RANDOM % 20 + 10))}"
  
  sleep 10
done
