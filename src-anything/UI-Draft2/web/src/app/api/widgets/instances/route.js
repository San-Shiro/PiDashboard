import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const rows = await sql`
      SELECT i.id, i.widget_id, i.label, i.enabled,
             i.base_config, i.widget_config,
             r.manifest
      FROM widget_instances i
      LEFT JOIN widget_registry r ON r.id = i.widget_id
      ORDER BY i.created_at ASC
    `;
    return Response.json({ instances: rows });
  } catch (err) {
    console.error("GET /api/widgets/instances error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { widget_id, label } = body;
    if (!widget_id) {
      return Response.json({ error: "widget_id required" }, { status: 400 });
    }

    const reg =
      await sql`SELECT manifest FROM widget_registry WHERE id = ${widget_id}`;
    if (reg.length === 0) {
      return Response.json(
        { error: "Widget not in registry" },
        { status: 404 },
      );
    }
    const manifest = reg[0].manifest;
    const defaultSize = manifest.defaultSize || { width: 280, height: 100 };

    const widgetConfig = {};
    for (const field of manifest.configSchema || []) {
      widgetConfig[field.key] = field.default;
    }

    const baseConfig = {
      x: 60,
      y: 60,
      width: defaultSize.width,
      height: defaultSize.height,
      zIndex: 10,
      opacity: 1,
      activeFrom: "00:00",
      activeTo: "23:59",
    };

    const id = `inst_${widget_id}_${Date.now()}`;
    const instanceLabel = label || manifest.name;

    await sql`
      INSERT INTO widget_instances (id, widget_id, label, enabled, base_config, widget_config)
      VALUES (${id}, ${widget_id}, ${instanceLabel}, true,
              ${JSON.stringify(baseConfig)}::jsonb,
              ${JSON.stringify(widgetConfig)}::jsonb)
    `;
    return Response.json({ id, ok: true });
  } catch (err) {
    console.error("POST /api/widgets/instances error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
