import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const rows = await sql`SELECT password_hash FROM admin_auth WHERE id = 1`;
    const isConfigured = rows.length > 0 && !!rows[0].password_hash;

    const cookie = request.headers.get("cookie") || "";
    const tokenMatch = cookie.match(/admin_token=([^;]+)/);
    let isAuthenticated = false;
    if (tokenMatch && isConfigured) {
      const sessions = await sql`
        SELECT token FROM admin_sessions
        WHERE token = ${tokenMatch[1]} AND expires_at > NOW()
      `;
      isAuthenticated = sessions.length > 0;
    }

    return Response.json({
      isConfigured,
      isAuthenticated: isConfigured ? isAuthenticated : true,
    });
  } catch (err) {
    console.error("GET /api/auth/status error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
