import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { validateCanvas } from '../engine/validators/canvas-validator';
import { composeHTML } from '../engine/compositor';
import { CanvasConfig } from '../engine/schema';
import { websocketHandler } from '../server/ws/display';
import { stateStore } from '../server/state/state-store';
import { startIpcWatcher } from '../server/ipc/tmpfs-watcher';
import { Router, json, error } from '../server/router';
import { registerAuthRoutes } from '../server/api/auth';
import { registerTemplateRoutes } from '../server/api/templates';
import { registerWidgetRoutes } from '../server/api/widgets';
import { registerSystemRoutes } from '../server/api/system';
import { registerMediaRoutes } from '../server/api/media';
import { registerGpioRoutes } from '../server/api/gpio';
import { requireAuth } from '../server/middleware/auth-gate';
import { hijackConsole } from '../server/logger';

hijackConsole();

const PORT = parseInt(process.env.PORT || '3000');
const ROOT = process.cwd();
const ADMIN_DIST = join(ROOT, 'admin', 'dist');
const MEDIA_DIR = join(ROOT, 'media');
const SDK_DIR = join(ROOT, 'core', 'sdk');
import { daemonManager } from '../server/daemon/daemon-manager';

// ── MIME types for static serving ──────────────────────────────────────────────
const MIME: Record<string, string> = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};

function getMime(filepath: string): string {
  return MIME[extname(filepath).toLowerCase()] || 'application/octet-stream';
}

// ── Shutdown handlers ──────────────────────────────────────────────────────────
process.on('SIGINT', () => { console.log('\n[Server] Shutting down...'); daemonManager.shutdownAll(); stateStore.flushAll(); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n[Server] Shutting down...'); daemonManager.shutdownAll(); stateStore.flushAll(); process.exit(0); });

// ── Widget registry (shared across routes) ─────────────────────────────────────
export function loadWidgetRegistry() {
  const WIDGETS_DIR = join(ROOT, 'widgets');
  const registry: any[] = [];
  if (!existsSync(WIDGETS_DIR)) return registry;

  const folders = readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'));
  for (const folder of folders) {
    const manifestPath = join(WIDGETS_DIR, folder, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (!manifest.fragment) continue;
      
      // Security: enforce trust level based on manifest or default to core
      if (!manifest.trust) manifest.trust = 'core';
      
      // Load fragment HTML (single-file or multi-file)
      let fragmentHTML = '';
      if (manifest.fragment.file) {
        const fragPath = join(WIDGETS_DIR, folder, manifest.fragment.file);
        if (existsSync(fragPath)) fragmentHTML = readFileSync(fragPath, 'utf8');
      } else if (manifest.fragment.template) {
        const parts: string[] = [];
        if (manifest.fragment.style) {
          const stylePath = join(WIDGETS_DIR, folder, manifest.fragment.style);
          if (existsSync(stylePath)) parts.push(`<style>${readFileSync(stylePath, 'utf8')}</style>`);
        }
        const tplPath = join(WIDGETS_DIR, folder, manifest.fragment.template);
        if (existsSync(tplPath)) parts.push(readFileSync(tplPath, 'utf8'));
        if (manifest.fragment.script) {
          const scriptPath = join(WIDGETS_DIR, folder, manifest.fragment.script);
          if (existsSync(scriptPath)) parts.push(`<script>${readFileSync(scriptPath, 'utf8')}</script>`);
        }
        fragmentHTML = parts.join('\n');
      }

      registry.push({ id: manifest.id, manifest, fragmentHTML });
    } catch (e) {
      console.warn(`[Registry] Skipping widget ${folder}:`, e);
    }
  }
  return registry;
}

// ── Compositor: generate kiosk display HTML ────────────────────────────────────
export function generateCanvasHTML(canvasFile?: string) {
  const canvasPath = canvasFile
    ? join(ROOT, 'canvases', canvasFile)
    : join(ROOT, 'canvases', 'active.json');

  // Fallback to hd_preview.json if active.json doesn't exist
  const finalPath = existsSync(canvasPath) ? canvasPath : join(ROOT, 'canvases', 'hd_preview.json');
  const rawCanvas = JSON.parse(readFileSync(finalPath, 'utf8'));

  // Normalize: admin panel saves as 'canvas_config', compositor expects 'canvas'
  if (rawCanvas.canvas_config && !rawCanvas.canvas) {
    rawCanvas.canvas = rawCanvas.canvas_config;
    delete rawCanvas.canvas_config;
  }

  const registry = loadWidgetRegistry();
  const result = validateCanvas(rawCanvas, registry.map(r => r.id));
  if (!result.valid) {
    console.error('[Compositor] Validation errors:', result.errors);
    throw new Error(`Invalid canvas: ${result.errors.join(', ')}`);
  }
  const canvas = result.sanitized as CanvasConfig;

  // Register persistable states
  for (const item of canvas.widgets || []) {
    const manifest = registry.find(r => r.id === item.widget_id)?.manifest;
    if (manifest?.persist) {
      const key = manifest.stateMode === 'instance' ? `${item.widget_id}:${item.id}` : item.widget_id;
      stateStore.registerPersistable(key);
    }
  }
  stateStore.hydrate();

  return composeHTML(canvas, registry, stateStore.getAll());
}

// ── Static file server ─────────────────────────────────────────────────────────
function serveStatic(basePath: string, reqPath: string, cacheControl = 'public, max-age=3600'): Response {
  const filePath = join(basePath, reqPath);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(basePath)) return new Response('Forbidden', { status: 403 });
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // SPA fallback: serve index.html for admin routes
    if (basePath === ADMIN_DIST) {
      const indexPath = join(ADMIN_DIST, 'index.html');
      if (existsSync(indexPath)) {
        return new Response(Bun.file(indexPath), {
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' },
        });
      }
    }
    return new Response('Not Found', { status: 404 });
  }

  return new Response(Bun.file(filePath), {
    headers: { 'Content-Type': getMime(filePath), 'Cache-Control': cacheControl },
  });
}

// ── Router setup ───────────────────────────────────────────────────────────────
const router = new Router();

// Kiosk display
router.get('/', (req) => {
  try {
    const html = generateCanvasHTML();
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (e: any) {
    return new Response(`<pre>Compositor Error:\n${e.message}</pre>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
});

// Admin panel static files
router.get('/admin/*', (req, params) => {
  const reqPath = params['*'] || '/index.html';
  return serveStatic(ADMIN_DIST, reqPath === '/' ? '/index.html' : reqPath);
});

// SDK static files
router.get('/media/libs/*', (req, params) => {
  return serveStatic(SDK_DIR, params['*'] || '', 'public, max-age=86400');
});

// Media uploads static files
router.get('/media/*', (req, params) => {
  return serveStatic(join(MEDIA_DIR, 'uploads'), params['*'] || '');
});

// Register API routes
registerAuthRoutes(router);
registerTemplateRoutes(router);
registerWidgetRoutes(router);
registerSystemRoutes(router);
registerMediaRoutes(router);
registerGpioRoutes(router);

// Logging endpoint for widgets and Kiosk
router.post('/api/logs', async (req) => {
  try {
    const body = await req.json();
    const { level, source, message, data } = body;
    const prefix = `[Frontend ${level?.toUpperCase()}] (${source})`;
    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else {
      console.log(prefix, message, data || '');
    }
    return json({ success: true });
  } catch(e: any) {
    return error(e.message, 500);
  }
});

// ── Bun.serve ──────────────────────────────────────────────────────────────────
Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',

  async fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrades
    if (url.pathname === '/ws/display' || url.pathname === '/ws/daemon') {
      const success = server.upgrade(req);
      if (success) return undefined;
      return new Response('WebSocket Upgrade Failed', { status: 400 });
    }

    // Auth gate for /api/* (except auth endpoints and logs)
    if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/') && url.pathname !== '/api/logs') {
      const authResponse = requireAuth(req);
      if (authResponse) return authResponse;
    }

    // Route matching
    const match = router.match(req.method, url.pathname);
    if (match) {
      try {
        return await match.handler(req, match.params);
      } catch (e: any) {
        console.error(`[API Error] ${req.method} ${url.pathname}:`, e);
        return error(e.message || 'Internal Server Error', 500);
      }
    }

    return new Response('Not Found', { status: 404 });
  },

  websocket: {
    open(ws) { websocketHandler.open(ws as any); },
    message(ws, msg) { websocketHandler.message(ws as any, msg as any); },
    close(ws) { websocketHandler.close(ws as any); },
  },
});

console.log(`[PiDashboard] Server running on http://localhost:${PORT}`);
console.log(`[PiDashboard] Kiosk display: http://localhost:${PORT}/`);
console.log(`[PiDashboard] Admin panel:   http://localhost:${PORT}/admin/`);

const activePath = join(ROOT, 'canvases', 'active.json');
if (existsSync(activePath)) {
  try {
    const canvas = JSON.parse(readFileSync(activePath, 'utf8'));
    daemonManager.reconcile(canvas);
  } catch (e) {
    console.error('[PiDashboard] Failed to initialize daemons:', e);
  }
}

// Start watching for daemon IPC file updates
startIpcWatcher(join(ROOT, 'state', 'ipc'));
