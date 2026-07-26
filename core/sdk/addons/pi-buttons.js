(function() {
  window.PiWidget = window.PiWidget || {};
  window.PiWidget.registerAddon = window.PiWidget.registerAddon || function(id, impl) {
    window._piAddons = window._piAddons || {};
    window._piAddons[id] = impl;
  };
  
  window.PiWidget.registerAddon('pi-buttons', {
    init: function(container) {
      var root = container.shadowRoot || container;
      var buttons = root.querySelectorAll('[data-cmd]');
      for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        if (!btn._piBtnAttached) {
          btn._piBtnAttached = true;
          btn.addEventListener('click', function(e) {
            var target = e.currentTarget;
            var cmdStr = target.getAttribute('data-cmd');
            if (!cmdStr) return;
            var parts = cmdStr.split(':');
            var daemon = parts[0];
            var action = parts[1];
            
            var payloadStr = target.getAttribute('data-payload');
            var payload = {};
            if (payloadStr) {
              try { payload = JSON.parse(payloadStr); } catch(err) {}
            }
            if (action) payload.action = action;
            
            if (window.PiWidget && window.PiWidget.cmd) {
              window.PiWidget.cmd(daemon, payload);
            }
            
            var toggleCls = target.getAttribute('data-toggle-class');
            if (toggleCls) target.classList.toggle(toggleCls);
          });
        }
      }
    },
    destroy: function(container) {
      // Event listeners on DOM elements are garbage collected
    }
  });
})();
