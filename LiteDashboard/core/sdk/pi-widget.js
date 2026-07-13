(function() {
  var _stateHandlers = [];
  var _dataHandlers = [];
  var _frameCallbacks = [];
  var _destroyCallbacks = [];
  var _lastStates = {};
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
      if (api.onState) {
        _stateHandlers.push({ type: widgetType, instance: instanceId, handler: api.onState });
        
        // Replay state if it arrived before registration (hydration race condition fix)
        var lastState = _lastStates[widgetType];
        if (lastState !== undefined) {
          var payload = lastState;
          if (instanceId !== 'global' && lastState && typeof lastState === 'object' && instanceId in lastState) {
            payload = lastState[instanceId];
          }
          try { api.onState(payload); } catch(e) { console.error('[PiWidget] replay error:', e); }
        }
      }
      if (api.onData) {
        _dataHandlers.push({ type: widgetType, instance: instanceId, handler: api.onData });
      }
      if (api.onDestroy) {
        _destroyCallbacks.push({ type: widgetType, instance: instanceId, handler: api.onDestroy });
      }
      if (api.onFrame) _frameCallbacks.push({ type: widgetType, handler: api.onFrame });
    },
    
    cmd: function(daemon, payload) {
      if (window.__piWs && window.__piWs.readyState === 1) {
        var cmdMsg = { type: 'cmd', daemon: daemon, instance: 'global', data: payload };
        window.__piWs.send(JSON.stringify(cmdMsg));
      }
    },
    
    getState: function(typeOrInstance) {
      return _lastStates[typeOrInstance] || null;
    },
    
    getInstanceState: function(widgetType, instanceId) {
      var wState = _lastStates[widgetType];
      if (wState && typeof wState === 'object' && instanceId in wState) {
        return wState[instanceId];
      }
      return _lastStates[instanceId] || null;
    },
    
    onSwipe: function(element, callback) {
      if (!element) return;
      var touchStartX = 0, touchStartY = 0;
      var threshold = 50;
      element.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, {passive: true});
      element.addEventListener('touchend', function(e) {
        var touchEndX = e.changedTouches[0].screenX;
        var touchEndY = e.changedTouches[0].screenY;
        var dx = touchEndX - touchStartX;
        var dy = touchEndY - touchStartY;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (Math.abs(dx) > threshold) {
            callback(dx > 0 ? 'right' : 'left');
          }
        } else {
          if (Math.abs(dy) > threshold) {
            callback(dy > 0 ? 'down' : 'up');
          }
        }
      }, {passive: true});
    },
    
    onLongPress: function(element, callback, duration) {
      if (!element) return;
      var timer;
      duration = duration || 800;
      function start() { timer = setTimeout(callback, duration); }
      function cancel() { clearTimeout(timer); }
      element.addEventListener('touchstart', start, {passive: true});
      element.addEventListener('touchend', cancel, {passive: true});
      element.addEventListener('touchmove', cancel, {passive: true});
      element.addEventListener('mousedown', start, {passive: true});
      element.addEventListener('mouseup', cancel, {passive: true});
      element.addEventListener('mousemove', cancel, {passive: true});
      element.addEventListener('mouseleave', cancel, {passive: true});
    },
    
    _dispatchState: function(widgetType, instanceId, data) {
      _lastStates[widgetType] = data;
      if (instanceId !== 'global') {
        _lastStates[instanceId] = data;
      }
      
      // Apply declarative bindings first
      if (window.PiBind) {
        if (instanceId !== 'global') {
          var container = document.getElementById(instanceId);
          if (container) {
            var config = {};
            try { config = JSON.parse(container.getAttribute('data-config') || '{}'); } catch(e) {}
            try { window.PiBind.apply(container, Object.assign({}, config, data)); } catch(e) { console.error('PiBind apply error:', e); }
          }
        } else {
          var containers = document.querySelectorAll('[data-widget="' + widgetType + '"]');
          for (var i = 0; i < containers.length; i++) {
            var el = containers[i];
            var id = el.getAttribute('data-instance');
            var elData = (data && typeof data === 'object' && id in data) ? data[id] : data;
            var config = {};
            try { config = JSON.parse(el.getAttribute('data-config') || '{}'); } catch(e) {}
            try { window.PiBind.apply(el, Object.assign({}, config, elData)); } catch(e) { console.error('PiBind apply error:', e); }
          }
        }
      }

      // Then trigger custom handlers
      for (var i = 0; i < _stateHandlers.length; i++) {
        var h = _stateHandlers[i];
        if (h.type === widgetType && (instanceId === 'global' || h.instance === instanceId)) {
          try { 
            var payload = data;
            if (instanceId === 'global' && h.instance !== 'global' && data && typeof data === 'object' && h.instance in data) {
              payload = data[h.instance];
            }
            h.handler(payload); 
          } catch(e) {
            console.error('[PiWidget] onState error in ' + widgetType + ':', e);
            window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
          }
        }
      }
    },
    
    _dispatchData: function(widgetType, instanceId, data) {
      for (var i = 0; i < _dataHandlers.length; i++) {
        var h = _dataHandlers[i];
        if (h.type === widgetType) {
          try { h.handler(data); } catch(e) {
            console.error('[PiWidget] onData error in ' + widgetType + ':', e);
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
      _dataHandlers = [];
      _frameCallbacks = [];
      _destroyCallbacks = [];
    }
  };
})();
