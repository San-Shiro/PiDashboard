const { composeHTML } = require('../core/engine/compositor.ts');

const registry = [{ 
  id: 'shape-rectangle', 
  manifest: {
    trust: 'verified',
    stateMode: 'instance',
    permissions: {}
  },
  fragmentHTML: `
<style>
  .shape-container { background: var(--bg-color); }
</style>
<div class="shape-container" id="shape"></div>
<script>
(function() {
  var config = (typeof PiWidget !== 'undefined' && PiWidget.config) || {};
  var container = document.getElementById(typeof instanceId !== 'undefined' ? instanceId : 'shape');
  var root = container ? (container.shadowRoot || container) : document;
  var shape = root.querySelector('.shape-container') || document.getElementById('shape');

  if (!shape) return;

  if (config.bgType === 'linear') {
    shape.style.setProperty('--bg-color', 'linear-gradient(' + (config.gradientAngle || 135) + 'deg, ' + (config.primaryColor || '#3B82F6') + ', ' + (config.secondaryColor || '#1D4ED8') + ')');
  } else {
    shape.style.setProperty('--bg-color', config.primaryColor || '#3B82F6');
  }
})();
</script>
`
}];

const canvas = { 
  id: 'test', 
  canvas: { width: 800, height: 600, background: '#000', fps: 60 },
  widgets: [{ 
    id: 'inst1', 
    widget_id: 'shape-rectangle', 
    config: { bgType: 'linear', gradientAngle: 45, primaryColor: '#f00', secondaryColor: '#00f' }, 
    layout: { x: 0, y: 0, width: 100, height: 100, zIndex: 1, opacity: 1, overflow: 'visible' } 
  }] 
};

try {
  const html = composeHTML(canvas, registry, {});
  console.log(html);
} catch (e) {
  console.error(e);
}
