import sql from "@/app/api/utils/sql";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    await sql.transaction([
      sql`UPDATE themes SET is_active = false`,
      sql`UPDATE themes SET is_active = true WHERE id = ${id}`,
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/themes/[id]/activate:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
