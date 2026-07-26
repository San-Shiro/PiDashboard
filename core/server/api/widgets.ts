import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, resolve, sep } from 'path';
import { Router, json, error } from '../router';
import { stateStore } from '../state/state-store';
import { daemonManager } from '../daemon/daemon-manager';
import { registerInstalled } from '../provenance';
import { validateWidget } from '../../engine/validators/widget-validator';

const SAFE_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

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
  // POST /api/widgets/install — extract and install a .wig (zip) package
  router.post('/api/widgets/install', async (req) => {
    try {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file) return error('No file uploaded', 400);

      const arrayBuffer = await (file as File).arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(buffer);

      let manifestEntry = zip.getEntries().find((e: any) => {
        const norm = e.entryName.replace(/\\/g, '/');
        return norm === 'manifest.json' || norm.endsWith('/manifest.json');
      });
      if (!manifestEntry) return error('Invalid .wig package: manifest.json not found', 400);

      const manifestStr = zip.readAsText(manifestEntry);
      const manifest = JSON.parse(manifestStr);
      if (!manifest.id) return error('Invalid manifest: missing id', 400);
      if (!SAFE_ID_RE.test(manifest.id)) return error('Invalid manifest: id must be lowercase alphanumeric with hyphens (a-z0-9-), max 64 chars', 400);

      const widgetFolder = resolve(WIDGETS_DIR, manifest.id);
      if (widgetFolder !== WIDGETS_DIR && !widgetFolder.startsWith(WIDGETS_DIR + sep)) {
        return error('Invalid manifest: id resolves outside widgets directory', 400);
      }
      const normEntryName = manifestEntry.entryName.replace(/\\/g, '/');
      const rootPrefix = normEntryName.includes('/') 
        ? normEntryName.substring(0, normEntryName.lastIndexOf('/') + 1)
        : '';

      const tmpDir = join(process.cwd(), 'state', 'tmp_install_' + Date.now());
      mkdirSync(tmpDir, { recursive: true });
      zip.extractAllTo(tmpDir, true);

      const sourceFolder = rootPrefix ? join(tmpDir, rootPrefix) : tmpDir;
      if (existsSync(widgetFolder)) rmSync(widgetFolder, { recursive: true, force: true });
      cpSync(sourceFolder, widgetFolder, { recursive: true });
      rmSync(tmpDir, { recursive: true, force: true });

      // Validate the installed widget
      const validation = validateWidget(widgetFolder);
      if (!validation.valid) {
        rmSync(widgetFolder, { recursive: true, force: true });
        return error(`Widget validation failed: ${validation.errors.join(', ')}`, 400);
      }

      // Register provenance — installed widgets are capped at community trust
      registerInstalled(manifest.id);

      // Auto-activate the installed widget
      if (existsSync(ACTIVE_WIDGETS_CONFIG)) {
        try {
          const configStr = readFileSync(ACTIVE_WIDGETS_CONFIG, 'utf8');
          const config = JSON.parse(configStr);
          if (Array.isArray(config.activeWidgets) && !config.activeWidgets.includes(manifest.id)) {
            config.activeWidgets.push(manifest.id);
            writeFileSync(ACTIVE_WIDGETS_CONFIG, JSON.stringify(config, null, 2), 'utf8');
          }
        } catch (e) {
          console.warn('[API Warning] Failed to auto-activate widget:', e);
        }
      }

      // Signal reload to kiosk displays
      const { pushReload } = require('../ws/display');
      pushReload();

      return json({ success: true, widgetId: manifest.id });
    } catch (e: any) {
      console.error('[API Error] Install widget failed:', e);
      return error(e.message || 'Install failed', 500);
    }
  });

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
    if (!SAFE_ID_RE.test(id)) return error('Invalid widget ID', 400);

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

  // DELETE /api/widgets/:id — Uninstall a community widget
  router.delete('/api/widgets/:id', (req, params) => {
    const id = params.id;
    if (!id || !id.startsWith('community-')) {
      return error('Only community widgets can be uninstalled', 403);
    }
    if (!SAFE_ID_RE.test(id)) return error('Invalid widget ID', 400);

    const widgetFolder = join(WIDGETS_DIR, id);
    if (!existsSync(widgetFolder)) {
      return error('Widget not found', 404);
    }

    try {
      rmSync(widgetFolder, { recursive: true, force: true });
      
      // Stop daemon and reconcile
      daemonManager.reconcile();
      
      // Signal reload to kiosk displays
      const { pushReload } = require('../ws/display');
      pushReload();
      
      return json({ success: true });
    } catch (e: any) {
      console.error(`[API Error] Failed to uninstall widget ${id}:`, e);
      return error(e.message || 'Uninstall failed', 500);
    }
  });
}
