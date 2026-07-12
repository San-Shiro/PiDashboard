#!/bin/bash
# Network info daemon for PiDashboard
# Writes network status to /tmp/widgets/network.json every 10 seconds

OUTPUT="/tmp/widgets/network.json"
mkdir -p /tmp/widgets

while true; do
  # Hostname
  HOSTNAME=$(hostname 2>/dev/null || echo "unknown")

  # IP address (first non-loopback)
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -z "$IP" ]; then
    IP=$(ip -4 addr show scope global 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
  fi
  if [ -z "$IP" ]; then IP="N/A"; fi

  # WiFi SSID
  SSID=""
  SIGNAL=0
  IFACE="eth0"

  # Try iwconfig first
  if command -v iwconfig &>/dev/null; then
    IW_OUT=$(iwconfig 2>/dev/null | grep -A5 "ESSID")
    SSID=$(echo "$IW_OUT" | grep -oP 'ESSID:"\K[^"]+' | head -1)
    # Signal quality from iwconfig (Link Quality=X/70)
    QUAL=$(echo "$IW_OUT" | grep -oP 'Link Quality=\K\d+' | head -1)
    QUAL_MAX=$(echo "$IW_OUT" | grep -oP 'Link Quality=\d+/\K\d+' | head -1)
    if [ -n "$QUAL" ] && [ -n "$QUAL_MAX" ] && [ "$QUAL_MAX" -gt 0 ]; then
      SIGNAL=$((QUAL * 100 / QUAL_MAX))
    fi
    IFACE=$(echo "$IW_OUT" | head -1 | awk '{print $1}')
  fi

  # Fallback to nmcli if SSID still empty
  if [ -z "$SSID" ] && command -v nmcli &>/dev/null; then
    SSID=$(nmcli -t -f active,ssid dev wifi 2>/dev/null | grep '^yes' | cut -d: -f2)
    if [ -n "$SSID" ]; then
      SIG_RAW=$(nmcli -t -f active,signal dev wifi 2>/dev/null | grep '^yes' | cut -d: -f2)
      if [ -n "$SIG_RAW" ]; then SIGNAL=$SIG_RAW; fi
    fi
    NM_IFACE=$(nmcli -t -f device,type dev 2>/dev/null | grep ':wifi$' | cut -d: -f1 | head -1)
    if [ -n "$NM_IFACE" ]; then IFACE=$NM_IFACE; fi
  fi

  # Fallback to iw if still empty
  if [ -z "$SSID" ] && command -v iw &>/dev/null; then
    WLAN=$(iw dev 2>/dev/null | grep Interface | awk '{print $2}' | head -1)
    if [ -n "$WLAN" ]; then
      IFACE=$WLAN
      SSID=$(iw dev "$WLAN" link 2>/dev/null | grep -oP 'SSID: \K.+')
      SIG_DBM=$(iw dev "$WLAN" link 2>/dev/null | grep -oP 'signal: \K-?\d+')
      if [ -n "$SIG_DBM" ]; then
        # Convert dBm to percentage (-30 = 100%, -90 = 0%)
        if [ "$SIG_DBM" -ge -30 ]; then SIGNAL=100;
        elif [ "$SIG_DBM" -le -90 ]; then SIGNAL=0;
        else SIGNAL=$(( (SIG_DBM + 90) * 100 / 60 )); fi
      fi
    fi
  fi

  if [ -z "$SSID" ]; then SSID="Not connected"; fi
  if [ -z "$IFACE" ]; then IFACE="unknown"; fi

  # Uptime
  UPTIME=$(uptime -p 2>/dev/null | sed 's/^up //')
  if [ -z "$UPTIME" ]; then UPTIME="N/A"; fi

  # Write JSON
  cat > "$OUTPUT" <<EOF
{
  "hostname": "$HOSTNAME",
  "ip": "$IP",
  "ssid": "$SSID",
  "signal_percent": $SIGNAL,
  "interface": "$IFACE",
  "uptime": "$UPTIME"
}
EOF

  sleep 10
done
