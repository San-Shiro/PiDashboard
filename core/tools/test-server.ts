import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { validateCanvas } from '../engine/validators/canvas-validator';
import { composeHTML } from '../engine/compositor';
import { CanvasConfig, WidgetManifest } from '../engine/schema';
import { websocketHandler } from '../server/ws/display';
import { stateStore } from '../server/state/state-store';

const PORT = 3000;
const canvasPath = join(process.cwd(), 'canvases', 'hd_preview.json');

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\\n[Server] Shutting down, saving states...');
  stateStore.flushAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('\\n[Server] Shutting down, saving states...');
  stateStore.flushAll();
  process.exit(0);
});

function generateCanvasHTML() {
  const content = readFileSync(canvasPath, 'utf8');
  const rawCanvas = JSON.parse(content);
  
  const WIDGETS_DIR = join(process.cwd(), 'widgets');
  const registry: any[] = [];
  
  const folders = readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'));
  for (const folder of folders) {
    const manifestPath = join(WIDGETS_DIR, folder, 'manifest.json');
    const manifestStr = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestStr);
    if (!manifest.fragment || !manifest.fragment.file) continue; // Skip incomplete mock widgets
    const fragmentPath = join(WIDGETS_DIR, folder, manifest.fragment.file);
    const fragmentHTML = readFileSync(fragmentPath, 'utf8');
    registry.push({ id: manifest.id, manifest, fragmentHTML });
  }

  const result = validateCanvas(rawCanvas, registry.map(r => r.id));
  if (!result.valid) throw new Error("Invalid canvas");
  const canvas = result.sanitized as CanvasConfig;

  // Register persistable states based on canvas layout
  for (const item of canvas.widgets || []) {
    const manifest = registry.find(r => r.id === item.widget_id)?.manifest;
    if (manifest?.persist) {
      const key = manifest.stateMode === 'instance' ? `${item.widget_id}:${item.id}` : item.widget_id;
      stateStore.registerPersistable(key);
    }
  }
  
  stateStore.hydrate();

  return composeHTML(canvas, registry);
}

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/ws/display' || url.pathname === '/ws/daemon') {
      const success = server.upgrade(req);
      if (success) return undefined;
      return new Response("Upgrade Failed", { status: 400 });
    }
    
    if (url.pathname === '/') {
      try {
        const html = generateCanvasHTML();
        return new Response(html, { 
          headers: { 
            "Content-Type": "text/html",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Surrogate-Control": "no-store"
          } 
        });
      } catch (e: any) {
        return new Response(e.message, { status: 500 });
      }
    }
    
    // Serve SDK statically
    if (url.pathname.startsWith('/media/libs/')) {
      const p = join(process.cwd(), 'core', 'sdk', url.pathname.replace('/media/libs/', ''));
      return new Response(Bun.file(p));
    }
    
    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) { websocketHandler.open(ws as any); },
    message(ws, msg) { websocketHandler.message(ws as any, msg as any); },
    close(ws) { websocketHandler.close(ws as any); }
  }
});
console.log('Test Server listening on http://localhost:' + PORT);
