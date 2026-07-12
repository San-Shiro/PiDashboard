#!/bin/bash

# Kill background jobs on exit
trap 'kill $(jobs -p) 2>/dev/null; exit' EXIT INT TERM

echo "Starting PiDashboard Testing Environment..."

# 1. Start the unified server
~/.bun/bin/bun run core/tools/server.ts &
SERVER_PID=$!

echo "Waiting 2 seconds for server to start..."
sleep 2

# 2. Start all Daemon Bridges in the background
# Sysinfo and Weather are now managed by DaemonManager automatically!

echo "Starting Buttons Daemon..."
~/.bun/bin/bun run core/tools/daemon-bridge.ts --widget buttons --cmd './scripts/wsl-buttons.sh' &

echo "Starting Media Player Daemon..."
~/.bun/bin/bun run core/tools/daemon-bridge.ts --widget media --cmd './scripts/wsl-media.sh' &

echo "Starting Daily Quote Daemon..."
~/.bun/bin/bun run core/tools/daemon-bridge.ts --widget quotes --cmd './daemons/daily-quote.sh' &

echo "Starting Music Player Daemon..."
~/.bun/bin/bun run core/tools/daemon-bridge.ts --widget music-player --cmd './daemons/music-player.sh' &

echo "====================================================="
echo "PiDashboard is LIVE!"
echo ""
echo "  Kiosk Display:  http://localhost:3000/"
echo "  Admin Panel:    http://localhost:3000/admin/"
echo ""
echo "Press Ctrl+C to stop all services."
echo "====================================================="

# Wait for the server
wait $SERVER_PID
