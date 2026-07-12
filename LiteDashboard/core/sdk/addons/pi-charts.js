(function() {
  window.PiWidget = window.PiWidget || {};
  window.PiWidget.registerAddon = window.PiWidget.registerAddon || function(id, impl) {
    window._piAddons = window._piAddons || {};
    window._piAddons[id] = impl;
  };
  
  window.PiWidget.registerAddon('pi-charts', {
    init: function(container) {
      if (window.PiBind && !window.PiBind._hasChartHook) {
        window.PiBind._hasChartHook = true;
        var origApply = window.PiBind.apply;
        window.PiBind.apply = function(el, state) {
          origApply(el, state);
          
          var root = el.shadowRoot || el;
          
          // Gauges
          var gauges = root.querySelectorAll('[data-gauge]');
          for (var i = 0; i < gauges.length; i++) {
            var g = gauges[i];
            var key = g.getAttribute('data-gauge');
            var val = state[key]; 
            if (val !== undefined) {
              var max = parseFloat(g.getAttribute('data-gauge-max')) || 100;
              var pct = Math.min(100, Math.max(0, (val / max) * 100));
              var color = g.getAttribute('data-gauge-color') || 'var(--canvas-accent)';
              g.style.background = 'conic-gradient(' + color + ' ' + pct + '%, var(--canvas-border) 0)';
              g.style.borderRadius = '50%';
            }
          }
          
          // Linear Bars
          var bars = root.querySelectorAll('[data-bar]');
          for (var i = 0; i < bars.length; i++) {
            var b = bars[i];
            var key = b.getAttribute('data-bar');
            var val = state[key];
            if (val !== undefined) {
              var max = parseFloat(b.getAttribute('data-bar-max')) || 100;
              var pct = val; // Assuming 0-100 scale for simplicity
              
              var lowC = b.getAttribute('data-bar-low') || '#00e5ff';
              var midC = b.getAttribute('data-bar-mid') || '#ff9100';
              var highC = b.getAttribute('data-bar-high') || '#ff1744';
              
              var midT = parseFloat(b.getAttribute('data-bar-mid-t')) || 60;
              var highT = parseFloat(b.getAttribute('data-bar-high-t')) || 85;
              
              var color = lowC;
              if (pct >= highT) color = highC;
              else if (pct >= midT) color = midC;
              
              b.style.transform = 'scaleX(' + (pct / max) + ')';
              b.style.backgroundColor = color;
              b.style.boxShadow = '0 0 10px ' + color + '80';
            }
          }
        };
      }
    },
    destroy: function(container) {}
  });
})();
