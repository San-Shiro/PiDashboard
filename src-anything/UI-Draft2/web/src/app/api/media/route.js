import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const files = await sql`
      SELECT id, filename, url, mime_type, size_bytes, uploaded_at
      FROM media_files
      ORDER BY uploaded_at DESC
    `;

    // Compute usage: scan widget_instances configs for matches
    const instances = await sql`
      SELECT id, widget_id, label, enabled, widget_config
      FROM widget_instances
    `;
    const templates =
      await sql`SELECT id, name, snapshot, is_active FROM layout_templates`;

    const usageByUrl = new Map();
    for (const f of files)
      usageByUrl.set(f.url, { activeUses: [], inactiveTemplateUses: [] });

    for (const inst of instances) {
      const cfg = inst.widget_config || {};
      for (const v of Object.values(cfg)) {
        if (typeof v === "string" && usageByUrl.has(v)) {
          usageByUrl.get(v).activeUses.push({
            type: "instance",
            instance_id: inst.id,
            widget_id: inst.widget_id,
            label: inst.label,
            enabled: inst.enabled,
          });
        }
      }
    }

    for (const tpl of templates) {
      const snap = tpl.snapshot || {};
      const tplInstances = snap.instances || [];
      for (const ti of tplInstances) {
        const cfg = ti.widget_config || {};
        for (const v of Object.values(cfg)) {
          if (typeof v === "string" && usageByUrl.has(v)) {
            usageByUrl.get(v).inactiveTemplateUses.push({
              type: "template",
              template_id: tpl.id,
              template_name: tpl.name,
              is_active: tpl.is_active,
            });
          }
        }
      }
    }

    const enriched = files.map((f) => ({
      ...f,
      usage: usageByUrl.get(f.url) || {
        activeUses: [],
        inactiveTemplateUses: [],
      },
    }));

    return Response.json({ files: enriched });
  } catch (err) {
    console.error("GET /api/media error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { filename, url, mime_type, size_bytes } = body;
    if (!filename || !url) {
      return Response.json(
        { error: "filename and url required" },
        { status: 400 },
      );
    }
    const rows = await sql`
      INSERT INTO media_files (filename, url, mime_type, size_bytes)
      VALUES (${filename}, ${url}, ${mime_type || null}, ${size_bytes || null})
      RETURNING id, filename, url, mime_type, size_bytes, uploaded_at
    `;
    return Response.json(rows[0]);
  } catch (err) {
    console.error("POST /api/media error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
