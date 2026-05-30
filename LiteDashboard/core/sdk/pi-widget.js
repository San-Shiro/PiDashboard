(function() {
  var _stateHandlers = [];
  var _frameCallbacks = [];
  var _destroyCallbacks = [];
  var _targetFps = 60;
  var _frameInterval = 1000 / _targetFps;
  var _lastFrameTime = 0;
  
  window.PiWidget = {
    context: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: navigator.language,
      is24h: !(new Date().toLocaleTimeString().match(/AM|PM/)),
      deviceType: ('ontouchstart' in window) ? 'touch' : 'pointer',
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      serverTimezone: 'UTC',
      canvasId: '',
      overrides: {}
    },
    
    _registerAPI: function(instanceId, widgetType, api) {
      if (!api) return;
      if (api.onState) _stateHandlers.push({ type: widgetType, instance: instanceId, handler: api.onState });
      if (api.onData) _stateHandlers.push({ type: widgetType, instance: instanceId, handler: api.onData }); // fallback during migration
      if (api.onFrame) _frameCallbacks.push({ type: widgetType, handler: api.onFrame });
      if (api.onDestroy) _destroyCallbacks.push({ type: widgetType, instance: instanceId, handler: api.onDestroy });
    },
    
    _dispatchState: function(widgetType, instanceId, data) {
      for (var i = 0; i < _stateHandlers.length; i++) {
        var h = _stateHandlers[i];
        // Match if instance is 'global' (global) or matches instanceId exactly
        if (h.type === widgetType && (instanceId === 'global' || h.instance === instanceId || instanceId === 'global')) {
          try { 
            h.handler(data); 
          } catch(e) {
            console.error('[PiWidget] onState error in ' + widgetType + ':', e);
            window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
          }
        }
      }
    },
    
    _startFrameLoop: function(fps) {
      _targetFps = fps || 60;
      _frameInterval = 1000 / _targetFps;
      
      function tick(timestamp) {
        if (timestamp - _lastFrameTime >= _frameInterval) {
          _lastFrameTime = timestamp;
          for (var i = 0; i < _frameCallbacks.length; i++) {
            try { 
              _frameCallbacks[i].handler(timestamp); 
            } catch(e) {
              window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
            }
          }
        }
        requestAnimationFrame(tick);
      }
      
      if (_frameCallbacks.length > 0) {
        requestAnimationFrame(tick);
      }
    },
    
    _destroyAll: function() {
      for (var i = 0; i < _destroyCallbacks.length; i++) {
        try { _destroyCallbacks[i].handler(); } catch(e) {}
      }
      _stateHandlers = [];
      _frameCallbacks = [];
      _destroyCallbacks = [];
    }
  };
})();
