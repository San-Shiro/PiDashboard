import { existsSync, readFileSync, readdirSync, lstatSync } from "fs";
import { join } from "path";

// In-memory HTML fragment cache to avoid thrashing low-performance SD cards
const fragmentCache = new Map<string, string>();

/**
 * Scan all subfolders inside the widgets/ directory and cache fragment files in RAM based on manifest entrypoints
 */
export function cacheWidgetFragments(): void {
  const widgetsDir = join(process.cwd(), "widgets");
  if (!existsSync(widgetsDir)) return;

  try {
    const folders = readdirSync(widgetsDir);
    folders.forEach((folder) => {
      if (folder.startsWith("_") || folder.startsWith(".")) return;
      const widgetPath = join(widgetsDir, folder);
      if (!lstatSync(widgetPath).isDirectory()) return;

      const manifestPath = join(widgetPath, "manifest.json");
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
          const fragmentRelativePath = manifest.entrypoints?.fragment;
          if (fragmentRelativePath) {
            const fullFragmentPath = join(widgetPath, fragmentRelativePath);
            if (existsSync(fullFragmentPath)) {
              const content = readFileSync(fullFragmentPath, "utf8");
              fragmentCache.set(folder, content);
              return;
            }
          }
        } catch (e) {
          console.warn(`[compositor] Manifest parse error for ${folder}: ${(e as Error).message}`);
        }
      }

      // Fallback: search fragment/*.html if no manifest or missing fragment entrypoint
      const fragmentDir = join(widgetPath, "fragment");
      if (existsSync(fragmentDir)) {
        const files = readdirSync(fragmentDir);
        const htmlFile = files.find((f) => f.endsWith(".html"));
        if (htmlFile) {
          const content = readFileSync(join(fragmentDir, htmlFile), "utf8");
          fragmentCache.set(folder, content);
        }
      }
    });
    console.log(`[compositor] Cached ${fragmentCache.size} widget fragments in RAM.`);
  } catch (e) {
    console.error(`[compositor] Fragment caching failed: ${(e as Error).message}`);
  }
}

// Initial scan on import
cacheWidgetFragments();

/**
 * Reads layout schema and compiles complete standalone HTML document string
 */
export function composeHTML(): string {
  const activeCanvasPath = join(process.cwd(), "canvases", "active.json");
  let canvas = { name: "Default", width: 1920, height: 1080, widgets: [] as any[] };

  try {
    if (existsSync(activeCanvasPath)) {
      canvas = JSON.parse(readFileSync(activeCanvasPath, "utf8"));
    }
  } catch (e) {
    console.error(`[compositor] Failed to read active canvas, using fallback: ${(e as Error).message}`);
  }

  const chunks: string[] = [];

  // 1. DocType and styling declarations
  chunks.push(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PiDashboard Kiosk Kiosk Display</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100vw; height: 100vh; overflow: hidden; background-color: #0d1117; font-family: system-ui, sans-serif; color: #ffffff; }
    #kiosk-viewport { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    #canvas-container { position: absolute; transform-origin: top left; transition: transform 0.2s ease, left 0.2s ease, top 0.2s ease; background-color: #161b22; overflow: hidden; }
    #maintenance-screen { position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; display: none; flex-direction: column; align-items: center; justify-content: center; background-color: #0b0d10; z-index: 99999; text-align: center; }
    #maintenance-screen h1 { font-size: 3rem; margin-bottom: 1rem; color: #ff7b72; }
    #maintenance-screen p { font-size: 1.25rem; color: #8b949e; }
  </style>
</head>
<body>
  <div id="kiosk-viewport">
    <div id="canvas-container" data-width="${canvas.width}" data-height="${canvas.height}" style="width: ${canvas.width}px; height: ${canvas.height}px;">
  `);

  // 2. Wrap widgets inside absolute positioning wrappers
  canvas.widgets.forEach((widget: any) => {
    const fragment = fragmentCache.get(widget.widgetId) || `<div>Widget "${widget.widgetId}" Not Cached</div>`;
    const position = widget.position || { x: 0, y: 0, w: 300, h: 200, z: 1, o: 1 };
    const configString = JSON.stringify(widget.config || {}).replace(/'/g, "&apos;");

    chunks.push(`
      <div data-widget="${widget.widgetId}" data-config='${configString}'
           style="position: absolute; left: ${position.x}px; top: ${position.y}px; width: ${position.w}px; height: ${position.h}px; z-index: ${position.z || 1}; opacity: ${position.o ?? 1}; overflow: hidden;">
        ${fragment}
      </div>
    `);
  });

  // 3. Mount viewport auto-centering script and websocket connections
  chunks.push(`
    </div>
  </div>
  
  <div id="maintenance-screen">
    <h1>System Maintenance</h1>
    <p>PiDashboard is currently in maintenance mode. Please wait for kiosk resumes.</p>
  </div>

  <script>
    (function() {
      // 1. Viewport auto-centering scale calculations
      const canvas = document.getElementById("canvas-container");
      
      function scaleViewport() {
        if (!canvas) return;
        const parentW = window.innerWidth;
        const parentH = window.innerHeight;
        const canvasW = parseInt(canvas.dataset.width || "1920");
        const canvasH = parseInt(canvas.dataset.height || "1080");

        const scaleX = parentW / canvasW;
        const scaleY = parentH / canvasH;
        const scale = Math.min(scaleX, scaleY);

        canvas.style.transform = "scale(" + scale + ")";
        canvas.style.left = ((parentW - canvasW * scale) / 2) + "px";
        canvas.style.top = ((parentH - canvasH * scale) / 2) + "px";
      }

      window.addEventListener("resize", scaleViewport);
      scaleViewport();

      // 2. WebSocket listener for reload/data push messaging
      const WS_URL = "ws://" + location.host + "/ws/display";
      let ws;

      function connectWS() {
        ws = new WebSocket(WS_URL);
        ws.onmessage = function(event) {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "reload") {
              location.reload();
            } else if (msg.type === "maintenance") {
              const maint = document.getElementById("maintenance-screen");
              const viewport = document.getElementById("kiosk-viewport");
              if (msg.enabled) {
                if (maint) maint.style.display = "flex";
                if (viewport) viewport.style.display = "none";
              } else {
                location.reload();
              }
            } else if (msg.type === "data" && window.__widgetUpdaters) {
              const updater = window.__widgetUpdaters[msg.widget];
              if (updater) updater(msg.data);
            }
          } catch(e) {
            console.error("WS error parsing:", e);
          }
        };
        ws.onclose = function() { setTimeout(connectWS, 3000); };
        ws.onerror = function() { ws.close(); };
      }
      connectWS();
    })();
  </script>
</body>
</html>
  `);

  return chunks.join("");
}
