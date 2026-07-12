import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, manifest, version, enabled, installed_at
      FROM widget_registry
      ORDER BY (manifest->>'name') ASC
    `;
    return Response.json({ widgets: rows });
  } catch (err) {
    console.error("GET /api/widgets/registry error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
