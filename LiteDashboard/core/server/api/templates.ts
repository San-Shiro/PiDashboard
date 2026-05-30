import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Router, json, error } from '../router';
import { pushReload } from '../ws/display';

const CANVASES_DIR = join(process.cwd(), 'canvases');

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function listCanvases(): any[] {
  if (!existsSync(CANVASES_DIR)) return [];
  const files = readdirSync(CANVASES_DIR).filter(f => f.endsWith('.json') && f !== 'active.json');
  const canvases: any[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(join(CANVASES_DIR, file), 'utf8');
      const data = JSON.parse(content);
      data.id = data.id || file.replace('.json', '');
      canvases.push(data);
    } catch { /* skip broken files */ }
  }
  return canvases;
}

export function registerTemplateRoutes(router: Router) {
  // GET /api/canvases — list all (backward compat alias)
  router.get('/api/canvases', () => {
    const items = listCanvases();
    return json({ canvases: items, templates: items });
  });

  // GET /api/templates — list all
  router.get('/api/templates', () => {
    const items = listCanvases();
    return json({ templates: items });
  });

  // POST /api/templates — create new canvas
  router.post('/api/templates', async (req) => {
    const body = await req.json() as any;
    if (!body.name) return error('Name is required', 400);

    const id = `${slugify(body.name)}-${Date.now()}`;
    const now = new Date().toISOString();
    const scaffold = {
      id,
      name: body.name,
      description: body.description || '',
      canvas_config: body.canvas_config || { width: 1920, height: 1080, background: '#0a0a0a' },
      widgets: [],
      widget_count: 0,
      created_at: now,
      updated_at: now,
      is_active: false,
    };

    writeFileSync(join(CANVASES_DIR, `${id}.json`), JSON.stringify(scaffold, null, 2), 'utf8');
    return json(scaffold);
  });

  // GET /api/templates/:id — get single canvas
  router.get('/api/templates/:id', (req, params) => {
    const filePath = join(CANVASES_DIR, `${params.id}.json`);
    if (!existsSync(filePath)) return error('Canvas not found', 404);

    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    data.id = data.id || params.id;
    return json(data);
  });

  // PUT /api/templates/:id — save canvas with widgets
  router.put('/api/templates/:id', async (req, params) => {
    const filePath = join(CANVASES_DIR, `${params.id}.json`);
    const body = await req.json() as any;

    body.id = params.id;
    body.updated_at = new Date().toISOString();
    writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf8');

    return json({ success: true });
  });

  // DELETE /api/templates/:id — delete canvas
  router.delete('/api/templates/:id', (req, params) => {
    const filePath = join(CANVASES_DIR, `${params.id}.json`);
    if (!existsSync(filePath)) return error('Canvas not found', 404);

    unlinkSync(filePath);
    return json({ success: true });
  });

  // POST /api/templates/:id/apply — make canvas active and reload kiosk display
  router.post('/api/templates/:id/apply', (req, params) => {
    const filePath = join(CANVASES_DIR, `${params.id}.json`);
    if (!existsSync(filePath)) return error('Canvas not found', 404);

    const canvasData = JSON.parse(readFileSync(filePath, 'utf8'));

    // Mark all canvases as inactive, then mark this one active
    const allFiles = readdirSync(CANVASES_DIR).filter(f => f.endsWith('.json') && f !== 'active.json');
    for (const f of allFiles) {
      try {
        const fp = join(CANVASES_DIR, f);
        const d = JSON.parse(readFileSync(fp, 'utf8'));
        if (d.is_active) {
          d.is_active = false;
          writeFileSync(fp, JSON.stringify(d, null, 2), 'utf8');
        }
      } catch { /* skip */ }
    }

    canvasData.is_active = true;
    canvasData.id = params.id;
    writeFileSync(filePath, JSON.stringify(canvasData, null, 2), 'utf8');

    // Write active.json for the compositor
    writeFileSync(join(CANVASES_DIR, 'active.json'), JSON.stringify(canvasData, null, 2), 'utf8');

    // Trigger kiosk display reload
    pushReload();

    return json({ success: true });
  });
}
