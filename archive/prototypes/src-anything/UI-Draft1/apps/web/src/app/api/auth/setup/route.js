import sql from "@/app/api/utils/sql";
import argon2 from "argon2";

export async function POST(request) {
  try {
    const { password } = await request.json();
    if (!password || password.length < 4) {
      return Response.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 },
      );
    }

    const hash = await argon2.hash(password);

    const existing = await sql`SELECT id FROM admin_auth WHERE id = 1`;
    if (existing.length === 0) {
      await sql`INSERT INTO admin_auth (id, password_hash) VALUES (1, ${hash})`;
    } else {
      await sql`UPDATE admin_auth SET password_hash = ${hash}, updated_at = NOW() WHERE id = 1`;
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/setup error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
