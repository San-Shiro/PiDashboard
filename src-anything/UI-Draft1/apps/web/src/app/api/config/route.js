import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const rows =
      await sql`SELECT config FROM dashboard_config ORDER BY id LIMIT 1`;
    if (rows.length === 0) {
      return Response.json({
        canvas: { width: 1280, height: 720, background: "#0a0a0a" },
        widgets: [],
      });
    }
    return Response.json(rows[0].config);
  } catch (err) {
    console.error("GET /api/config error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function POST(request) {
  try {
    const config = await request.json();
    const configStr = JSON.stringify(config);

    const existing =
      await sql`SELECT id FROM dashboard_config ORDER BY id LIMIT 1`;
    if (existing.length === 0) {
      await sql`INSERT INTO dashboard_config (config) VALUES (${configStr}::jsonb)`;
    } else {
      await sql`
        UPDATE dashboard_config
        SET config = ${configStr}::jsonb, updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/config error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
