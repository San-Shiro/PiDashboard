import sql from "@/app/api/utils/sql";

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const rows = await sql`SELECT url FROM media_files WHERE id = ${id}`;
    if (rows.length === 0)
      return Response.json({ error: "Not found" }, { status: 404 });
    const url = rows[0].url;

    const instances =
      await sql`SELECT widget_config FROM widget_instances WHERE enabled = true`;
    for (const inst of instances) {
      const cfg = inst.widget_config || {};
      for (const v of Object.values(cfg)) {
        if (v === url) {
          return Response.json(
            {
              error:
                "Cannot delete: file is in use by an active widget. Disable the widget or change its source first.",
            },
            { status: 409 },
          );
        }
      }
    }

    await sql`DELETE FROM media_files WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/media/[id] error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
