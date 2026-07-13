const fs = require('fs');

let b64 = fs.readFileSync('widgets/community-earthquakes/fragment/map.b64', 'utf8').trim();
if (!b64.startsWith('data:image')) {
    b64 = 'data:image/png;base64,' + b64;
}

let html = fs.readFileSync('widgets/community-earthquakes/fragment/earthquakes.html', 'utf8');

// The new robust script block
const newScript = `
<script>
(function() {
  const container = document.querySelector('.earthquake-container');
  const layer = document.querySelector('.markers-layer');
  const mapCanvas = document.querySelector('.world-map');
  const ctx = mapCanvas.getContext('2d');
  
  // Setup config styles
  let minMag = 3.0;
  let pulseSpeed = 2.0;
  let dotColor = '#ff3333';
  let mapColor = '#334155';
  let mapLoaded = false;
  
  const mapImg = new Image();
  mapImg.onload = () => {
    mapLoaded = true;
    renderMap();
  };
  mapImg.src = '${b64}';

  function renderMap() {
    if (!mapLoaded || !ctx || !mapCanvas) return;
    
    // Draw base map
    ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    ctx.drawImage(mapImg, 0, 0, mapCanvas.width, mapCanvas.height);
    
    // Tint map
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = mapColor;
    ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  
  function applyConfig(cfg) {
    if (cfg.dotColor) dotColor = cfg.dotColor;
    if (cfg.mapColor && cfg.mapColor !== mapColor) {
      mapColor = cfg.mapColor;
      renderMap(); // Redraw with new color
    }
    if (cfg.backgroundColor && container) container.style.backgroundColor = cfg.backgroundColor;
    if (cfg.pulseSpeed) pulseSpeed = cfg.pulseSpeed;
  }
  
  // Projection formula (Equirectangular)
  function project(lng, lat) {
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  }
  
  // Use PiDashboard Widget SDK API
  window.widget.register({
    onState: function(data) {
      // Config is injected by compositor
      const config = (window.widget && window.widget.config) ? window.widget.config : {};
      applyConfig(config);
      
      // Clear old markers
      layer.innerHTML = '';
      
      // Unwrap instance data if nested
      const safeData = data || {};
      const instanceData = safeData[window.instanceId] || safeData;
      if (!Array.isArray(instanceData)) return;
      
      instanceData.forEach(quake => {
        const pos = project(quake.lng, quake.lat);
        const size = Math.max(3, (quake.mag - 2) * 2); // Relative dot size
        
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.left = \`\${pos.x}%\`;
        dot.style.top = \`\${pos.y}%\`;
        dot.style.width = \`\${size}px\`;
        dot.style.height = \`\${size}px\`;
        dot.style.backgroundColor = dotColor;
        
        const ring = document.createElement('div');
        ring.className = 'pulse-ring';
        ring.style.left = \`\${pos.x}%\`;
        ring.style.top = \`\${pos.y}%\`;
        ring.style.width = \`\${size}px\`;
        ring.style.height = \`\${size}px\`;
        ring.style.border = \`2px solid \${dotColor}\`;
        ring.style.animationDuration = \`\${pulseSpeed}s\`;
        
        layer.appendChild(dot);
        layer.appendChild(ring);
      });
    }
  });
})();
</script>
`;

// Replace everything from <script> to </script>
html = html.replace(/<script>[\s\S]*<\/script>/, newScript);

fs.writeFileSync('widgets/community-earthquakes/fragment/earthquakes.html', html);
console.log('Successfully replaced script block');
