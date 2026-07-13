// Mock WiFi management. In production the Bun server calls nmcli or wpa_cli.
export async function GET() {
  return Response.json({
    current: {
      ssid: "HomeNetwork-5G",
      signal: 82,
      connected: true,
      ip: "192.168.1.42",
    },
    networks: [
      { ssid: "HomeNetwork-5G", signal: 82, secured: true, connected: true },
      { ssid: "HomeNetwork-2.4", signal: 76, secured: true, connected: false },
      { ssid: "Neighbor_WiFi", signal: 41, secured: true, connected: false },
      { ssid: "GuestNet", signal: 36, secured: false, connected: false },
      { ssid: "CoffeeShop", signal: 28, secured: true, connected: false },
    ],
  });
}
