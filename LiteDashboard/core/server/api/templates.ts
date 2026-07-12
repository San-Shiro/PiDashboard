import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Router, json, error } from '../router';
import { pushReload } from '../ws/display';
import { daemonManager } from '../daemon/daemon-manager';

const CANVASES_DIR = join(process.cwd(), 'canvases');

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function loadAllCanvases(): { list: any[]; idToFile: Map<string, string> } {
  const list: any[] = [];
  const idToFile = new Map<string, string>();
  if (!existsSync(CANVASES_DIR)) return { list, idToFile };

  const files = readdirSync(CANVASES_DIR).filter(f => f.endsWith('.json') && f !== 'active.json');
  for (const file of files) {
    try {
      const content = readFileSync(join(CANVASES_DIR, file), 'utf8');
      const data = JSON.parse(content);
      const id = data.id || file.replace('.json', '');
      data.id = id;
      list.push(data);
      idToFile.set(id, file);
    } catch { /* skip broken files */ }
  }
  return { list, idToFile };
}

/** Find the actual filename for a canvas ID */
function resolveCanvasFile(id: string): string | null {
  const direct = join(CANVASES_DIR, `${id}.json`);
  if (existsSync(direct)) return `${id}.json`;

  const { idToFile } = loadAllCanvases();
  return idToFile.get(id) || null;
}

function activateCanvasById(id: string): { ok: boolean; data?: any; filename?: string } {
  const filename = resolveCanvasFile(id);
  if (!filename) return { ok: false };

  const activePath = join(CANVASES_DIR, filename);
  const canvasData = JSON.parse(readFileSync(activePath, 'utf8'));

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
  canvasData.id = id;
  writeFileSync(activePath, JSON.stringify(canvasData, null, 2), 'utf8');
  writeFileSync(join(CANVASES_DIR, 'active.json'), JSON.stringify(canvasData, null, 2), 'utf8');
  daemonManager.reconcile(canvasData);

  pushReload();
  return { ok: true, data: canvasData, filename };
}

export function registerTemplateRoutes(router: Router) {
  // GET /api/canvases — list all (backward compat alias)
  router.get('/api/canvases', () => {
    const { list } = loadAllCanvases();
    return json({ canvases: list, templates: list });
  });

  // GET /api/templates — list all
  router.get('/api/templates', () => {
    const { list } = loadAllCanvases();
    return json({ templates: list });
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
    const filename = resolveCanvasFile(params.id);
    if (!filename) return error('Canvas not found', 404);

    const data = JSON.parse(readFileSync(join(CANVASES_DIR, filename), 'utf8'));
    data.id = data.id || params.id;
    return json(data);
  });

  // PUT /api/templates/:id — save canvas with widgets
  router.put('/api/templates/:id', async (req, params) => {
    const filename = resolveCanvasFile(params.id);
    const targetFile = filename ? join(CANVASES_DIR, filename) : join(CANVASES_DIR, `${params.id}.json`);
    const body = await req.json() as any;

    body.id = params.id;
    body.updated_at = new Date().toISOString();
    writeFileSync(targetFile, JSON.stringify(body, null, 2), 'utf8');

    return json({ success: true });
  });

  // DELETE /api/templates/:id — delete canvas
  router.delete('/api/templates/:id', (req, params) => {
    const filename = resolveCanvasFile(params.id);
    if (!filename) return error('Canvas not found', 404);

    unlinkSync(join(CANVASES_DIR, filename));
    return json({ success: true });
  });

  // POST /api/templates/:id/apply — make canvas active and reload kiosk display
  router.post('/api/templates/:id/apply', (req, params) => {
    const activated = activateCanvasById(params.id);
    if (!activated.ok) return error('Canvas not found', 404);
    return json({ success: true });
  });

  // POST /api/templates/:id/publish — save draft changes are expected to already be persisted,
  // then mark this canvas active and reload kiosk display.
  router.post('/api/templates/:id/publish', (req, params) => {
    const activated = activateCanvasById(params.id);
    if (!activated.ok) return error('Canvas not found', 404);
    return json({ success: true });
  });
}
