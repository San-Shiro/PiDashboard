// Mock service restart action. In production the Bun server runs `systemctl restart <name>`.
export async function POST(request) {
  try {
    const { name } = await request.json();
    if (!name)
      return Response.json({ error: "name required" }, { status: 400 });
    return Response.json({
      ok: true,
      message: `Service ${name} restart command sent`,
    });
  } catch (err) {
    console.error("POST /api/system/services/restart error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
