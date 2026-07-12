import sql from "@/app/api/utils/sql";

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { label, enabled, base_config, widget_config } = body;

    const sets = [];
    const values = [];
    let idx = 1;

    if (label !== undefined) {
      sets.push(`label = $${idx++}`);
      values.push(label);
    }
    if (enabled !== undefined) {
      sets.push(`enabled = $${idx++}`);
      values.push(enabled);
    }
    if (base_config !== undefined) {
      sets.push(`base_config = $${idx++}::jsonb`);
      values.push(JSON.stringify(base_config));
    }
    if (widget_config !== undefined) {
      sets.push(`widget_config = $${idx++}::jsonb`);
      values.push(JSON.stringify(widget_config));
    }
    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) {
      return Response.json({ ok: true });
    }

    values.push(id);
    const query = `UPDATE widget_instances SET ${sets.join(", ")} WHERE id = $${idx}`;
    await sql(query, values);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/widgets/instances/[id] error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await sql`DELETE FROM widget_instances WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/widgets/instances/[id] error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
