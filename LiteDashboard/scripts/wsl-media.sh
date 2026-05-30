#!/bin/bash
# Complex Media Daemon for daemon-bridge.ts

playing=1
progress=0
song_idx=0

songs=("Bohemian Rhapsody" "Hotel California" "Stairway to Heaven")
artists=("Queen" "Eagles" "Led Zeppelin")
lyrics=(
  "Is this the real life? Is this just fantasy?"
  "Welcome to the Hotel California..."
  "There's a lady who's sure all that glitters is gold..."
)

# Initial state broadcast
echo "{\"title\":\"${songs[$song_idx]}\",\"artist\":\"${artists[$song_idx]}\",\"lyrics\":\"${lyrics[$song_idx]}\",\"progress\":$progress,\"playing\":$playing}"

while true; do
  # Read stdin with 1 second timeout to act as our sleep loop
  if read -t 1 -r line; then
    if echo "$line" | grep -q '"action":"play"'; then playing=1; fi
    if echo "$line" | grep -q '"action":"pause"'; then playing=0; fi
    if echo "$line" | grep -q '"action":"next"'; then 
      song_idx=$(( (song_idx + 1) % 3 ))
      progress=0
    fi
    if echo "$line" | grep -q '"action":"prev"'; then 
      song_idx=$(( (song_idx + 2) % 3 ))
      progress=0
    fi
  fi
  
  if [ $playing -eq 1 ]; then
    progress=$((progress + 2)) # Increment progress
    if [ $progress -ge 100 ]; then
      progress=0
      song_idx=$(( (song_idx + 1) % 3 ))
    fi
  fi

  echo "{\"title\":\"${songs[$song_idx]}\",\"artist\":\"${artists[$song_idx]}\",\"lyrics\":\"${lyrics[$song_idx]}\",\"progress\":$progress,\"playing\":$playing}"
done
