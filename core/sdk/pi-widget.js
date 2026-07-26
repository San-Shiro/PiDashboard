(function() {
  var _stateHandlers = [];
  var _dataHandlers = [];
  var _refreshHandlers = [];
  var _frameCallbacks = [];
  var _destroyCallbacks = [];
  var _lastStates = {};
  var _targetFps = 60;
  var _frameInterval = 1000 / _targetFps;
  var _lastFrameTime = 0;

  // Command acknowledgement correlation (Phase 3.4).
  // callDaemon(name, params) registers a pending command by id; the daemon's
  // _ack (delivered via the state channel) resolves the matching promise.
  var _pendingCommands = {};
  var _cmdSeq = 0;
  var _COMMAND_TIMEOUT_MS = 10000;
  
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
      if (api.onRefresh) {
        _refreshHandlers.push({ type: widgetType, instance: instanceId, handler: api.onRefresh });
      }
      if (api.onDestroy) {
        _destroyCallbacks.push({ type: widgetType, instance: instanceId, handler: api.onDestroy });
      }
      if (api.onFrame) {
        var wasEmpty = _frameCallbacks.length === 0;
        _frameCallbacks.push({ type: widgetType, handler: api.onFrame });
        if (wasEmpty && window.PiWidget._startFrameLoop) window.PiWidget._startFrameLoop(_targetFps);
      }
    },
    
    cmd: function(daemon, payload) {
      if (window.__piWs && window.__piWs.readyState === 1) {
        var cmdMsg = { type: 'cmd', daemon: daemon, instance: 'global', data: payload };
        window.__piWs.send(JSON.stringify(cmdMsg));
      }
    },

    // Register a pending command and return { id, promise }. The promise always
    // resolves (never rejects) with { ok, error?, timeout? } so fire-and-forget
    // callers never produce unhandled rejections.
    _registerCommand: function() {
      var id = 'c' + Date.now() + '_' + (++_cmdSeq);
      var promise = new Promise(function(resolve) {
        var timer = setTimeout(function() {
          if (_pendingCommands[id]) {
            delete _pendingCommands[id];
            resolve({ ok: false, timeout: true });
          }
        }, _COMMAND_TIMEOUT_MS);
        _pendingCommands[id] = { resolve: resolve, timer: timer };
      });
      return { id: id, promise: promise };
    },

    _resolveCommand: function(id, ok, error) {
      var pending = _pendingCommands[id];
      if (!pending) return;
      clearTimeout(pending.timer);
      delete _pendingCommands[id];
      pending.resolve({ ok: ok !== false, error: error });
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
            var hasSpecificState = id && _lastStates[id] !== undefined;
            var elData = (data && typeof data === 'object' && id && id in data) ? data[id] : (hasSpecificState ? null : data);
            if (!elData) continue;
            var config = {};
            try { config = JSON.parse(el.getAttribute('data-config') || '{}'); } catch(e) {}
            try { window.PiBind.apply(el, Object.assign({}, config, elData)); } catch(e) { console.error('PiBind apply error:', e); }
          }
        }
      }

      // Trigger OSD animations if registered
      if (window.__piOsdTriggers) {
        if (instanceId !== 'global' && window.__piOsdTriggers[instanceId]) {
          window.__piOsdTriggers[instanceId]();
        } else if (instanceId === 'global') {
          for (var key in window.__piOsdTriggers) {
            if (document.getElementById(key) && document.getElementById(key).getAttribute('data-widget') === widgetType) {
               window.__piOsdTriggers[key]();
            }
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
    
    _dispatchRefresh: function(widgetType, instanceId, newConfig) {
      for (var i = 0; i < _refreshHandlers.length; i++) {
        var h = _refreshHandlers[i];
        if (h.type === widgetType && (instanceId === 'global' || h.instance === instanceId)) {
          try { h.handler(newConfig); } catch(e) {
            console.error('[PiWidget] onRefresh error in ' + widgetType + ':', e);
          }
        }
      }
    },
    
    _startFrameLoop: function(fps) {
      _targetFps = fps || 60;
      _frameInterval = 1000 / _targetFps;

      function tick(timestamp) {
        if (_frameCallbacks.length === 0) return;
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

      requestAnimationFrame(tick);
    },
    
    _destroyAll: function() {
      for (var i = 0; i < _destroyCallbacks.length; i++) {
        try { _destroyCallbacks[i].handler(); } catch(e) {}
      }
      _stateHandlers = [];
      _dataHandlers = [];
      _refreshHandlers = [];
      _frameCallbacks = [];
      _destroyCallbacks = [];
      _lastStates = {};
    }
  };
})();
