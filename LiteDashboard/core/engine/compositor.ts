import { CanvasConfig, WidgetInstance, WidgetManifest, WidgetFilter } from './schema';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

export interface WidgetRegistryEntry {
  id: string;
  manifest: WidgetManifest;
  fragmentHTML: string;
}

function escapeAttr(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serializeFilter(filter: WidgetFilter): string {
  const parts: string[] = [];
  if (filter.blur !== undefined) parts.push(`blur(${filter.blur})`);
  if (filter.brightness !== undefined) parts.push(`brightness(${filter.brightness})`);
  if (filter.contrast !== undefined) parts.push(`contrast(${filter.contrast})`);
  if (filter.grayscale !== undefined) parts.push(`grayscale(${filter.grayscale})`);
  if (filter.saturate !== undefined) parts.push(`saturate(${filter.saturate})`);
  if (filter.sepia !== undefined) parts.push(`sepia(${filter.sepia})`);
  if (filter.opacity !== undefined) parts.push(`opacity(${filter.opacity})`);
  return parts.join(' ');
}

function separateFragmentScript(html: string): { htmlPart: string; scriptPart: string } {
  const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
  let lastMatch: RegExpMatchArray | null = null;
  let match;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    lastMatch = match;
  }
  
  if (!lastMatch) return { htmlPart: html, scriptPart: '' };
  
  const scriptContent = lastMatch[1];
  const htmlPart = html.slice(0, lastMatch.index!) + html.slice(lastMatch.index! + lastMatch[0].length);
  
  return { htmlPart, scriptPart: scriptContent };
}

function renderInlineWidget(instance: WidgetInstance, manifest: WidgetManifest, fragmentHTML: string, style: string, dataAttrs: string): string {
  const { htmlPart, scriptPart } = separateFragmentScript(fragmentHTML);
  
  let scriptBlock = '';
  if (scriptPart) {
    scriptBlock = `
      <script>
      (function() {
        var instanceId = '${instance.id}';
        var widgetType = '${instance.widget_id}';
        
        window.addEventListener('DOMContentLoaded', function() {
          try {
            var container = document.getElementById(instanceId);
            if (!container) return;
            
            var config = {};
            try { config = JSON.parse(container.getAttribute('data-config') || '{}'); } catch(e) {}
            var state = {};
            try { state = JSON.parse(container.getAttribute('data-state') || '{}'); } catch(e) {}
            
            var root = container.shadowRoot || container;
            var $ = function(sel) { return root.querySelector(sel); };
            var $$ = function(sel) { return root.querySelectorAll(sel); };
            
            var widget = {
              config: config,
              state: state,
              _patchTimer: null,
              _pendingDelta: {},
              patchState: function(delta) {
                Object.assign(this._pendingDelta, delta);
                if (this._patchTimer) return;
                var self = this;
                this._patchTimer = setTimeout(function() {
                  if (window.__piWs && window.__piWs.readyState === 1) {
                    window.__piWs.send(JSON.stringify({
                      type: 'patch', widget: widgetType, instance: instanceId, delta: self._pendingDelta
                    }));
                  }
                  self._pendingDelta = {};
                  self._patchTimer = null;
                }, 100);
              },
              callDaemon: function(payload) {
                if (window.__piWs && window.__piWs.readyState === 1) {
                  var cmdMsg = { type: 'cmd', daemon: '${manifest.daemon || ''}', instance: instanceId, data: payload };
                  window.__piWs.send(JSON.stringify(cmdMsg));
                }
              }
            };
            
            // --- WIDGET CODE ---
            ${scriptPart}
            // --- END WIDGET CODE ---
            
            window.PiWidget._registerAPI(instanceId, widgetType, {
              onData: typeof onData !== 'undefined' ? onData : undefined,
              onState: typeof onState !== 'undefined' ? onState : undefined,
              onFrame: typeof onFrame !== 'undefined' ? onFrame : undefined,
              onDestroy: typeof onDestroy !== 'undefined' ? onDestroy : undefined
            });
          } catch(__err) {
            console.error('[PiWidget] Fatal error in ' + widgetType + ':', __err);
            var errEl = document.createElement('div');
            errEl.innerHTML = '<div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);color:#ff6b6b;font-size:12px;padding:8px;z-index:9999;">⚠ Widget Error</div>';
            if (root) root.appendChild(errEl);
            window.__widgetErrorCount = (window.__widgetErrorCount || 0) + 1;
          }
        });
      })();
      </script>`;
  }

  return `
    <div ${dataAttrs} style="${style}" id="${instance.id}">
      ${htmlPart}
      ${scriptBlock}
    </div>
  `;
}

function renderIframedWidget(instance: WidgetInstance, manifest: WidgetManifest, fragmentHTML: string, style: string, dataAttrs: string): string {
  const srcdoc = `
    <html><body style="margin:0;padding:0;overflow:hidden;">
    <script>var __WIDGET_CONFIG__ = ${JSON.stringify(instance.config)};
    var __WIDGET_TYPE__ = '${instance.widget_id}';
    var __INSTANCE_ID__ = '${instance.id}';
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'widget_data') {
        if (window.__communityOnData) window.__communityOnData(e.data.payload);
      }
    });
    </script>
    ${fragmentHTML}
    </body></html>
  `.replace(/"/g, '&quot;');
  
  return `
    <div ${dataAttrs} style="${style}">
      <iframe sandbox="allow-scripts" 
              srcdoc="${srcdoc}"
              style="width:100%;height:100%;border:none;"></iframe>
    </div>
  `;
}

function getWidgetState(instanceId: string): any | null {
  const safeId = instanceId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) return null;
  const statePath = join(process.cwd(), 'state', 'widgets', `${safeId}.json`);
  if (!existsSync(statePath)) return null;
  
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function renderWidgetContainer(instance: WidgetInstance, manifest: WidgetManifest, fragmentHTML: string, savedState?: any): string {
  const { layout, config, id, widget_id, schedule } = instance;
  
  // if state isn't passed from memory, attempt to load from disk if persistence is enabled
  let finalSavedState = savedState;
  if (finalSavedState === undefined && manifest.permissions?.persistence) {
    finalSavedState = getWidgetState(id);
  }

  const style = [
    `position: absolute`,
    `left: ${layout.x}px`,
    `top: ${layout.y}px`,
    `width: ${layout.width}px`,
    `height: ${layout.height}px`,
    `z-index: ${layout.zIndex}`,
    `opacity: ${layout.opacity}`,
    layout.borderRadius ? `border-radius: ${layout.borderRadius}px` : '',
    `overflow: ${layout.overflow}`,
    layout.blendMode ? `mix-blend-mode: ${layout.blendMode}` : '',
    layout.filter ? `filter: ${serializeFilter(layout.filter)}` : '',
    layout.transition ? `transition: ${layout.transition}` : '',
  ].filter(Boolean).join('; ');
  
  const dataAttrs = [
    `data-widget="${escapeAttr(widget_id)}"`,
    `data-instance="${escapeAttr(id)}"`,
    `data-config='${escapeAttr(JSON.stringify(config))}'`,
    `data-trust="${escapeAttr(manifest.trust)}"`,
    finalSavedState ? `data-state='${escapeAttr(JSON.stringify(finalSavedState))}'` : '',
    schedule ? `data-schedule='${escapeAttr(JSON.stringify({
      from: schedule.activeFrom, to: schedule.activeTo, days: schedule.days
    }))}'` : '',
    manifest.resources?.externalFonts?.length ? `data-fonts="${escapeAttr(manifest.resources.externalFonts.join(','))}"` : '',
  ].filter(Boolean).join(' ');
  
  if (manifest.trust === 'community') {
    return renderIframedWidget(instance, manifest, fragmentHTML, style, dataAttrs);
  } else {
    return renderInlineWidget(instance, manifest, fragmentHTML, style, dataAttrs);
  }
}

function getRequiredResources(canvas: CanvasConfig, registry: WidgetRegistryEntry[]): { scripts: string[]; fonts: string[]; } {
  const scripts = new Set<string>(['/media/libs/pi-widget.js']);
  const fonts = new Set<string>();
  
  for (const widget of canvas.widgets) {
    const entry = registry.find(r => r.id === widget.widget_id);
    if (!entry) continue;
    const manifest = entry.manifest;
    
    if (manifest.animations?.type?.includes('lottie')) {
      scripts.add('/media/libs/lottie.min.js');
    }
    
    for (const src of manifest.resources?.externalScripts || []) {
      if (src.startsWith('/media/libs/')) scripts.add(src);
    }
    
    for (const font of manifest.resources?.externalFonts || []) {
      fonts.add(font);
    }
  }
  
  return { scripts: [...scripts], fonts: [...fonts] };
}

export function composeHTML(
  canvas: CanvasConfig,
  registry: WidgetRegistryEntry[],
  savedStates: Record<string, any> = {}
): string {
  
  const sortedWidgets = [...canvas.widgets]
    .filter(w => w.enabled !== false)
    .sort((a, b) => a.layout.zIndex - b.layout.zIndex);

  const widgetContainers = sortedWidgets.map(instance => {
    const entry = registry.find(r => r.id === instance.widget_id);
    if (!entry) return '';
    return renderWidgetContainer(instance, entry.manifest, entry.fragmentHTML, savedStates[instance.id]);
  }).join('\\n');

  const resources = getRequiredResources(canvas, registry);

  const fontsHtml = resources.fonts.length > 0
    ? `<link href="https://fonts.googleapis.com/css2?family=${resources.fonts.map(f => f.replace(/ /g, '+')).join('&family=')}&display=swap" rel="stylesheet">`
    : '';

  const scriptsHtml = resources.scripts.map(src => `<script src="${src}?v=${Date.now()}"></script>`).join('\\n  ');

  const shadowDOMScript = `
    (function() {
      document.querySelectorAll('[data-widget]').forEach(function(container) {
        if (container.dataset.trust === 'community') return;
        if (!container.attachShadow) return;
        
        var shadow = container.attachShadow({ mode: 'open' });
        
        var fonts = container.dataset.fonts;
        if (fonts) {
          var link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://fonts.googleapis.com/css2?family=' + 
                      fonts.split(',').map(function(f) { return f.trim().replace(/ /g, '+'); }).join('&family=') +
                      '&display=swap';
          shadow.appendChild(link);
        }
        
        while (container.firstChild) {
          shadow.appendChild(container.firstChild);
        }
      });
    })();
  `;

  const scheduleCheckerScript = `
    (function scheduleLoop() {
      var tz = PiWidget.context.timezone;
      var currentHHMM = new Date().toLocaleTimeString('en-US', {
        timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit'
      });
      var today = new Date().toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' }).toLowerCase();
      
      document.querySelectorAll('[data-schedule]').forEach(function(el) {
        var sched = JSON.parse(el.getAttribute('data-schedule') || '{}');
        var dayOk = !sched.days || sched.days.indexOf(today) !== -1;
        var timeOk = true;
        if (sched.from && sched.to) {
          if (sched.from <= sched.to) {
            timeOk = currentHHMM >= sched.from && currentHHMM < sched.to;
          } else {
            timeOk = currentHHMM >= sched.from || currentHHMM < sched.to;
          }
        }
        el.style.display = (dayOk && timeOk) ? '' : 'none';
      });
      
      setTimeout(scheduleLoop, 30000);
    })();
  `;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PiDashboard</title>
  
  ${fontsHtml}
  ${scriptsHtml}
  
  <style>
    :root {
      ${(() => {
        const theme = (canvas as any).canvas?.theme?.vars || (canvas as any).theme?.vars || {};
        const defaults: Record<string, string> = {
          '--canvas-bg': canvas.canvas.background || '#0a0a0a',
          '--canvas-text': '#e0e0e0',
          '--canvas-accent': '#6366f1',
          '--canvas-surface': '#1a1a2e',
          '--canvas-border': '#2a2a3e',
          '--canvas-muted': '#888888',
        };
        const merged = { ...defaults, ...theme };
        return Object.entries(merged).map(([k, v]) => `${k}: ${v};`).join('\n      ');
      })()}
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { background: ${canvas.canvas.background}; }
    #kiosk-viewport { 
      position: relative; 
      width: ${canvas.canvas.width}px; 
      height: ${canvas.canvas.height}px; 
      overflow: hidden; 
    }
  </style>
</head>
<body>
  <div id="kiosk-viewport" data-canvas-id="${canvas.id}">
    ${widgetContainers}
  </div>
  
  <script>
    PiWidget.context.serverTimezone = 'UTC';
    PiWidget.context.canvasId = '${canvas.id}';
  </script>
  
  <script>${scheduleCheckerScript}</script>
  <script>${shadowDOMScript}</script>
  <script>
    (function() {
      function scaleViewport() {
        var vp = document.getElementById('kiosk-viewport');
        var w = window.innerWidth, h = window.innerHeight;
        var vw = ${canvas.canvas.width}, vh = ${canvas.canvas.height};
        var scale = Math.min(w / vw, h / vh);
        vp.style.transform = 'scale(' + scale + ')';
        vp.style.transformOrigin = 'top left';
        vp.style.position = 'absolute';
        vp.style.left = (w - vw * scale) / 2 + 'px';
        vp.style.top = (h - vh * scale) / 2 + 'px';
      }
      window.addEventListener('resize', scaleViewport);
      scaleViewport();
    })();
  </script>
  
  <!-- WebSocket client -->
  <script>
    (function() {
      var wsUrl = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/ws/display';
      var reconnectDelay = 1000;
      var maxDelay = 30000;
      
      function connect() {
        var ws = new WebSocket(wsUrl);
        window.__piWs = ws;
        
        ws.onopen = function() {
          reconnectDelay = 1000;
          ws.send(JSON.stringify({ type: 'hello', role: 'display', canvasId: window.PiWidget.context.canvasId }));
        };
        
        ws.onmessage = function(event) {
          try {
            var msg = JSON.parse(event.data);
            if (msg.type === 'state') {
              if (window.PiWidget && window.PiWidget._dispatchState) {
                window.PiWidget._dispatchState(msg.widget, msg.instance, msg.data);
              }
            } else if (msg.type === 'data') {
              // Legacy fallback
              if (window.PiWidget && window.PiWidget._dispatchState) {
                window.PiWidget._dispatchState(msg.widget, 'global', msg.data);
              }
            } else if (msg.type === 'reload') {
              window.location.reload();
            }
          } catch(e) {}
        };
        
        ws.onclose = function() {
          setTimeout(function() {
            reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
            connect();
          }, reconnectDelay);
        };
      }
      
      connect();
    })();
  </script>
  <script>
    if (window.PiWidget && window.PiWidget._startFrameLoop) {
      window.PiWidget._startFrameLoop(${canvas.canvas.fps});
    }
  </script>
</body>
</html>`;
}
