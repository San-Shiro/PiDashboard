// Mock bluetooth. In production the Bun server calls bluetoothctl.
export async function GET() {
  return Response.json({
    enabled: true,
    devices: [
      {
        mac: "AA:BB:CC:11:22:33",
        name: "Sony WH-1000XM4",
        paired: true,
        connected: true,
      },
      {
        mac: "AA:BB:CC:11:22:44",
        name: "Pi Keyboard",
        paired: true,
        connected: false,
      },
      {
        mac: "AA:BB:CC:11:22:55",
        name: "iPhone",
        paired: false,
        connected: false,
      },
    ],
  });
}
