import sql from "@/app/api/utils/sql";
import argon2 from "argon2";

function randomToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request) {
  try {
    const { password } = await request.json();
    const rows = await sql`SELECT password_hash FROM admin_auth WHERE id = 1`;
    if (rows.length === 0 || !rows[0].password_hash) {
      return Response.json({ error: "Auth not configured" }, { status: 400 });
    }

    const ok = await argon2.verify(rows[0].password_hash, password || "");
    if (!ok)
      return Response.json({ error: "Invalid password" }, { status: 401 });

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await sql`INSERT INTO admin_sessions (token, expires_at) VALUES (${token}, ${expiresAt})`;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
