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
    fetch(`/api/widgets/${wid}/fragment?t=${Date.now()}`)
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

  // Render initial iframe DOM
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Resolve CSS variables from parent theme
    const getThemeVars = () => {
      if (themeVars) {
        return Object.entries(themeVars).map(([k, v]) => `${k}: ${v};`).join("\n");
      }
      const vars = {};
      const bodyStyles = getComputedStyle(document.body);
      const docStyles = getComputedStyle(document.documentElement);
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
        <script>
          window.instanceId = "${instance.id}";
          window.widgetType = "${wid}";
          window.$ = function(sel) { return document.querySelector(sel); };
          window.$$ = function(sel) { return document.querySelectorAll(sel); };
          window.widget = {
            config: ${JSON.stringify(cfg)},
            state: {},
            data: {},
            patchState: function(delta) { console.log("[Preview PatchState]:", delta); },
            register: function(api) {
              if (window.PiWidget && window.PiWidget._registerAPI) {
                window.PiWidget._registerAPI(window.instanceId, window.widgetType, api);
              }
            }
          };
          window.PiWidget.context = {
            timezone: "${Intl.DateTimeFormat().resolvedOptions().timeZone}",
            locale: "${navigator.language}",
            is24h: ${!(new Date().toLocaleTimeString().match(/AM|PM/))},
            deviceType: "pointer",
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            colorScheme: "dark"
          };
          
          window.addEventListener('message', function(e) {
            if (!e.data || !e.data.type) return;
            if (e.data.type === 'pi_update') {
              if (e.data.config) {
                window.widget.config = e.data.config;
                if (window.PiWidget && window.PiWidget._dispatchRefresh) {
                  window.PiWidget._dispatchRefresh(window.widgetType, window.instanceId, e.data.config);
                }
              }
              if (e.data.state) {
                window.widget.state = e.data.state;
                if (window.PiWidget && window.PiWidget._dispatchState) {
                  window.PiWidget._dispatchState(window.widgetType, window.instanceId, e.data.state);
                }
              }
              if (e.data.data) {
                window.widget.data = e.data.data;
                if (window.PiWidget && window.PiWidget._dispatchData) {
                  window.PiWidget._dispatchData(window.widgetType, window.instanceId, e.data.data);
                }
              }
            }
          });
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
    
    if (doc.body) {
      doc.body.style.setProperty('background', 'transparent', 'important');
      doc.body.style.setProperty('background-color', 'transparent', 'important');
    }
    if (doc.documentElement) {
      doc.documentElement.style.setProperty('background', 'transparent', 'important');
      doc.documentElement.style.setProperty('background-color', 'transparent', 'important');
    }
  }, [html, themeVars]); // Only rewrite iframe when HTML template or theme changes

  // Push config/state updates via postMessage
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    
    let widgetState = widgetData?.[wid] || instance.state || {};
    if (widgetData?.[wid] && widgetData[wid][instance.id] !== undefined) {
      widgetState = widgetData[wid][instance.id];
    }
    
    iframe.contentWindow.postMessage({
      type: 'pi_update',
      config: cfg,
      state: widgetState,
      data: widgetData || {}
    }, '*');
  }, [cfg, widgetData, instance.id, wid]);

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
