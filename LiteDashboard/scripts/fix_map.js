const fs = require('fs');
let html = fs.readFileSync('widgets/community-earthquakes/fragment/earthquakes.html', 'utf8');

const b64 = fs.readFileSync('widgets/community-earthquakes/fragment/map.b64', 'utf8').trim().replace(/^data:image\/png;base64,/, '');

html = html.replace(/<div class="world-map" style="[^>]+><\/div>/, `<div style="position: absolute; width: 100%; height: 100%; z-index: 1; pointer-events: none; overflow: hidden;"><img class="world-map" src="data:image/png;base64,${b64}" style="width: 100%; height: 100%; object-fit: contain; opacity: 0.6; transform: translateX(-100vw); filter: drop-shadow(100vw 0 0 #334155);" /></div>`);

html = html.replace(/mapPath\.style\.backgroundColor\s*=\s*cfg\.mapColor;/, "mapPath.style.filter = 'drop-shadow(100vw 0 0 ' + cfg.mapColor + ')';");

fs.writeFileSync('widgets/community-earthquakes/fragment/earthquakes.html', html);
console.log('Fixed earthquakes.html');
