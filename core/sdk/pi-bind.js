(function() {
  function resolveKey(state, keyPath) {
    if (!keyPath) return undefined;
    var keys = keyPath.split('.');
    var val = state;
    for (var i = 0; i < keys.length; i++) {
      if (val === undefined || val === null) return undefined;
      val = val[keys[i]];
    }
    return val;
  }

  var _customFormatters = {};

  function formatValue(value, format, state) {
    if (value === undefined || value === null) return '';
    if (!format) return value;
    
    var parts = format.split(':');
    var type = parts[0].trim();
    var arg = parts[1] ? parts[1].trim() : undefined;

    if (_customFormatters[type]) {
      try {
        return _customFormatters[type](value, arg, state);
      } catch(e) {
        console.error('Custom formatter error [' + type + ']:', e);
        return value;
      }
    }

    switch (type) {
      case 'fixed':
        var num = parseFloat(value);
        return isNaN(num) ? value : num.toFixed(parseInt(arg) || 0);
      case 'bytes':
        var b = parseFloat(value);
        if (isNaN(b) || b === 0) return '0 B';
        var k = 1024;
        var sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        var i = Math.floor(Math.log(b) / Math.log(k));
        return parseFloat((b / Math.pow(k, i)).toFixed(parseInt(arg) || 1)) + ' ' + sizes[i];
      case 'percent':
        var pVal = parseFloat(value);
        var pMax = parseFloat(arg) || 100;
        if (isNaN(pVal)) return '0%';
        return Math.round((pVal / pMax) * 100) + '%';
      case 'ago':
        var ts = new Date(value).getTime();
        if (isNaN(ts)) ts = parseInt(value);
        if (isNaN(ts)) return value;
        var diff = Math.floor((Date.now() - ts) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'json':
        return JSON.stringify(value, null, 2);
      case 'default':
        return (value === '' || value === undefined || value === null) ? (arg || '') : value;
      case 'duration':
        var seconds = parseInt(value) || 0;
        if (seconds < 60) return seconds + 's';
        var mins = Math.floor(seconds / 60);
        var hrs = Math.floor(mins / 60);
        if (hrs > 0) return hrs + 'h ' + (mins % 60) + 'm';
        return mins + 'm ' + (seconds % 60) + 's';
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'time':
        return new Date(value).toLocaleTimeString();
      default:
        return value;
    }
  }

  window.PiBind = {
    registerFormatter: function(name, fn) {
      if (typeof fn === 'function') {
        _customFormatters[name] = fn;
      }
    },
    apply: function(container, state) {
      if (!container || !state) return;
      var root = container.shadowRoot || container;

      // Layer 1: visibility (data-bind-show, data-bind-hide)
      var showEls = root.querySelectorAll('[data-bind-show]');
      for (var i = 0; i < showEls.length; i++) {
        var el = showEls[i];
        var val = resolveKey(state, el.getAttribute('data-bind-show'));
        el.style.display = val ? '' : 'none';
      }

      var hideEls = root.querySelectorAll('[data-bind-hide]');
      for (var i = 0; i < hideEls.length; i++) {
        var el = hideEls[i];
        var val = resolveKey(state, el.getAttribute('data-bind-hide'));
        el.style.display = val ? 'none' : '';
      }

      // Layer 1: class toggling (data-bind-class="key:cls, key2:cls2")
      var classEls = root.querySelectorAll('[data-bind-class]');
      for (var i = 0; i < classEls.length; i++) {
        var el = classEls[i];
        var bindings = el.getAttribute('data-bind-class').split(',');
        for (var b = 0; b < bindings.length; b++) {
          var binding = bindings[b].trim().split(':');
          var key = binding[0];
          var cls = binding[1];
          if (key && cls) {
            var val = resolveKey(state, key);
            if (val) el.classList.add(cls);
            else el.classList.remove(cls);
          }
        }
      }

      // Layer 1: dynamic class name (data-bind-class-name="key")
      var dynClassEls = root.querySelectorAll('[data-bind-class-name]');
      for (var i = 0; i < dynClassEls.length; i++) {
        var el = dynClassEls[i];
        var key = el.getAttribute('data-bind-class-name');
        var val = resolveKey(state, key);
        var oldVal = el.getAttribute('data-pi-old-class');
        if (oldVal && oldVal !== val) el.classList.remove(oldVal);
        if (val) {
          el.classList.add(val);
          el.setAttribute('data-pi-old-class', val);
        }
      }

      // Layer 1: Style templates (data-bind-style="prop:template")
      // e.g. data-bind-style="transform:scaleX({{cpu/100}})"
      // For simplicity, we can do data-bind-style="width:percentage%" and the key is "percentage"
      var styleEls = root.querySelectorAll('[data-bind-style]');
      for (var i = 0; i < styleEls.length; i++) {
        var el = styleEls[i];
        var rules = el.getAttribute('data-bind-style').split(';');
        for (var j = 0; j < rules.length; j++) {
          var rule = rules[j].trim();
          if (!rule) continue;
          var parts = rule.split(':');
          if (parts.length === 2) {
            var prop = parts[0].trim();
            var template = parts[1].trim();
            // simple interpolation: {{key}}
            var resolvedTemplate = template.replace(/\{\{([^}]+)\}\}/g, function(match, key) {
              // we don't eval, we just resolve key
              var k = key.trim();
              var val = resolveKey(state, k);
              return (val !== undefined && val !== null) ? val : '';
            });
            el.style[prop] = resolvedTemplate;
          }
        }
      }

      // Layer 1: Attribute binding (data-bind-attr="src:albumArt, alt:track")
      var attrEls = root.querySelectorAll('[data-bind-attr]');
      for (var i = 0; i < attrEls.length; i++) {
        var el = attrEls[i];
        var mappings = el.getAttribute('data-bind-attr').split(',');
        for (var j = 0; j < mappings.length; j++) {
          var mapping = mappings[j].split(':');
          if (mapping.length === 2) {
            var attr = mapping[0].trim();
            var key = mapping[1].trim();
            var val = resolveKey(state, key);
            if (val !== undefined && val !== null) {
              el.setAttribute(attr, val);
            }
          }
        }
      }

      // Layer 1: Complex Background (data-bind-bg="key")
      var bgEls = root.querySelectorAll('[data-bind-bg]');
      for (var i = 0; i < bgEls.length; i++) {
        var el = bgEls[i];
        var key = el.getAttribute('data-bind-bg');
        var bg = resolveKey(state, key);
        if (bg) {
          if (bg.type === 'gradient') {
            var rawStops = (Array.isArray(bg.stops) && bg.stops.length) ? bg.stops : [
              { color: bg.color || 'transparent', position: 0 },
              { color: bg.color2 || 'transparent', position: 100 }
            ];
            var parsedStops = rawStops.map(function(stop, index) {
              return {
                color: stop.color || 'transparent',
                position: Math.max(0, Math.min(100, Number(stop.position != null ? stop.position : Math.round((index / Math.max(1, rawStops.length - 1)) * 100))))
              };
            }).sort(function(a, b) { return a.position - b.position; });
            var stopStr = parsedStops.map(function(s) { return s.color + ' ' + s.position + '%'; }).join(', ');
            var gradientCss = bg.gradientType === 'radial' 
                ? 'radial-gradient(circle, ' + stopStr + ')' 
                : 'linear-gradient(' + (bg.angle || 135) + 'deg, ' + stopStr + ')';
            el.style.background = gradientCss;
          } else {
            el.style.background = bg.color || 'transparent';
          }
        }
      }

      // Layer 1: Complex Border (data-bind-border="key")
      var borderEls = root.querySelectorAll('[data-bind-border]');
      for (var i = 0; i < borderEls.length; i++) {
        var el = borderEls[i];
        var key = el.getAttribute('data-bind-border');
        var bdr = resolveKey(state, key);
        if (bdr) {
          el.style.borderStyle = bdr.type || 'none';
          el.style.borderColor = bdr.color || 'transparent';
          el.style.borderTopWidth = (bdr.width && bdr.width.top != null ? bdr.width.top : 0) + 'px';
          el.style.borderRightWidth = (bdr.width && bdr.width.right != null ? bdr.width.right : 0) + 'px';
          el.style.borderBottomWidth = (bdr.width && bdr.width.bottom != null ? bdr.width.bottom : 0) + 'px';
          el.style.borderLeftWidth = (bdr.width && bdr.width.left != null ? bdr.width.left : 0) + 'px';
        }
      }

      // Layer 1: Complex Box Sizing (data-bind-box-sizing="borderPositionKey")
      var boxSizingEls = root.querySelectorAll('[data-bind-box-sizing]');
      for (var i = 0; i < boxSizingEls.length; i++) {
        var el = boxSizingEls[i];
        var key = el.getAttribute('data-bind-box-sizing');
        var pos = resolveKey(state, key);
        if (pos) {
          el.style.boxSizing = pos === 'outside' ? 'content-box' : 'border-box';
        }
      }

      // Layer 1: Complex Border Radius (data-bind-radius="key")
      var radiusEls = root.querySelectorAll('[data-bind-radius]');
      for (var i = 0; i < radiusEls.length; i++) {
        var el = radiusEls[i];
        var key = el.getAttribute('data-bind-radius');
        var rad = resolveKey(state, key);
        if (rad) {
          el.style.borderTopLeftRadius = (rad.top || 0) + 'px';
          el.style.borderTopRightRadius = (rad.right || 0) + 'px';
          el.style.borderBottomRightRadius = (rad.bottom || 0) + 'px';
          el.style.borderBottomLeftRadius = (rad.left || 0) + 'px';
        }
      }

      // Layer 1: Clip Path Polygon (data-bind-clip-polygon="key")
      var clipEls = root.querySelectorAll('[data-bind-clip-polygon]');
      for (var i = 0; i < clipEls.length; i++) {
        var el = clipEls[i];
        var key = el.getAttribute('data-bind-clip-polygon');
        var cfg = key ? resolveKey(state, key) : state;
        if (!cfg) cfg = {};
        var type = cfg.shapeType || 'star';
        var clipPathStr = '';
        if (type === 'star') {
          var p = cfg.points || 5;
          var inner = cfg.innerRadius || 50;
          var res = '';
          for (var k = 0; k < p * 2; k++) {
            var radius = k % 2 === 0 ? 50 : inner / 2;
            var angle = (k * Math.PI) / p - Math.PI / 2;
            var x = 50 + Math.cos(angle) * radius;
            var y = 50 + Math.sin(angle) * radius;
            res += x.toFixed(1) + '% ' + y.toFixed(1) + '%, ';
          }
          clipPathStr = 'polygon(' + res.slice(0, -2) + ')';
        } else if (type === 'triangle') {
          clipPathStr = 'polygon(50% 0%, 100% 100%, 0% 100%)';
        } else if (type === 'hexagon') {
          clipPathStr = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
        } else {
          clipPathStr = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'; // diamond
        }
        el.style.clipPath = clipPathStr;
        el.style.webkitClipPath = clipPathStr;
      }

      // Layer 1: text content (data-bind="key")
      var bindEls = root.querySelectorAll('[data-bind]');
      for (var i = 0; i < bindEls.length; i++) {
        var el = bindEls[i];
        var key = el.getAttribute('data-bind');
        var val = resolveKey(state, key);
        
        if (val !== undefined) {
          var formatted = formatValue(val, el.getAttribute('data-format'));
          var prefix = el.getAttribute('data-prefix') || '';
          var suffix = el.getAttribute('data-suffix') || '';
          el.textContent = prefix + formatted + suffix;
        }
      }

      // Layer 2: List repeaters (data-bind-list="key")
      var listEls = root.querySelectorAll('[data-bind-list]');
      for (var i = 0; i < listEls.length; i++) {
        var listEl = listEls[i];
        var key = listEl.getAttribute('data-bind-list');
        var items = resolveKey(state, key);
        
        if (Array.isArray(items)) {
          // find template
          var tpl = listEl.querySelector('template');
          if (!tpl) {
            // Check if we already have a stored template
            if (!listEl._piBindTemplate) continue;
          } else {
            listEl._piBindTemplate = tpl.innerHTML;
            listEl.removeChild(tpl);
          }
          
          if (listEl._piBindTemplate) {
            // Dumb render: clear and re-render. Can optimize with diffing later.
            listEl.innerHTML = '';
            for (var k = 0; k < items.length; k++) {
              var itemState = items[k];
              var tempDiv = document.createElement('div');
              tempDiv.innerHTML = listEl._piBindTemplate.trim();
              
              // Apply bindings to the temporary div
              window.PiBind.apply(tempDiv, itemState);
              
              // Move children to actual list
              while (tempDiv.firstChild) {
                listEl.appendChild(tempDiv.firstChild);
              }
            }
          }
        }
      }

      // Layer 3: Declarative Event & Action Bindings (data-on-click, data-on-change, data-on-input, data-on-dblclick)
      var supportedEvents = ['click', 'change', 'input', 'dblclick'];
      for (var eIdx = 0; eIdx < supportedEvents.length; eIdx++) {
        var evType = supportedEvents[eIdx];
        var attrName = 'data-on-' + evType;
        var evEls = root.querySelectorAll('[' + attrName + ']');
        
        for (var i = 0; i < evEls.length; i++) {
          var el = evEls[i];
          if (el['_piEv_' + evType]) continue;
          el['_piEv_' + evType] = true;
          
          (function(targetEl, attr) {
            targetEl.addEventListener(evType, function(e) {
              var spec = targetEl.getAttribute(attr);
              if (!spec) return;
              
              var colonIdx = spec.indexOf(':');
              var action = colonIdx !== -1 ? spec.substring(0, colonIdx).trim() : spec.trim();
              var rawPayload = colonIdx !== -1 ? spec.substring(colonIdx + 1).trim() : '';
              
              // Value interpolation ($value, $checked)
              var payloadStr = rawPayload;
              if (payloadStr.indexOf('$value') !== -1) {
                payloadStr = payloadStr.replace(/\$value/g, JSON.stringify(targetEl.value));
              }
              if (payloadStr.indexOf('$checked') !== -1) {
                payloadStr = payloadStr.replace(/\$checked/g, targetEl.checked ? 'true' : 'false');
              }
              
              var parsedPayload = payloadStr;
              if (payloadStr.startsWith('{') || payloadStr.startsWith('[')) {
                try { parsedPayload = JSON.parse(payloadStr); } catch(err) {}
              } else if (payloadStr.indexOf('=') !== -1) {
                var parts = payloadStr.split('=');
                parsedPayload = {};
                parsedPayload[parts[0].trim()] = parts[1].trim();
              }
              
              // Scoped widget helper resolution
              var widgetContainer = targetEl.closest ? targetEl.closest('[data-widget]') : null;
              
              if (action === 'callDaemon') {
                if (window.widget && window.widget.callDaemon) {
                  window.widget.callDaemon(parsedPayload);
                } else if (window.PiWidget && window.PiWidget.cmd) {
                  var daemon = widgetContainer ? widgetContainer.getAttribute('data-daemon') : '';
                  window.PiWidget.cmd(daemon, parsedPayload);
                }
              } else if (action === 'patchState') {
                if (window.widget && window.widget.patchState) {
                  window.widget.patchState(typeof parsedPayload === 'object' ? parsedPayload : {});
                } else if (window.PiWidget && window.PiWidget._dispatchState) {
                  var wType = widgetContainer ? widgetContainer.getAttribute('data-widget') : '';
                  var instId = widgetContainer ? widgetContainer.id : 'global';
                  window.PiWidget._dispatchState(wType, instId, typeof parsedPayload === 'object' ? parsedPayload : {});
                }
              } else if (action === 'toggle') {
                var currentVal = resolveKey(state, rawPayload);
                var delta = {};
                delta[rawPayload] = !currentVal;
                if (window.widget && window.widget.patchState) {
                  window.widget.patchState(delta);
                }
              }
            });
          })(el, attrName);
        }
      }
    }
  };
})();
