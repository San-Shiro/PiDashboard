// Mock widget data — on the real Pi, these JSON files are written by Go/Rust daemons
// to /tmp/widgets/<name>.json. Here we simulate those payloads.

const LYRICS_LINES = [
  {
    current_line: "Is this the real life?",
    next_line: "Is this just fantasy?",
  },
  {
    current_line: "Caught in a landslide,",
    next_line: "No escape from reality.",
  },
  {
    current_line: "Open your eyes,",
    next_line: "Look up to the skies and see—",
  },
  { current_line: "I'm just a poor boy,", next_line: "I need no sympathy." },
  {
    current_line: "Easy come, easy go,",
    next_line: "Little high, little low.",
  },
  {
    current_line: "Anyway the wind blows,",
    next_line: "Doesn't really matter to me.",
  },
];

export async function GET(request, { params: { name } }) {
  const now = Math.floor(Date.now() / 1000);
  const lineIndex = Math.floor(Date.now() / 4000) % LYRICS_LINES.length;

  const mockData = {
    weather: {
      temp: 18,
      feels_like: 15,
      condition: "Partly Cloudy",
      icon: "cloud-sun",
      humidity: 72,
      wind_kph: 14,
      updated_at: now,
    },
    lyrics: {
      title: "Bohemian Rhapsody",
      artist: "Queen",
      current_line: LYRICS_LINES[lineIndex].current_line,
      next_line: LYRICS_LINES[lineIndex].next_line,
      progress: (Date.now() % 180000) / 180000,
    },
    sysinfo: {
      cpu_temp: parseFloat((50 + Math.random() * 8).toFixed(1)),
      cpu_percent: Math.floor(12 + Math.random() * 25),
      mem_used_mb: Math.floor(185 + Math.random() * 30),
      mem_total_mb: 512,
      uptime_hours: 14,
      updated_at: now,
    },
    automation: {
      scene: "evening",
      lights_on: true,
      next_event: "Sunset at 20:34",
      triggered_rules: ["dim_at_sunset"],
      updated_at: now,
    },
  };

  const data = mockData[name];
  if (!data) {
    return new Response(JSON.stringify({ error: "Unknown widget" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
