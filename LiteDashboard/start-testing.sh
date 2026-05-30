#!/bin/bash

# Kill background jobs on exit
trap 'kill $(jobs -p) 2>/dev/null; exit' EXIT INT TERM

echo "Starting PiDashboard Testing Environment..."

# 1. Start the main Test Server
~/.bun/bin/bun run core/tools/test-server.ts &
SERVER_PID=$!

echo "Waiting 2 seconds for server to start..."
sleep 2

# 2. Start all Daemon Bridges in the background
echo "Starting SysInfo Daemon..."
~/.bun/bin/bun run core/tools/daemon-bridge.ts --widget sysinfo --cmd './scripts/wsl-sysinfo.sh' &

echo "Starting Buttons Daemon..."
~/.bun/bin/bun run core/tools/daemon-bridge.ts --widget buttons --cmd './scripts/wsl-buttons.sh' &

echo "Starting Media Player Daemon..."
~/.bun/bin/bun run core/tools/daemon-bridge.ts --widget media --cmd './scripts/wsl-media.sh' &

echo "Starting Weather Daemon..."
~/.bun/bin/bun run core/tools/daemon-bridge.ts --widget weather --cmd './scripts/wsl-weather.sh' &

echo "====================================================="
echo "Testing environment is LIVE!"
echo "Open your browser to: http://localhost:3000/?canvas=test"
echo "Press Ctrl+C to stop all services."
echo "====================================================="

# Wait for the server
wait $SERVER_PID
