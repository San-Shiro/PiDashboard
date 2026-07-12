import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const rows =
      await sql`SELECT id, name, is_builtin, is_active, config FROM themes ORDER BY is_builtin DESC, name ASC`;
    return Response.json({ themes: rows });
  } catch (err) {
    console.error("GET /api/themes:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, config } = await request.json();
    if (!name || !config)
      return Response.json(
        { error: "name and config required" },
        { status: 400 },
      );
    const id = `custom_${Date.now()}`;
    await sql`
      INSERT INTO themes (id, name, is_builtin, is_active, config)
      VALUES (${id}, ${name}, false, false, ${JSON.stringify(config)}::jsonb)
    `;
    return Response.json({ ok: true, id });
  } catch (err) {
    console.error("POST /api/themes:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
