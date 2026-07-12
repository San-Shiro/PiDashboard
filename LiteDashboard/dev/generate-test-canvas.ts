import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const widgetsDir = join(process.cwd(), 'widgets');
const canvasesDir = join(process.cwd(), 'canvases');

mkdirSync(join(widgetsDir, 'clock'), { recursive: true });
mkdirSync(join(widgetsDir, 'sysinfo'), { recursive: true });
mkdirSync(canvasesDir, { recursive: true });

// 1. Clock Widget
writeFileSync(join(widgetsDir, 'clock', 'manifest.json'), JSON.stringify({
  id: 'clock',
  name: 'Digital Clock',
  version: '1.0.0',
  author: 'PiDashboard',
  description: 'A simple digital clock',
  trust: 'verified',
  permissions: { network: false, disk: false },
  fragment: { file: 'clock.html', format: 'snippet' },
  configSchema: [
    { key: 'showSeconds', type: 'boolean', default: true }
  ]
}, null, 2));

writeFileSync(join(widgetsDir, 'clock', 'clock.html'), `
<div id="clock-display" style="font-family: monospace; font-size: 48px; color: #00ffcc; text-shadow: 0 0 10px #00ffcc; display: flex; align-items: center; justify-content: center; height: 100%; background: rgba(0,0,0,0.5); border-radius: 12px; border: 1px solid #333;">
  00:00:00
</div>
<script>
  window.PiWidget.register(document.currentScript.parentElement, function(ctx) {
    var el = ctx.root.querySelector('#clock-display');
    var showSeconds = ctx.config.showSeconds !== false;
    
    function update() {
      var d = new Date();
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      var ss = String(d.getSeconds()).padStart(2, '0');
      el.textContent = hh + ':' + mm + (showSeconds ? ':' + ss : '');
    }
    
    setInterval(update, 1000);
    update();
    
    return {
      onDestroy: function() { console.log("Clock destroyed"); }
    };
  });
</script>
`);

// 2. Sysinfo Widget (Community tier to test iframe)
writeFileSync(join(widgetsDir, 'sysinfo', 'manifest.json'), JSON.stringify({
  id: 'sysinfo',
  name: 'System Stats',
  version: '1.0.0',
  author: 'PiDashboard',
  description: 'Shows CPU and RAM usage',
  trust: 'community',
  permissions: { network: false, disk: false },
  fragment: { file: 'sysinfo.html', format: 'snippet' },
  configSchema: []
}, null, 2));

writeFileSync(join(widgetsDir, 'sysinfo', 'sysinfo.html'), `
<style>
  body { color: white; font-family: sans-serif; background: linear-gradient(135deg, #1e1e1e, #2a2a2a); border-radius: 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .bar-container { width: 80%; height: 20px; background: #333; border-radius: 10px; margin: 10px 0; overflow: hidden; }
  .bar { height: 100%; background: #ff4757; width: 0%; transition: width 0.3s; }
  h3 { margin: 0; font-weight: 300; }
</style>
<div style="text-align: center; width: 100%;">
  <h3>CPU Usage</h3>
  <div class="bar-container"><div class="bar" id="cpu-bar"></div></div>
  <h3>RAM Usage</h3>
  <div class="bar-container"><div class="bar" id="ram-bar" style="background: #2ed573;"></div></div>
</div>
<script>
  // Fake update for testing
  setInterval(function() {
    document.getElementById('cpu-bar').style.width = Math.floor(Math.random() * 100) + '%';
    document.getElementById('ram-bar').style.width = Math.floor(Math.random() * 100) + '%';
  }, 2000);
  
  // Test receiving IPC data from community handler
  window.__communityOnData = function(data) {
    if (data.cpu) document.getElementById('cpu-bar').style.width = data.cpu + '%';
    if (data.ram) document.getElementById('ram-bar').style.width = data.ram + '%';
  };
</script>
`);

// 3. Canvas Config
writeFileSync(join(canvasesDir, 'hd_preview.json'), JSON.stringify({
  id: 'hd-test',
  schemaVersion: 2,
  canvas: {
    width: 1920,
    height: 1080,
    background: '#0d1117',
    fps: 60
  },
  widgets: [
    {
      id: 'clock_1',
      widget_id: 'clock',
      enabled: true,
      layout: {
        x: 100,
        y: 100,
        width: 400,
        height: 150,
        zIndex: 10,
        opacity: 1,
        overflow: 'hidden',
        transition: 'all 0.3s'
      },
      config: { showSeconds: true }
    },
    {
      id: 'sysinfo_1',
      widget_id: 'sysinfo',
      enabled: true,
      layout: {
        x: 1400,
        y: 100,
        width: 400,
        height: 300,
        zIndex: 5,
        opacity: 0.9,
        overflow: 'hidden',
        borderRadius: 12
      },
      config: {}
    }
  ]
}, null, 2));

console.log('Widgets and canvas config generated.');
