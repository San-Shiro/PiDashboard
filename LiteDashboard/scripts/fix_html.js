const fs = require('fs');
const file = './widgets/community-earthquakes/fragment/earthquakes.html';
let html = fs.readFileSync(file, 'utf8');

// Replace <img src="data:image/png;base64,..." class="world-map" style="position: absolute; width: 100%; height: 100%; object-fit: contain; z-index: 1; opacity: 0.6; pointer-events: none;">
// with a div that uses it as a mask.
html = html.replace(/<img src="(data:image\/png;base64,[^"]+)"[^>]*>/, '<div class="world-map" style="position: absolute; width: 100%; height: 100%; z-index: 1; opacity: 0.6; pointer-events: none; -webkit-mask-image: url(\'$1\'); -webkit-mask-size: contain; mask-image: url(\'$1\'); mask-size: contain; background-color: #334155;"></div>');

// Also update the JS to apply the backgroundColor
html = html.replace('if (cfg.mapColor && mapPath) mapPath.style.color = cfg.mapColor;', 'if (cfg.mapColor && mapPath) mapPath.style.backgroundColor = cfg.mapColor;');

fs.writeFileSync(file, html, 'utf8');
console.log('Fixed earthquakes.html');
