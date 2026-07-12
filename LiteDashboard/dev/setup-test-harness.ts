import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const widgetsDir = join(process.cwd(), 'widgets');
const canvasesDir = join(process.cwd(), 'canvases');
const toolsDir = join(process.cwd(), 'core', 'tools');
const scriptsDir = join(process.cwd(), 'scripts');
const mediaDir = join(process.cwd(), 'media', 'uploads');

mkdirSync(join(widgetsDir, 'notepad'), { recursive: true });
mkdirSync(join(widgetsDir, 'media'), { recursive: true });
mkdirSync(join(widgetsDir, 'buttons'), { recursive: true });
mkdirSync(join(widgetsDir, 'lottie'), { recursive: true });
mkdirSync(scriptsDir, { recursive: true });
mkdirSync(mediaDir, { recursive: true });

// 1. Notepad Widget (State Testing)
writeFileSync(join(widgetsDir, 'notepad', 'manifest.json'), JSON.stringify({
  id: 'notepad',
  name: 'Interactive Notepad',
  version: '1.0.0',
  author: 'PiDashboard',
  trust: 'verified',
  permissions: { network: false, persistence: true },
  fragment: { file: 'notepad.html', format: 'snippet' },
  configSchema: []
}, null, 2));

writeFileSync(join(widgetsDir, 'notepad', 'notepad.html'), `
<style>
  .notepad-wrap { display: flex; flex-direction: column; height: 100%; background: #fff2cc; border-radius: 8px; padding: 10px; font-family: 'Comic Sans MS', cursive, sans-serif; color: #333; box-shadow: inset 0 0 10px rgba(0,0,0,0.1); }
  .notepad-wrap h4 { margin: 0 0 5px 0; }
  .notepad-wrap textarea { flex: 1; background: transparent; border: none; resize: none; font-family: inherit; font-size: 16px; outline: none; }
</style>
<div class="notepad-wrap">
  <h4>Quick Notes</h4>
  <textarea id="note-input" placeholder="Type something..."></textarea>
</div>
<script>
  window.PiWidget.register(document.currentScript.parentElement, function(ctx) {
    var ta = ctx.root.querySelector('#note-input');
    
    // Load state if exists
    var savedState = window.PiWidget.loadState(ctx.instanceId);
    if (savedState && savedState.text) {
      ta.value = savedState.text;
    }

    ta.addEventListener('blur', function() {
      window.PiWidget.saveState(ctx.instanceId, { text: ta.value });
    });
    
    return {};
  });
</script>
`);

// 2. Media Widget (Image/Video embedded resources)
writeFileSync(join(widgetsDir, 'media', 'manifest.json'), JSON.stringify({
  id: 'media',
  name: 'Media Player',
  version: '1.0.0',
  trust: 'community', // iframe isolation
  permissions: { network: true, disk: false },
  fragment: { file: 'media.html', format: 'snippet' },
  configSchema: []
}, null, 2));

writeFileSync(join(widgetsDir, 'media', 'media.html'), `
<style>
  body { margin: 0; display: flex; flex-direction: column; height: 100vh; color: white; font-family: sans-serif; background: #000; overflow: hidden; }
  .media-container { flex: 1; position: relative; }
  img, video { position: absolute; width: 100%; height: 100%; object-fit: cover; }
  video { z-index: 1; opacity: 0.8; }
  h3 { position: absolute; z-index: 10; bottom: 10px; left: 10px; text-shadow: 2px 2px 4px black; }
</style>
<div class="media-container">
  <!-- Use a public sample video -->
  <video autoplay loop muted playsinline src="https://www.w3schools.com/html/mov_bbb.mp4"></video>
  <h3>Media Player Test</h3>
</div>
`);

// 3. Buttons Widget (CSS Animations)
writeFileSync(join(widgetsDir, 'buttons', 'manifest.json'), JSON.stringify({
  id: 'buttons',
  name: 'Animated Buttons',
  version: '1.0.0',
  trust: 'verified',
  permissions: { network: false, disk: false },
  fragment: { file: 'buttons.html', format: 'snippet' },
  configSchema: []
}, null, 2));

writeFileSync(join(widgetsDir, 'buttons', 'buttons.html'), `
<style>
  .btn-container { display: flex; gap: 20px; align-items: center; justify-content: center; height: 100%; background: rgba(255,255,255,0.05); border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); padding: 20px; }
  .btn-dynamic { 
    padding: 15px 30px; 
    border-radius: 50px; 
    border: none; 
    font-size: 16px; 
    font-weight: bold; 
    color: white; 
    cursor: pointer;
    background: linear-gradient(45deg, #ff007f, #7f00ff);
    box-shadow: 0 4px 15px rgba(127,0,255,0.4);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  }
  .btn-dynamic:hover {
    transform: translateY(-5px) scale(1.05);
    box-shadow: 0 10px 25px rgba(255,0,127,0.6);
  }
  .btn-dynamic:active {
    transform: translateY(2px) scale(0.95);
  }
  .btn-pulse {
    background: linear-gradient(45deg, #00f2fe, #4facfe);
    box-shadow: 0 0 0 0 rgba(79,172,254, 0.7);
    animation: pulse-ring 2s infinite cubic-bezier(0.66, 0, 0, 1);
  }
  @keyframes pulse-ring {
    to { box-shadow: 0 0 0 20px rgba(79,172,254, 0); }
  }
</style>
<div class="btn-container">
  <button class="btn-dynamic">Hover Me</button>
  <button class="btn-dynamic btn-pulse">Pulsing</button>
</div>
<script>
  window.PiWidget.register(document.currentScript.parentElement, function() { return {}; });
</script>
`);

// 4. Lottie Widget (External Scripts)
writeFileSync(join(widgetsDir, 'lottie', 'manifest.json'), JSON.stringify({
  id: 'lottie',
  name: 'Lottie Animation',
  version: '1.0.0',
  trust: 'community', // External scripts requires iframe
  permissions: { network: true, disk: false },
  fragment: { file: 'lottie.html', format: 'snippet' },
  configSchema: []
}, null, 2));

writeFileSync(join(widgetsDir, 'lottie', 'lottie.html'), `
<style>
  body { display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1a1a1a; border-radius: 12px; }
  #lottie-container { width: 100%; height: 100%; max-width: 300px; max-height: 300px; }
</style>
<!-- Load Lottie from CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
<div id="lottie-container"></div>
<script>
  window.onload = function() {
    lottie.loadAnimation({
      container: document.getElementById('lottie-container'),
      renderer: 'svg',
      loop: true,
      autoplay: true,
      // Sample Lottie JSON from public URL
      path: 'https://assets2.lottiefiles.com/packages/lf20_q5pk6p1k.json' 
    });
  };
</script>
`);

// 5. Update Canvas Config
writeFileSync(join(canvasesDir, 'hd_preview.json'), JSON.stringify({
  id: 'hd-test',
  schemaVersion: 2,
  canvas: { width: 1920, height: 1080, background: '#0d1117', fps: 60 },
  widgets: [
    { id: 'clock_1', widget_id: 'clock', enabled: true, layout: { x: 50, y: 50, width: 350, height: 120, zIndex: 10, opacity: 1 }, config: { showSeconds: true } },
    { id: 'sysinfo_1', widget_id: 'sysinfo', enabled: true, layout: { x: 50, y: 200, width: 350, height: 300, zIndex: 5, opacity: 0.9, borderRadius: 12 }, config: {} },
    { id: 'notepad_1', widget_id: 'notepad', enabled: true, layout: { x: 50, y: 550, width: 350, height: 300, zIndex: 6, opacity: 1 }, config: {} },
    { id: 'media_1', widget_id: 'media', enabled: true, layout: { x: 450, y: 50, width: 1000, height: 562, zIndex: 2, opacity: 1, borderRadius: 16, overflow: 'hidden' }, config: {} },
    { id: 'buttons_1', widget_id: 'buttons', enabled: true, layout: { x: 450, y: 650, width: 500, height: 150, zIndex: 8, opacity: 1 }, config: {} },
    { id: 'lottie_1', widget_id: 'lottie', enabled: true, layout: { x: 1000, y: 650, width: 450, height: 300, zIndex: 7, opacity: 1, borderRadius: 16, overflow: 'hidden' }, config: {} }
  ]
}, null, 2));

// 6. Test Server Script
writeFileSync(join(toolsDir, 'test-server.ts'), `
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { validateCanvas } from '../engine/validators/canvas-validator';
import { composeHTML } from '../engine/compositor';
import { CanvasConfig, WidgetManifest } from '../engine/schema';
import { initIpcDir, startIpcWatcher } from '../server/ipc/tmpfs-watcher';
import { handleConnection, pushData } from '../server/ws/display';

const PORT = 3000;
const canvasPath = join(process.cwd(), 'canvases', 'hd_preview.json');

// Initialize IPC 
initIpcDir();
startIpcWatcher((widgetId, data) => {
  pushData(widgetId, data);
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
    const fragmentPath = join(WIDGETS_DIR, folder, manifest.fragment.file);
    const fragmentHTML = readFileSync(fragmentPath, 'utf8');
    registry.push({ id: manifest.id, manifest, fragmentHTML });
  }

  const result = validateCanvas(rawCanvas, registry.map(r => r.id));
  if (!result.valid) throw new Error("Invalid canvas");
  return composeHTML(result.sanitized as CanvasConfig, registry);
}

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/ws/display') {
      const success = server.upgrade(req);
      if (success) return undefined;
      return new Response("Upgrade Failed", { status: 400 });
    }
    
    if (url.pathname === '/') {
      try {
        const html = generateCanvasHTML();
        return new Response(html, { headers: { "Content-Type": "text/html" } });
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
    open(ws) { handleConnection(ws as any); },
    message(ws, msg) {},
    close(ws) {}
  }
});
console.log('Test Server listening on http://localhost:' + PORT);
`);

// 7. WSL Bash Daemon
writeFileSync(join(scriptsDir, 'wsl-sysinfo.sh'), `#!/bin/bash
WIDGET_DIR="\${IPC_DIR:-/tmp/widgets}"
mkdir -p "$WIDGET_DIR"

echo "Starting WSL sysinfo daemon. Writing to $WIDGET_DIR/sysinfo.json..."

while true; do
  # Very rough CPU extraction in WSL
  CPU=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}')
  
  # RAM extraction
  RAM_TOTAL=$(free | grep Mem | awk '{print $2}')
  RAM_USED=$(free | grep Mem | awk '{print $3}')
  RAM_PCT=$(echo "scale=2; $RAM_USED / $RAM_TOTAL * 100" | bc)

  cat <<EOF > "$WIDGET_DIR/sysinfo.json.tmp"
{
  "cpu": $CPU,
  "ram": $RAM_PCT
}
EOF
  mv "$WIDGET_DIR/sysinfo.json.tmp" "$WIDGET_DIR/sysinfo.json"
  
  sleep 2
done
`);

console.log('Test harness generated!');
