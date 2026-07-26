#!/bin/bash

# Determine architecture
ARCH=$(uname -m)

if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    ./flight-daemon-arm64
else
    ./flight-daemon-arm
fi
