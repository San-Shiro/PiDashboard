// Mock system stats endpoint — simulates psutil/proc reads.
// In production this is read from the Pi's /proc filesystem by the Bun server.

import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);

    // Get widget instance count to make RAM math feel realistic
    const enabledWidgets = await sql`
      SELECT i.id, i.widget_id, r.manifest
      FROM widget_instances i
      LEFT JOIN widget_registry r ON r.id = i.widget_id
      WHERE i.enabled = true
    `;

    // Sum estimated daemon RAM
    const widgetTypes = new Set();
    let widgetRamMb = 0;
    for (const w of enabledWidgets) {
      const wid = w.widget_id;
      if (widgetTypes.has(wid)) continue;
      widgetTypes.add(wid);
      const tier = w.manifest?.tier || 1;
      if (tier === 2) widgetRamMb += w.manifest?.estimatedRamMb || 5;
    }

    const sysState =
      await sql`SELECT maintenance_mode FROM system_state WHERE id = 1`;
    const maintenance = sysState[0]?.maintenance_mode || false;

    const baseRam = 40 + 15 + (maintenance ? 0 : 70) + 15;
    const totalUsed =
      baseRam + widgetRamMb + Math.floor(20 + Math.sin(now / 8) * 6);
    const total = 512;

    return Response.json({
      cpu_percent: maintenance
        ? Math.round(5 + Math.random() * 8)
        : Math.round(15 + Math.random() * 18),
      cpu_temp: Math.round((48 + Math.sin(now / 30) * 4) * 10) / 10,
      mem_used_mb: totalUsed,
      mem_total_mb: total,
      mem_percent: Math.round((totalUsed / total) * 100),
      uptime_seconds: 14 * 3600 + (now % 3600),
      disk_used_mb: 2400,
      disk_total_mb: 16000,
      load_avg: [0.42, 0.38, 0.31],
      processes: {
        bun: { ram_mb: 15, cpu: 1.2 },
        cog: maintenance ? null : { ram_mb: 70, cpu: 8.4 },
        widget_daemons: enabledWidgets
          .filter((w) => w.manifest?.tier === 2)
          .map((w) => ({
            name: `widget-${w.widget_id}`,
            ram_mb: w.manifest?.estimatedRamMb || 5,
            cpu: 0.5 + Math.random(),
          })),
      },
    });
  } catch (err) {
    console.error("GET /api/system/stats error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
