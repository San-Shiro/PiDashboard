import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { Router, json, error } from '../router';
import { stateStore } from '../state/state-store';

const WIDGETS_DIR = join(process.cwd(), 'widgets');
const ACTIVE_WIDGETS_CONFIG = join(process.cwd(), 'config', 'active-widgets.json');

function getActiveWidgetSet(): Set<string> | null {
  if (!existsSync(ACTIVE_WIDGETS_CONFIG)) return null;
  try {
    const parsed = JSON.parse(readFileSync(ACTIVE_WIDGETS_CONFIG, 'utf8'));
    const ids = Array.isArray(parsed?.activeWidgets) ? parsed.activeWidgets : [];
    const clean = ids.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0);
    return clean.length ? new Set(clean) : null;
  } catch {
    return null;
  }
}

export function registerWidgetRoutes(router: Router) {
  // GET /api/widgets/registry — return all widget manifests
  router.get('/api/widgets/registry', (req) => {
    const widgets: any[] = [];
    const activeWidgets = getActiveWidgetSet();
    if (!existsSync(WIDGETS_DIR)) return json({ widgets });

    const folders = readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'));
    for (const folder of folders) {
      const manifestPath = join(WIDGETS_DIR, folder, 'manifest.json');
      if (!existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (activeWidgets && !activeWidgets.has(manifest.id)) continue;
        widgets.push(manifest);
      } catch { /* skip broken manifests */ }
    }

    return json({ widgets });
  });

  // GET /api/widgets/:id/fragment — return raw HTML fragment of a widget
  router.get('/api/widgets/:id/fragment', (req, params) => {
    const id = params.id;
    if (!id) return error('Widget ID is required', 400);

    const folderPath = join(WIDGETS_DIR, id);
    if (!existsSync(folderPath)) return error(`Widget ${id} not found`, 404);

    const manifestPath = join(folderPath, 'manifest.json');
    if (!existsSync(manifestPath)) return error(`Widget ${id} manifest not found`, 404);

    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      let fragmentHTML = '';
      if (manifest.fragment && manifest.fragment.file) {
        const fragPath = join(folderPath, manifest.fragment.file);
        if (existsSync(fragPath)) fragmentHTML = readFileSync(fragPath, 'utf8');
      } else if (manifest.fragment && manifest.fragment.template) {
        const parts: string[] = [];
        if (manifest.fragment.style) {
          const stylePath = join(folderPath, manifest.fragment.style);
          if (existsSync(stylePath)) parts.push(`<style>${readFileSync(stylePath, 'utf8')}</style>`);
        }
        const tplPath = join(folderPath, manifest.fragment.template);
        if (existsSync(tplPath)) parts.push(readFileSync(tplPath, 'utf8'));
        if (manifest.fragment.script) {
          const scriptPath = join(folderPath, manifest.fragment.script);
          if (existsSync(scriptPath)) parts.push(`<script>${readFileSync(scriptPath, 'utf8')}</script>`);
        }
        fragmentHTML = parts.join('\n');
      }

      return new Response(fragmentHTML, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      });
    } catch (e: any) {
      return error(`Failed to load widget fragment: ${e.message}`, 500);
    }
  });

  // GET /api/widget-data/:name — bridge daemon state to admin polling
  router.get('/api/widget-data/:name', (req, params) => {
    const data = stateStore.get(params.name);
    return json(data);
  });

  // GET /weather/search — Open-Meteo geocoding proxy
  router.get('/weather/search', async (req) => {
    const url = new URL(req.url);
    const q = url.searchParams.get('q');
    if (!q) return json({ results: [] });

    try {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);
      if (!geoRes.ok) throw new Error('Geocoding API failed');
      const data = await geoRes.json();
      return json({ results: data.results || [] });
    } catch (e: any) {
      console.error('[Weather] Search error:', e.message);
      return json({ results: [] });
    }
  });
}
