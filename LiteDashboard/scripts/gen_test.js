const fs = require('fs');
const b64 = fs.readFileSync('widgets/community-earthquakes/fragment/map.b64', 'utf8');

const html = `
<html>
<body style="background: black;">
<div style="width: 800px; height: 400px; position: relative;">
  <div class="world-map" style="
    position: absolute; 
    width: 100%; 
    height: 100%; 
    -webkit-mask-image: url('${b64}'); 
    -webkit-mask-size: contain; 
    -webkit-mask-position: center;
    -webkit-mask-repeat: no-repeat;
    mask-image: url('${b64}'); 
    mask-size: contain; 
    mask-position: center;
    mask-repeat: no-repeat;
    background-color: #ff0000;
  "></div>
</div>
</body>
</html>
`;

fs.writeFileSync('scripts/test.html', html);
console.log('wrote test.html');
