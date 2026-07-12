import sql from "@/app/api/utils/sql";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const rows =
      await sql`SELECT snapshot FROM layout_templates WHERE id = ${id}`;
    if (rows.length === 0)
      return Response.json({ error: "Not found" }, { status: 404 });

    const snapshot = rows[0].snapshot;
    const instances = snapshot.instances || [];

    await sql.transaction([
      sql`DELETE FROM widget_instances`,
      sql`UPDATE layout_templates SET is_active = false`,
      sql`UPDATE layout_templates SET is_active = true WHERE id = ${id}`,
    ]);

    for (const inst of instances) {
      await sql`
        INSERT INTO widget_instances (id, widget_id, label, enabled, base_config, widget_config)
        VALUES (${inst.id}, ${inst.widget_id}, ${inst.label}, ${inst.enabled},
                ${JSON.stringify(inst.base_config)}::jsonb,
                ${JSON.stringify(inst.widget_config)}::jsonb)
      `;
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/templates/[id]/apply error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
