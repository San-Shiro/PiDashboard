// Mock widget data endpoint — simulates Bun reading /tmp/widgets/*.json on the Pi.
// In production, this will be replaced with a Bun handler that reads the tmpfs file.

export async function GET(request, { params }) {
  const { name } = params;
  const now = Math.floor(Date.now() / 1000);

  switch (name) {
    case "weather":
      return Response.json({
        temp: 18,
        feels_like: 15,
        condition: "Partly Cloudy",
        icon: "cloud-sun",
        humidity: 72,
        wind_kph: 12,
        updated_at: now,
      });

    case "lyrics": {
      const lines = [
        { current: "Is this the real life?", next: "Is this just fantasy?" },
        { current: "Caught in a landslide", next: "No escape from reality" },
        { current: "Open your eyes", next: "Look up to the skies and see" },
      ];
      const i = Math.floor(now / 6) % lines.length;
      return Response.json({
        title: "Bohemian Rhapsody",
        artist: "Queen",
        album: "A Night at the Opera",
        current_line: lines[i].current,
        next_line: lines[i].next,
        progress: (now % 240) / 240,
      });
    }

    case "sysinfo":
      return Response.json({
        cpu_temp: 52.4 + Math.sin(now / 30) * 2,
        cpu_percent: Math.round(15 + Math.random() * 20),
        mem_used_mb: 187 + Math.round(Math.random() * 10),
        mem_total_mb: 512,
        uptime_hours: 14,
      });

    case "automation":
      return Response.json({
        scene: "evening",
        lights_on: true,
        next_event: "Sunset at 20:34",
        triggered_rules: ["dim_at_sunset"],
      });

    default:
      return Response.json({ error: "Unknown widget" }, { status: 404 });
  }
}
