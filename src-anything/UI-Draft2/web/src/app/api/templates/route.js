import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, name, description, is_active, canvas_config, created_at, updated_at, snapshot
      FROM layout_templates
      ORDER BY updated_at DESC
    `;
    const summary = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      is_active: r.is_active,
      canvas_config: r.canvas_config || {
        width: 1280,
        height: 720,
        background: "#0a0a0a",
        displayTarget: "primary",
      },
      created_at: r.created_at,
      updated_at: r.updated_at,
      widget_count: (r.snapshot?.instances || []).length,
    }));
    return Response.json({ templates: summary });
  } catch (err) {
    console.error("GET /api/templates error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, description, canvas_config } = await request.json();
    if (!name)
      return Response.json({ error: "name required" }, { status: 400 });

    const instances =
      await sql`SELECT id, widget_id, label, enabled, base_config, widget_config FROM widget_instances`;
    const snapshot = { instances, savedAt: new Date().toISOString() };

    const mergedCanvas = {
      width: 1280,
      height: 720,
      background: "#0a0a0a",
      displayTarget: "primary",
      pixelRatio: 1,
      ...(canvas_config || {}),
    };

    const existing =
      await sql`SELECT id FROM layout_templates WHERE name = ${name}`;
    if (existing.length > 0) {
      await sql`
        UPDATE layout_templates
        SET snapshot = ${JSON.stringify(snapshot)}::jsonb,
            description = ${description || null},
            canvas_config = ${JSON.stringify(mergedCanvas)}::jsonb,
            updated_at = NOW()
        WHERE name = ${name}
      `;
      return Response.json({ ok: true, id: existing[0].id });
    } else {
      const rows = await sql`
        INSERT INTO layout_templates (name, description, snapshot, canvas_config)
        VALUES (${name}, ${description || null}, ${JSON.stringify(snapshot)}::jsonb, ${JSON.stringify(mergedCanvas)}::jsonb)
        RETURNING id
      `;
      return Response.json({ ok: true, id: rows[0].id });
    }
  } catch (err) {
    console.error("POST /api/templates error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
