#!/bin/bash
# Music Player Daemon for PiDashboard
# Plays audio through device output using mpv/aplay
# Communicates with daemon-bridge.ts via stdin/stdout JSON
#
# Reads playlist from /tmp/widgets/music-config.json
# Accepts commands: play, pause, next, prev, stop, volume, set-playlist
# Outputs current track info as JSON lines

MUSIC_CONFIG="/tmp/widgets/music-config.json"
IPC_SOCKET="/tmp/pidashboard-mpv-socket"

# Track state
declare -a PLAYLIST=()
CURRENT_INDEX=0
IS_PLAYING=false
LOOP_MODE="playlist"   # playlist | single | none
VOLUME=75
ALBUM_NAME="My Playlist"
MPV_PID=""

cleanup() {
  if [ -n "$MPV_PID" ] && kill -0 "$MPV_PID" 2>/dev/null; then
    kill "$MPV_PID" 2>/dev/null
  fi
  rm -f "$IPC_SOCKET"
  exit 0
}
trap cleanup EXIT INT TERM

# Load playlist from config file
load_config() {
  if [ -f "$MUSIC_CONFIG" ]; then
    local tracks_str=$(cat "$MUSIC_CONFIG" 2>/dev/null | grep -o '"tracks":"[^"]*"' | cut -d'"' -f4)
    local album=$(cat "$MUSIC_CONFIG" 2>/dev/null | grep -o '"albumName":"[^"]*"' | cut -d'"' -f4)
    local vol=$(cat "$MUSIC_CONFIG" 2>/dev/null | grep -o '"volume":[0-9]*' | cut -d: -f2)
    local loop=$(cat "$MUSIC_CONFIG" 2>/dev/null | grep -o '"loop":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$tracks_str" ]; then
      IFS=',' read -ra PLAYLIST <<< "$tracks_str"
      # Trim whitespace from each entry
      for i in "${!PLAYLIST[@]}"; do
        PLAYLIST[$i]=$(echo "${PLAYLIST[$i]}" | sed 's/^ *//;s/ *$//')
      done
    fi
    [ -n "$album" ] && ALBUM_NAME="$album"
    [ -n "$vol" ] && VOLUME="$vol"
    [ -n "$loop" ] && LOOP_MODE="$loop"
  fi
}

# Get track filename from URL path
track_name() {
  local url="$1"
  local name=$(basename "$url" | sed 's/\.[^.]*$//' | sed 's/[-_]/ /g')
  echo "$name"
}

# Emit current state as JSON
emit_state() {
  local track_url=""
  local track_title="No Track"
  local total=${#PLAYLIST[@]}

  if [ $total -gt 0 ] && [ $CURRENT_INDEX -lt $total ]; then
    track_url="${PLAYLIST[$CURRENT_INDEX]}"
    track_title=$(track_name "$track_url")
  fi

  # Get current position and duration from mpv if playing
  local position=0
  local duration=0
  if [ -S "$IPC_SOCKET" ]; then
    position=$(echo '{"command":["get_property","time-pos"]}' | socat - "$IPC_SOCKET" 2>/dev/null | grep -o '"data":[0-9.]*' | cut -d: -f2 | cut -d. -f1 2>/dev/null || echo 0)
    duration=$(echo '{"command":["get_property","duration"]}' | socat - "$IPC_SOCKET" 2>/dev/null | grep -o '"data":[0-9.]*' | cut -d: -f2 | cut -d. -f1 2>/dev/null || echo 0)
  fi
  [ -z "$position" ] && position=0
  [ -z "$duration" ] && duration=0

  echo "{\"track\":\"$track_title\",\"index\":$CURRENT_INDEX,\"total\":$total,\"playing\":$IS_PLAYING,\"album\":\"$ALBUM_NAME\",\"loop\":\"$LOOP_MODE\",\"volume\":$VOLUME,\"position\":$position,\"duration\":$duration}"
}

# Start playing current track via mpv
play_track() {
  local total=${#PLAYLIST[@]}
  if [ $total -eq 0 ]; then
    return
  fi

  # Kill existing mpv
  if [ -n "$MPV_PID" ] && kill -0 "$MPV_PID" 2>/dev/null; then
    kill "$MPV_PID" 2>/dev/null
    wait "$MPV_PID" 2>/dev/null
  fi
  rm -f "$IPC_SOCKET"

  local url="${PLAYLIST[$CURRENT_INDEX]}"
  # Convert /media/ URL to local file path
  local filepath=""
  if [[ "$url" == /media/* ]]; then
    filepath="$(pwd)/media/${url#/media/}"
  else
    filepath="$url"
  fi

  if [ ! -f "$filepath" ]; then
    # Try without URL decoding
    IS_PLAYING=false
    emit_state
    return
  fi

  local loop_flag=""
  if [ "$LOOP_MODE" = "single" ]; then
    loop_flag="--loop-file=inf"
  fi

  # Launch mpv with IPC socket for control
  mpv --no-video --no-terminal \
    --volume="$VOLUME" \
    --input-ipc-server="$IPC_SOCKET" \
    $loop_flag \
    "$filepath" &>/dev/null &
  MPV_PID=$!
  IS_PLAYING=true

  # Wait for track end in background and handle next
  (
    wait "$MPV_PID" 2>/dev/null
    local exit_code=$?
    if [ $exit_code -eq 0 ]; then
      # Track ended naturally — advance
      echo '{"cmd":"_track_ended"}' > /proc/$$/fd/0 2>/dev/null || true
    fi
  ) &

  emit_state
}

next_track() {
  local total=${#PLAYLIST[@]}
  [ $total -eq 0 ] && return

  CURRENT_INDEX=$(( (CURRENT_INDEX + 1) % total ))

  if [ $CURRENT_INDEX -eq 0 ] && [ "$LOOP_MODE" = "none" ]; then
    stop_playback
    return
  fi

  if [ "$IS_PLAYING" = true ]; then
    play_track
  else
    emit_state
  fi
}

prev_track() {
  local total=${#PLAYLIST[@]}
  [ $total -eq 0 ] && return

  # If > 3s into track, restart current
  if [ -S "$IPC_SOCKET" ]; then
    local pos=$(echo '{"command":["get_property","time-pos"]}' | socat - "$IPC_SOCKET" 2>/dev/null | grep -o '"data":[0-9.]*' | cut -d: -f2 | cut -d. -f1 2>/dev/null || echo 0)
    if [ -n "$pos" ] && [ "$pos" -gt 3 ] 2>/dev/null; then
      echo '{"command":["set_property","time-pos",0]}' | socat - "$IPC_SOCKET" 2>/dev/null
      emit_state
      return
    fi
  fi

  CURRENT_INDEX=$(( (CURRENT_INDEX - 1 + total) % total ))
  if [ "$IS_PLAYING" = true ]; then
    play_track
  else
    emit_state
  fi
}

pause_playback() {
  if [ -S "$IPC_SOCKET" ]; then
    echo '{"command":["set_property","pause",true]}' | socat - "$IPC_SOCKET" 2>/dev/null
  fi
  IS_PLAYING=false
  emit_state
}

resume_playback() {
  if [ -S "$IPC_SOCKET" ] && kill -0 "$MPV_PID" 2>/dev/null; then
    echo '{"command":["set_property","pause",false]}' | socat - "$IPC_SOCKET" 2>/dev/null
    IS_PLAYING=true
  else
    play_track
  fi
  emit_state
}

stop_playback() {
  if [ -n "$MPV_PID" ] && kill -0 "$MPV_PID" 2>/dev/null; then
    kill "$MPV_PID" 2>/dev/null
  fi
  IS_PLAYING=false
  CURRENT_INDEX=0
  emit_state
}

set_volume() {
  VOLUME="$1"
  if [ -S "$IPC_SOCKET" ]; then
    echo "{\"command\":[\"set_property\",\"volume\",$VOLUME]}" | socat - "$IPC_SOCKET" 2>/dev/null
  fi
  emit_state
}

# --- Main Loop ---
load_config

# Initial state emission
emit_state

# Emit state periodically (progress updates)
(
  while true; do
    sleep 5
    if [ "$IS_PLAYING" = true ]; then
      emit_state
    fi
  done
) &
PROGRESS_PID=$!

# Read commands from stdin (via daemon-bridge.ts)
while IFS= read -r line; do
  # Parse command
  cmd=$(echo "$line" | grep -o '"cmd":"[^"]*"' | cut -d'"' -f4 2>/dev/null)
  [ -z "$cmd" ] && cmd=$(echo "$line" | grep -o '"action":"[^"]*"' | cut -d'"' -f4 2>/dev/null)

  case "$cmd" in
    play)
      resume_playback
      ;;
    pause)
      pause_playback
      ;;
    toggle)
      if [ "$IS_PLAYING" = true ]; then
        pause_playback
      else
        resume_playback
      fi
      ;;
    next)
      next_track
      ;;
    prev)
      prev_track
      ;;
    stop)
      stop_playback
      ;;
    volume)
      vol=$(echo "$line" | grep -o '"value":[0-9]*' | cut -d: -f2)
      [ -n "$vol" ] && set_volume "$vol"
      ;;
    reload)
      load_config
      emit_state
      ;;
    _track_ended)
      if [ "$LOOP_MODE" = "single" ]; then
        play_track
      else
        next_track
      fi
      ;;
    *)
      # Unknown command — re-emit state
      emit_state
      ;;
  esac
done

kill "$PROGRESS_PID" 2>/dev/null
cleanup
