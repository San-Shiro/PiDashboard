import sql from "@/app/api/utils/sql";

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const rows = await sql`SELECT is_builtin FROM themes WHERE id = ${id}`;
    if (rows.length === 0)
      return Response.json({ error: "Not found" }, { status: 404 });
    if (rows[0].is_builtin)
      return Response.json(
        { error: "Cannot delete built-in themes" },
        { status: 403 },
      );
    await sql`DELETE FROM themes WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/themes/[id]:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
