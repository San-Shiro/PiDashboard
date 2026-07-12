import sql from "@/app/api/utils/sql";

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await sql`DELETE FROM layout_templates WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/templates/[id] error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
