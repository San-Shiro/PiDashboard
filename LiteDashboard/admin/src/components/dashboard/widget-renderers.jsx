// Universal Widget Renderer using iframe sandbox to render Vanilla HTML fragments
import { useEffect, useState, useRef } from "react";

function getWidgetConfig(instance) {
  return instance?.config || instance?.widget_config || {};
}

export function WidgetRenderer({ instance, widgetData, now, themeVars }) {
  const iframeRef = useRef(null);
  const [html, setHtml] = useState("");
  const wid = instance.widget_id;
  const cfg = getWidgetConfig(instance);

  // Fetch HTML fragment when widget type changes
  useEffect(() => {
    let active = true;
    fetch(`/api/widgets/${wid}/fragment`)
      .then((res) => {
        if (!res.ok) throw new Error("Load failed");
        return res.text();
      })
      .then((text) => {
        if (active) setHtml(text);
      })
      .catch((err) => {
        if (active) setHtml(`<div style="color:#ef4444;padding:12px;font-size:12px;font-family:system-ui;">Failed to load widget fragment: ${err.message}</div>`);
      });
    return () => {
      active = false;
    };
  }, [wid]);

  // Update iframe contents whenever config, state, or data changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Resolve CSS variables from parent theme to pass down to iframe :root
    const getThemeVars = () => {
      if (themeVars) {
        return Object.entries(themeVars).map(([k, v]) => `${k}: ${v};`).join("\n");
      }
      const vars = {};
      const bodyStyles = getComputedStyle(document.body);
      const docStyles = getComputedStyle(document.documentElement);
      // Fallback standard canvas colors
      const defaults = {
        "--canvas-bg": "#0a0a0a",
        "--canvas-text": "#e0e0e0",
        "--canvas-accent": "#6366f1",
        "--canvas-surface": "#1a1a2e",
        "--canvas-border": "#2a2a3e",
        "--canvas-muted": "#888888",
      };
      Object.keys(defaults).forEach((key) => {
        const val = docStyles.getPropertyValue(key).trim() || bodyStyles.getPropertyValue(key).trim() || defaults[key];
        vars[key] = val;
      });
      return Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join("\n");
    };

    // Serialize widget object
    const widgetState = widgetData?.[wid] || instance.state || {};
    const scriptText = `
      (function() {
        window.PiWidget = {
          config: ${JSON.stringify(cfg)},
          state: ${JSON.stringify(widgetState)},
          data: ${JSON.stringify(widgetData || {})},
          context: {
            timezone: "${Intl.DateTimeFormat().resolvedOptions().timeZone}",
            locale: "${navigator.language}",
            is24h: ${!(new Date().toLocaleTimeString().match(/AM|PM/))},
            deviceType: "pointer",
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            colorScheme: "dark"
          },
          _stateHandlers: [],
          _registerAPI: function(instanceId, widgetType, api) {
            if (api && api.onState) {
              this._stateHandlers.push(api.onState);
              try { api.onState(this.state); } catch(e) { console.error(e); }
            }
            if (api && api.onData) {
              try { api.onData(this.data); } catch(e) { console.error(e); }
            }
          },
          _dispatchState: function(widgetType, instanceId, data) {
            this.state = data;
            for (var i = 0; i < this._stateHandlers.length; i++) {
              try { this._stateHandlers[i](data); } catch(e) {}
            }
          }
        };
      })();
    `;

    const wrappedHtml = html.replace(/<script>([\s\S]*?)<\/script>/gi, (match, p1) => {
      return `<script>(function(){\n  var container = document.getElementById("${instance.id}");\n  var root = container;\n  var $ = function(sel) { return root.querySelector(sel); };\n  var $$ = function(sel) { return root.querySelectorAll(sel); };\n  var widget = window.widget;\n${p1}\n})();</script>`;
    });

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          :root {
            ${getThemeVars()}
          }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html { color-scheme: dark; }
          html, body { width: 100%; height: 100%; overflow: hidden; background: transparent !important; }
          body { font-family: Inter, system-ui, sans-serif; color: var(--canvas-text); }
        </style>
        <script src="/media/libs/pi-theme.js"></script>
        <script src="/media/libs/pi-bind.js"></script>
        <script src="/media/libs/pi-widget.js"></script>
        <script>${scriptText}</script>
        <script>
          // Expose wrapper variables globally in the iframe
          var containerId = "${instance.id}";
          window.instanceId = containerId;
          window.widgetType = "${wid}";
          
          window.$ = function(sel) { 
            return document.querySelector(sel); 
          };
          window.$$ = function(sel) { 
            return document.querySelectorAll(sel); 
          };
          window.widget = {
            config: ${JSON.stringify(cfg)},
            state: ${JSON.stringify(widgetState)},
            patchState: function(delta) {
              console.log("[Preview PatchState]:", delta);
            }
          };
        </script>
      </head>
      <body>
        <div id="${instance.id}" style="width:100%; height:100%;">
          ${wrappedHtml}
        </div>
      </body>
      </html>
    `);
    doc.close();
    
    // Force transparency programmatically to ensure no browser default backgrounds interfere
    if (doc.body) {
      doc.body.style.setProperty('background', 'transparent', 'important');
      doc.body.style.setProperty('background-color', 'transparent', 'important');
    }
    if (doc.documentElement) {
      doc.documentElement.style.setProperty('background', 'transparent', 'important');
      doc.documentElement.style.setProperty('background-color', 'transparent', 'important');
    }
  }, [html, cfg, widgetData, themeVars]);

  if (!html) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
        Loading preview...
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      allowTransparency="true"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        background: "transparent",
        pointerEvents: "none",
      }}
      title={`Preview of ${wid}`}
    />
  );
}

// Dummy legacy exports to prevent compilation crashes in case they are referenced
export function ClockRenderer() { return null; }
export function ClockAnalogRenderer() { return null; }
export function ClockDigitalRenderer() { return null; }
export function WeatherRenderer() { return null; }
export function LyricsRenderer() { return null; }
export function SysinfoRenderer() { return null; }
export function AutomationRenderer() { return null; }
export function ImageRenderer() { return null; }
