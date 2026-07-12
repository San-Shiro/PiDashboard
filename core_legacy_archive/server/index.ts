import { existsSync, statSync, promises as fs } from "fs";
import { join } from "path";
import { login, logout, checkAuth, serializeCookie, parseCookies } from "./api/auth";
import { getActiveCanvas, publishCanvas, saveNamedCanvas, getSavedCanvases, getSavedCanvasById, updateSavedCanvas, deleteSavedCanvas } from "./api/canvas";
import { getSystemStats, setMaintenanceMode, getMaintenanceMode } from "./api/system";
import { getWidgetRegistry, getWidgetInstances, createWidgetInstance, updateWidgetInstance, deleteWidgetInstance } from "./api/widgets";
import { getMediaList, uploadMedia, deleteMedia } from "./api/media";
import { composeHTML } from "./compositor/compose";
import { startWidgetScheduler, stateCache } from "./api/scheduler";
import { initIpcDir, startIpcWatcher } from "./ipc/tmpfs-watcher";
import { logger } from "./utils/logger";
import { kiosks, pushReload, handleConnection, handleDisconnection, pushData } from "./ws/display";
import { registerGlobalErrorHandlers, apiHandler } from "./errors/handler";

const PORT = 3000;
const ADMIN_DIST_DIR = join(process.cwd(), "admin", "dist");

let isConfiguredCache: boolean | null = null;

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch: apiHandler(async (req: Request, server: any) => {
    const url = new URL(req.url);

    // 1. WebSocket Upgrade Pipeline
    if (url.pathname === "/ws/display") {
      const success = server.upgrade(req);
      if (success) return undefined;
      return new Response("WebSocket Upgrade Failed", { status: 400 });
    }

    // 2. Authentication API Endpoints
    if (url.pathname === "/api/auth/login" && req.method === "POST") {
      return req.json().then(async (body: any) => {
        const password = body.password;
        if (!password) {
          return new Response(JSON.stringify({ error: "Password required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        const token = await login(password);
        if (!token) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": serializeCookie("session_token", token, 604800) // 7 days
          }
        });
      }).catch(() => {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      });
    }

    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      const cookies = parseCookies(req.headers.get("cookie"));
      const token = cookies["session_token"];
      if (token) {
        logout(token);
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": serializeCookie("session_token", "", 0) // Expire cookie
        }
      });
    }

    if (url.pathname === "/api/auth/setup" && req.method === "POST") {
      return req.json().then(async (body: any) => {
        const password = body.password;
        if (!password || password.length < 4) {
          return new Response(JSON.stringify({ error: "Password must be at least 4 characters" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        const hash = await Bun.password.hash(password, { algorithm: "argon2id" });
        const { writeFileSync, mkdirSync } = require("fs");
        const secretsDir = join(process.cwd(), "secrets");
        mkdirSync(secretsDir, { recursive: true });
        writeFileSync(join(secretsDir, "admin.passhash"), hash, "utf8");
        isConfiguredCache = true;
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }).catch(() => {
        return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      });
    }

    if (url.pathname === "/api/auth/status" && req.method === "GET") {
      const authenticated = checkAuth(req);
      if (isConfiguredCache === null) {
        isConfiguredCache = require("fs").existsSync(join(process.cwd(), "secrets", "admin.passhash"));
      }
      return new Response(JSON.stringify({
        authenticated,
        isAuthenticated: authenticated,
        isConfigured: isConfiguredCache
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Protected Dashboard API Routes
    if (url.pathname.startsWith("/api/")) {
      // Security check
      if (!checkAuth(req)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Canvas Endpoints
      if (url.pathname === "/api/canvas/active" && req.method === "GET") {
        return new Response(JSON.stringify(getActiveCanvas()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/canvas/publish" && req.method === "POST") {
        return req.json().then((body: any) => {
          const ok = publishCanvas(body);
          if (ok) {
            // Restart scheduler for updated widgets set
            startWidgetScheduler();
            // Broadcast reload signal to active displays
            pushReload();
          }
          return new Response(JSON.stringify({ success: ok }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }).catch(() => new Response(JSON.stringify({ error: "Invalid canvas schema" }), { status: 400 }));
      }

      if (url.pathname === "/api/canvas/saved" && req.method === "GET") {
        return new Response(JSON.stringify(getSavedCanvases()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/canvas/save" && req.method === "POST") {
        return req.json().then((body: any) => {
          const { name, canvas } = body;
          if (!name || !canvas) {
            return new Response(JSON.stringify({ error: "Name and canvas properties required" }), { status: 400 });
          }
          const ok = saveNamedCanvas(name, canvas);
          return new Response(JSON.stringify({ success: ok }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }).catch(() => new Response(JSON.stringify({ error: "Invalid save payload" }), { status: 400 }));
      }

      if (url.pathname.startsWith("/api/canvas/saved/") && req.method === "DELETE") {
        const id = url.pathname.replace("/api/canvas/saved/", "");
        if (id) {
          const ok = deleteSavedCanvas(id);
          return new Response(JSON.stringify({ success: ok }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // Templates / Canvas presets endpoints
      if (url.pathname === "/api/templates" && req.method === "GET") {
        const list = getSavedCanvases().map((c: any) => {
          return {
            id: c.id,
            name: c.name || c.id,
            description: c.description || "",
            canvas_config: c.canvas_config || { width: c.width || 1280, height: c.height || 720, background: c.background || "#0a0a0a", displayTarget: c.displayTarget || "primary" },
            widget_count: c.widgets ? c.widgets.length : (c.widget_count || 0),
            updated_at: c.updated_at || new Date().toISOString(),
            is_active: false
          };
        });
        return new Response(JSON.stringify({ templates: list }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/templates" && req.method === "POST") {
        return req.json().then((body: any) => {
          const { name, description, canvas_config } = body;
          if (!name) {
            return new Response(JSON.stringify({ error: "Name required" }), { status: 400 });
          }
          const canvasData = {
            name,
            description: description || "",
            canvas_config: canvas_config || { width: 1920, height: 1080, background: "#0a0a0a", displayTarget: "primary" },
            widgets: [],
            widget_count: 0,
            updated_at: new Date().toISOString()
          };
          const ok = saveNamedCanvas(name, canvasData);
          return new Response(JSON.stringify({ success: ok }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }).catch(() => new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 }));
      }

      if (url.pathname.startsWith("/api/templates/") && url.pathname.endsWith("/apply") && req.method === "POST") {
        const id = url.pathname.replace("/api/templates/", "").replace("/apply", "");
        if (id) {
          const saved = getSavedCanvases();
          const target = saved.find((c: any) => c.id === id);
          if (target) {
            // Publish the saved canvas directly — preserve all fields including canvas_config
            const ok = publishCanvas(target);
            if (ok) {
              // Restart scheduler for updated widgets set
              startWidgetScheduler();
            }
            return new Response(JSON.stringify({ success: ok }), {
              status: ok ? 200 : 500,
              headers: { "Content-Type": "application/json" }
            });
          }
          return new Response(JSON.stringify({ error: "Canvas not found" }), { status: 404 });
        }
      }

      // GET single canvas by ID
      if (url.pathname.match(/^\/api\/templates\/[^/]+$/) && req.method === "GET") {
        const id = url.pathname.replace("/api/templates/", "");
        const canvas = getSavedCanvasById(id);
        if (canvas) {
          return new Response(JSON.stringify(canvas), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ error: "Canvas not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }

      // PUT update entire canvas
      if (url.pathname.match(/^\/api\/templates\/[^/]+$/) && req.method === "PUT") {
        const id = url.pathname.replace("/api/templates/", "");
        return req.json().then((body: any) => {
          const ok = updateSavedCanvas(id, body);
          if (ok) {
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          return new Response(JSON.stringify({ error: "Canvas not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        }).catch(() => new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { "Content-Type": "application/json" } }));
      }

      // DELETE canvas
      if (url.pathname.match(/^\/api\/templates\/[^/]+$/) && req.method === "DELETE") {
        const id = url.pathname.replace("/api/templates/", "");
        if (id) {
          const ok = deleteSavedCanvas(id);
          return new Response(JSON.stringify({ success: ok }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // Per-canvas widget operations
      // POST add widget to a canvas
      if (url.pathname.match(/^\/api\/templates\/[^/]+\/add-widget$/) && req.method === "POST") {
        const id = url.pathname.replace("/api/templates/", "").replace("/add-widget", "");
        return req.json().then((body: any) => {
          const canvas = getSavedCanvasById(id);
          if (!canvas) return new Response(JSON.stringify({ error: "Canvas not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
          const widgetRegistry = getWidgetRegistry();
          const manifest = widgetRegistry.find((w: any) => w.id === body.widget_id);
          if (!manifest) return new Response(JSON.stringify({ error: "Widget not found in registry" }), { status: 404, headers: { "Content-Type": "application/json" } });

          // Build default config from schema
          const widgetConfig: Record<string, any> = {};
          if (Array.isArray(manifest.configSchema)) {
            manifest.configSchema.forEach((field: any) => {
              if (field.key && field.default !== undefined) widgetConfig[field.key] = field.default;
            });
          }
          const canvasW = canvas.canvas_config?.width || canvas.width || 1920;
          const canvasH = canvas.canvas_config?.height || canvas.height || 1080;
          const newInstance = {
            id: `${body.widget_id}_${Date.now()}`,
            widget_id: body.widget_id,
            label: manifest.name || body.widget_id,
            enabled: true,
            base_config: { x: 0, y: 0, width: Math.min(320, canvasW), height: Math.min(240, canvasH), zIndex: 1, opacity: 1, activeFrom: "00:00", activeTo: "23:59" },
            widget_config: widgetConfig
          };
          if (!canvas.widgets) canvas.widgets = [];
          canvas.widgets.push(newInstance);
          canvas.widget_count = canvas.widgets.length;
          const ok = updateSavedCanvas(id, canvas);
          return new Response(JSON.stringify({ success: ok, instance: { ...newInstance, manifest } }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }).catch(() => new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { "Content-Type": "application/json" } }));
      }

      // PATCH update widget instance inside a canvas
      if (url.pathname.match(/^\/api\/templates\/[^/]+\/widget\/[^/]+$/) && req.method === "PATCH") {
        const parts = url.pathname.replace("/api/templates/", "").split("/widget/");
        const canvasId = parts[0];
        const widgetInstanceId = parts[1];
        return req.json().then((body: any) => {
          const canvas = getSavedCanvasById(canvasId);
          if (!canvas) return new Response(JSON.stringify({ error: "Canvas not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
          const widgets = canvas.widgets || [];
          const idx = widgets.findIndex((w: any) => w.id === widgetInstanceId);
          if (idx === -1) return new Response(JSON.stringify({ error: "Widget instance not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
          const existing = widgets[idx];
          widgets[idx] = {
            ...existing,
            label: body.label !== undefined ? body.label : existing.label,
            enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
            base_config: body.base_config ? { ...existing.base_config, ...body.base_config } : existing.base_config,
            widget_config: body.widget_config ? { ...existing.widget_config, ...body.widget_config } : existing.widget_config
          };
          canvas.widgets = widgets;
          const ok = updateSavedCanvas(canvasId, canvas);
          return new Response(JSON.stringify({ success: ok, instance: widgets[idx] }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }).catch(() => new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { "Content-Type": "application/json" } }));
      }

      // DELETE widget instance from a canvas
      if (url.pathname.match(/^\/api\/templates\/[^/]+\/widget\/[^/]+$/) && req.method === "DELETE") {
        const parts = url.pathname.replace("/api/templates/", "").split("/widget/");
        const canvasId = parts[0];
        const widgetInstanceId = parts[1];
        const canvas = getSavedCanvasById(canvasId);
        if (!canvas) return new Response(JSON.stringify({ error: "Canvas not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        canvas.widgets = (canvas.widgets || []).filter((w: any) => w.id !== widgetInstanceId);
        canvas.widget_count = canvas.widgets.length;
        const ok = updateSavedCanvas(canvasId, canvas);
        return new Response(JSON.stringify({ success: ok }), {
          status: ok ? 200 : 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Widget Registry & Instances Endpoints
      if (url.pathname === "/api/widgets/registry" && req.method === "GET") {
        return new Response(JSON.stringify({ widgets: getWidgetRegistry() }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/widgets/instances" && req.method === "GET") {
        return new Response(JSON.stringify({ instances: getWidgetInstances() }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/widgets/instances" && req.method === "POST") {
        return req.json().then((body: any) => {
          const { widget_id } = body;
          if (!widget_id) {
            return new Response(JSON.stringify({ error: "widget_id required" }), { status: 400 });
          }
          const inst = createWidgetInstance(widget_id);
          return new Response(JSON.stringify(inst), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }).catch((e: Error) => new Response(JSON.stringify({ error: e.message }), { status: 400 }));
      }

      if (url.pathname.startsWith("/api/widgets/instances/") && req.method === "PATCH") {
        const id = url.pathname.replace("/api/widgets/instances/", "");
        if (id) {
          return req.json().then((body: any) => {
            const inst = updateWidgetInstance(id, body);
            return new Response(JSON.stringify(inst), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }).catch((e: Error) => new Response(JSON.stringify({ error: e.message }), { status: 400 }));
        }
      }

      if (url.pathname.startsWith("/api/widgets/instances/") && req.method === "DELETE") {
        const id = url.pathname.replace("/api/widgets/instances/", "");
        if (id) {
          const ok = deleteWidgetInstance(id);
          return new Response(JSON.stringify({ success: ok }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }

      // System Endpoints
      if (url.pathname === "/api/system/stats" && req.method === "GET") {
        return new Response(JSON.stringify(getSystemStats()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/system/wifi" && req.method === "GET") {
        return new Response(JSON.stringify({
          current: null,
          networks: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/system/bluetooth" && req.method === "GET") {
        return new Response(JSON.stringify({
          enabled: false,
          devices: []
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/system/state" && req.method === "GET") {
        return new Response(JSON.stringify({
          maintenanceMode: getMaintenanceMode(),
          maintenance_mode: getMaintenanceMode(),
          display_enabled: true
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/system/state" && (req.method === "POST" || req.method === "PATCH")) {
        return req.json().then((body: any) => {
          const maintenanceMode = body.maintenanceMode !== undefined ? body.maintenanceMode : body.maintenance_mode;
          if (maintenanceMode !== undefined) {
            setMaintenanceMode(maintenanceMode);
          }
          return new Response(JSON.stringify({
            success: true,
            display_enabled: body.display_enabled !== undefined ? body.display_enabled : true
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }).catch(() => new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 }));
      }

      // Media Endpoints
      if (url.pathname === "/api/media" && req.method === "GET") {
        return new Response(JSON.stringify(getMediaList()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/media/upload" && req.method === "POST") {
        return req.formData().then(async (form: any) => {
          const file = form.get("file");
          const ok = await uploadMedia(file);
          return new Response(JSON.stringify(ok), {
            status: ok.success ? 200 : 400,
            headers: { "Content-Type": "application/json" }
          });
        }).catch((e: Error) => new Response(JSON.stringify({ success: false, error: e.message }), { status: 400 }));
      }

      if (url.pathname.startsWith("/api/media/") && req.method === "DELETE") {
        const filename = decodeURIComponent(url.pathname.replace("/api/media/", ""));
        if (filename) {
          const ok = deleteMedia(filename);
          return new Response(JSON.stringify({ success: ok }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    }

    // 4. Composed Kiosk Display Route
    if (url.pathname === "/display/main" && req.method === "GET") {
      const html = composeHTML();
      return new Response(html, {
        headers: { "Content-Type": "text/html" }
      });
    }

    // 5. Statically Serve Uploaded Media Files
    if (url.pathname.startsWith("/media/")) {
      const filename = decodeURIComponent(url.pathname.replace("/media/", ""));
      const filePath = join(process.cwd(), "media", "uploads", filename);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          return new Response(Bun.file(filePath));
        }
      } catch (e) {}
    }

    // 6. Fallback Static Client Assets Host (Vite admin/dist or minimal dashboard)
    let filePath = join(ADMIN_DIST_DIR, url.pathname === "/" ? "index.html" : url.pathname);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        return new Response(Bun.file(filePath));
      }
    } catch (e) {}

    // SPA fallback — serve index.html for all client-side routes
    // (e.g. /canvas/:id/edit) that aren't API, display, media, or ws routes
    if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/display/") && !url.pathname.startsWith("/media/") && !url.pathname.startsWith("/ws/")) {
      const spaPath = join(ADMIN_DIST_DIR, "index.html");
      try {
        const stat = await fs.stat(spaPath);
        if (stat.isFile()) {
          return new Response(Bun.file(spaPath), {
            headers: { "Content-Type": "text/html" }
          });
        }
      } catch (e) {}
    }

    // Fallback if client bundle is not compiled yet
    if (url.pathname === "/") {
      return new Response(
        "<html><body><h1>PiDashboard Admin Web Server</h1><p>Static admin web panel compiles in Phase C. Access core services at <code>/display/main</code> or <code>/api/auth/status</code>.</p></body></html>",
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  }),
  websocket: {
    open(ws) {
      handleConnection(ws);

      // State Hydration: instantly push latest cached state of all widgets
      stateCache.forEach((data, widgetId) => {
        try {
          ws.send(JSON.stringify({
            type: "data",
            widget: widgetId,
            data
          }));
        } catch (e) {}
      });
    },
    close(ws) {
      handleDisconnection(ws);
    },
    message(ws, msg) {
      // Kiosk receiver-only
    }
  }
});

// Initialize IPC RAM-disk directory, scheduler timers, and folder watcher
initIpcDir();
startWidgetScheduler();
registerGlobalErrorHandlers();

startIpcWatcher((widgetId, data) => {
  pushData(widgetId, data);
});

logger.info("SERVER", `Host process listening on port ${PORT}...`);

export { server };
