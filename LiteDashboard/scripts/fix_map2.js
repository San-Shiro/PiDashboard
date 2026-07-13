const fs = require('fs');

const b64 = fs.readFileSync('widgets/community-earthquakes/fragment/map.b64', 'utf8').trim();

let html = fs.readFileSync('widgets/community-earthquakes/fragment/earthquakes.html', 'utf8');

// We need to replace the entire map container div (the one with the img) with a canvas
html = html.replace(/<div style="position: absolute;[^>]+>[\s\S]*?<\/div>/, `<canvas class="world-map" width="2000" height="1000" style="position: absolute; width: 100%; height: auto; z-index: 1; pointer-events: none; opacity: 0.6;"></canvas>`);

// We need to insert the canvas rendering logic into the JS
const canvasLogic = `
    const mapCanvas = document.querySelector('.world-map');
    const ctx = mapCanvas.getContext('2d');
    const mapImg = new Image();
    mapImg.onload = () => {
      // Draw map
      ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
      ctx.drawImage(mapImg, 0, 0, mapCanvas.width, mapCanvas.height);
      
      // Tint map if color is set
      if (window.PiWidget && window.PiWidget.config && window.PiWidget.config.mapColor) {
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = window.PiWidget.config.mapColor;
        ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
    };
    mapImg.src = '${b64}';

    // Hook config update
`;

// Replace the old mapPath config logic
html = html.replace(/const mapPath = document\.querySelector\('\.world-map'\);/, '');
html = html.replace(/if\s*\(cfg\.mapColor\s*&&\s*mapPath\)\s*mapPath\.style\.filter\s*=\s*'drop-shadow[^;]+;/, `
      if (cfg.mapColor && mapCanvas && ctx) {
        ctx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
        ctx.drawImage(mapImg, 0, 0, mapCanvas.width, mapCanvas.height);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = cfg.mapColor;
        ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
`);

// Insert the onload initialization right after PiWidget.onConfig
html = html.replace(/PiWidget\.onConfig\(\(cfg\)\s*=>\s*\{/, `
  ${canvasLogic}
  PiWidget.onConfig((cfg) => {
`);

fs.writeFileSync('widgets/community-earthquakes/fragment/earthquakes.html', html);
console.log('Fixed earthquakes.html using Canvas');
