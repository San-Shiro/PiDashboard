import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const tokenMatch = cookie.match(/admin_token=([^;]+)/);
    if (tokenMatch) {
      await sql`DELETE FROM admin_sessions WHERE token = ${tokenMatch[1]}`;
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "admin_token=; Path=/; HttpOnly; Max-Age=0",
      },
    });
  } catch (err) {
    console.error("POST /api/auth/logout error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
