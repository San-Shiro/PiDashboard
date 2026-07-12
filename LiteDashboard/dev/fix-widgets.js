const fs = require('fs');
const path = require('path');

const WIDGETS_DIR = path.join(__dirname, 'widgets');
const widgetsToFix = [
  'shape-rectangle/shape-rectangle.html',
  'shape-oval/shape-oval.html',
  'shape-polygon/shape-polygon.html',
  'text-basic/text-basic.html',
  'icon-basic/icon-basic.html',
  'divider-basic/divider.html'
];

widgetsToFix.forEach(relPath => {
  const file = path.join(WIDGETS_DIR, relPath);
  if (!fs.existsSync(file)) return;

  let content = fs.readFileSync(file, 'utf8');

  // Replace the fabricated context pattern with PiWidget reading
  if (content.includes('window.__PI_WIDGET_CONTEXT__')) {
    console.log("Fixing", relPath);
    
    // Extract the body inside ctx.onConfigChange((config) => { ... })
    const regex = /ctx\.onConfigChange\(\(config\)\s*=>\s*\{([\s\S]*?)\}\);/;
    const match = content.match(regex);
    
    if (match) {
      const innerLogic = match[1];
      
      const newScript = `<script>
(function() {
  var config = (typeof PiWidget !== 'undefined' && PiWidget.config) || {};
  var container = document.getElementById(typeof instanceId !== 'undefined' ? instanceId : '');
  var root = container ? (container.shadowRoot || container) : document;
  var shape = root.querySelector('.shape-container, .text-container, .icon-container, .divider-container') || root.querySelector('div') || document.body;

  if (!shape) return;

${innerLogic}
})();
</script>`;
      
      // Replace entire script tag
      content = content.replace(/<script>[\s\S]*?<\/script>/, newScript);
      fs.writeFileSync(file, content, 'utf8');
      console.log("Updated", relPath);
    }
  }
});
