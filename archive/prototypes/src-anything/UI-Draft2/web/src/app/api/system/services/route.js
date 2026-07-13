// Mock systemd service list. In production the Bun server runs `systemctl status`.
import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const sysState =
      await sql`SELECT maintenance_mode FROM system_state WHERE id = 1`;
    const maintenance = sysState[0]?.maintenance_mode || false;

    const enabledWidgets = await sql`
      SELECT DISTINCT i.widget_id, r.manifest
      FROM widget_instances i
      LEFT JOIN widget_registry r ON r.id = i.widget_id
      WHERE i.enabled = true
    `;

    const services = [
      {
        name: "signage-server.service",
        desc: "Bun HTTP server",
        status: "running",
        core: true,
      },
      {
        name: "signage-display.service",
        desc: "WPE WebKit kiosk",
        status: maintenance ? "stopped" : "running",
        core: true,
      },
    ];

    for (const w of enabledWidgets) {
      if (w.manifest?.tier === 2) {
        services.push({
          name: `widget-${w.widget_id}.service`,
          desc: `${w.manifest?.name || w.widget_id} daemon`,
          status: maintenance ? "stopped" : "running",
          core: false,
        });
      }
    }

    return Response.json({ services });
  } catch (err) {
    console.error("GET /api/system/services error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
