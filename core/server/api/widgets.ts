import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, resolve, sep } from 'path';
import { Router, json, error } from '../router';
import { stateStore } from '../state/state-store';
import { daemonManager } from '../daemon/daemon-manager';
import { registerInstalled } from '../provenance';
import { validateWidget } from '../../engine/validators/widget-validator';

const SAFE_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_DAEMON_SEGMENT_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const SAFE_DEP_RE = /^[A-Za-z0-9._+-]{1,64}$/;

/**
 * Gate the daemon half of an installed package.
 *
 * daemon-manager spawns `runtime.command` with `shell: true`, so an installed
 * widget's daemon.json is a direct code-execution surface that validateWidget
 * (which only inspects the manifest and HTML fragment) never looked at.
 * Returns an error string, or null when acceptable.
 */
function inspectDaemonPackage(dir: string): string | null {
  const daemonJson = join(dir, 'daemon', 'daemon.json');
  if (!existsSync(daemonJson)) return null;

  let d: any;
  try { d = JSON.parse(readFileSync(daemonJson, 'utf8')); } catch { return 'daemon/daemon.json is not valid JSON'; }

  const cmd = d?.runtime?.command;
  if (cmd !== undefined) {
    if (typeof cmd !== 'string' || !cmd.trim()) return 'daemon runtime.command must be a non-empty string';
    // The command runs through a shell — refuse operators that would let a
    // package chain arbitrary commands, and refuse escaping its own directory.
    if (/[;&|`$(){}<>\n\r]|\|\||&&/.test(cmd)) return 'daemon runtime.command contains shell metacharacters';
    if (cmd.includes('..')) return 'daemon runtime.command must not traverse directories';
  }

  const cwd = d?.runtime?.cwd;
  if (cwd !== undefined && (typeof cwd !== 'string' || cwd.includes('..') || cwd.startsWith('/'))) {
    return 'daemon runtime.cwd must be a relative path inside the widget';
  }

  if (d?.communication?.ipcFilename !== undefined) {
    const f = String(d.communication.ipcFilename).replace(/\.json$/, '');
    if (!SAFE_DAEMON_SEGMENT_RE.test(f)) return 'daemon communication.ipcFilename is not a safe filename';
  }

  // Dependency names are passed to a shell lookup at startup.
  for (const key of ['system', 'python', 'npm']) {
    const list = d?.dependencies?.[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return `daemon dependencies.${key} must be an array`;
    for (const item of list) {
      if (typeof item !== 'string' || !SAFE_DEP_RE.test(item)) {
        return `daemon dependencies.${key} contains an unsafe entry`;
      }
    }
  }

  return null;
}

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

      // Extract -> validate in tmp -> only then swap. Validating after
      // overwriting meant a deliberately-invalid package named e.g. "clock"
      // permanently destroyed the installed widget of that name.
      try {
        zip.extractAllTo(tmpDir, true);
        const sourceFolder = rootPrefix ? join(tmpDir, rootPrefix) : tmpDir;

        const validation = validateWidget(sourceFolder);
        if (!validation.valid) {
          return error(`Widget validation failed: ${validation.errors.join(', ')}`, 400);
        }

        const daemonIssue = inspectDaemonPackage(sourceFolder);
        if (daemonIssue) return error(`Widget rejected: ${daemonIssue}`, 400);

        if (existsSync(widgetFolder)) rmSync(widgetFolder, { recursive: true, force: true });
        cpSync(sourceFolder, widgetFolder, { recursive: true });
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
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
