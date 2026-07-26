(function() {
  window.PiWidget = window.PiWidget || {};
  window.PiWidget.registerAddon = window.PiWidget.registerAddon || function(id, impl) {
    window._piAddons = window._piAddons || {};
    window._piAddons[id] = impl;
  };
  
  window.PiWidget.registerAddon('pi-animations', {
    init: function(container) {
      var root = container.shadowRoot || container;
      
      if (window.PiBind && !window.PiBind._hasAnimHook) {
        window.PiBind._hasAnimHook = true;
        var origApply = window.PiBind.apply;
        window.PiBind.apply = function(el, state) {
          origApply(el, state);
          
          var root = el.shadowRoot || el;
          var anims = root.querySelectorAll('[data-animate]');
          for (var i = 0; i < anims.length; i++) {
            var a = anims[i];
            var type = a.getAttribute('data-animate');
            if (type === 'marquee') {
              // simple CSS marquee setup
              if (a.scrollWidth > a.clientWidth && !a.classList.contains('marquee-active')) {
                a.classList.add('marquee-active');
                a.style.display = 'inline-block';
                a.style.whiteSpace = 'nowrap';
                a.style.animation = 'marquee 5s linear infinite';
                
                if (!document.getElementById('pi-marquee-style')) {
                  var style = document.createElement('style');
                  style.id = 'pi-marquee-style';
                  style.textContent = '@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }';
                  document.head.appendChild(style);
                }
              } else if (a.scrollWidth <= a.clientWidth) {
                a.classList.remove('marquee-active');
                a.style.animation = 'none';
              }
            }
          }
        };
      }
    },
    destroy: function(container) {}
  });
})();
