import { existsSync, statSync } from "fs";
import { join } from "path";
import { login, logout, checkAuth, serializeCookie, parseCookies } from "./api/auth";
import { getActiveCanvas, publishCanvas, saveNamedCanvas, getSavedCanvases, deleteSavedCanvas } from "./api/canvas";
import { getSystemStats, setMaintenanceMode, getMaintenanceMode } from "./api/system";
import { getMediaList, uploadMedia, deleteMedia } from "./api/media";
import { getWidgetRegistry, getWidgetInstances, createWidgetInstance, updateWidgetInstance, deleteWidgetInstance } from "./api/widgets";
import { composeHTML } from "./compositor/compose";
import { initIpcDir, startWidgetScheduler, startIpcWatcher, stateCache } from "./api/scheduler";
import { logger } from "./utils/logger";

const PORT = 3000;
const ADMIN_DIST_DIR = join(process.cwd(), "admin", "dist");

// Connection registry for kiosk WebSockets
const kiosks = new Set<any>();

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch(req, server) {
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
        const { writeFileSync } = require("fs");
        writeFileSync(join(process.cwd(), "secrets", "admin.passhash"), hash, "utf8");
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
      const configured = require("fs").existsSync(join(process.cwd(), "secrets", "admin.passhash"));
      return new Response(JSON.stringify({
        authenticated,
        isAuthenticated: authenticated,
        isConfigured: configured
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
            kiosks.forEach((ws) => {
              try {
                ws.send(JSON.stringify({ type: "reload" }));
              } catch (e) {}
            });
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
          const activeCanvas = getActiveCanvas();
          const widgets = activeCanvas.widgets || [];
          const canvasData = {
            name,
            description: description || "",
            canvas_config,
            widgets,
            widget_count: widgets.length,
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
            const activeData = {
              name: target.name || target.id,
              width: target.canvas_config?.width || target.width || 1280,
              height: target.canvas_config?.height || target.height || 720,
              background: target.canvas_config?.background || target.background || "#0a0a0a",
              displayTarget: target.canvas_config?.displayTarget || target.displayTarget || "primary",
              widgets: target.widgets || []
            };
            const ok = publishCanvas(activeData);
            if (ok) {
              // Restart scheduler for updated widgets set
              startWidgetScheduler();
              // Broadcast reload signal to active displays
              kiosks.forEach((ws) => {
                try {
                  ws.send(JSON.stringify({ type: "reload" }));
                } catch (e) {}
              });
            }
            return new Response(JSON.stringify({ success: ok }), {
              status: ok ? 200 : 500,
              headers: { "Content-Type": "application/json" }
            });
          }
          return new Response(JSON.stringify({ error: "Canvas not found" }), { status: 404 });
        }
      }

      if (url.pathname.startsWith("/api/templates/") && req.method === "DELETE") {
        const id = url.pathname.replace("/api/templates/", "");
        if (id) {
          const ok = deleteSavedCanvas(id);
          return new Response(JSON.stringify({ success: ok }), {
            status: ok ? 200 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }
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
          current: {
            ssid: "HomeWiFi",
            ip: "192.168.1.15",
            signal: 84
          },
          networks: [
            { ssid: "HomeWiFi", connected: true, secured: true, signal: 84 },
            { ssid: "Guest_Network", connected: false, secured: true, signal: 55 },
            { ssid: "CoffeeShop", connected: false, secured: false, signal: 35 }
          ]
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/system/bluetooth" && req.method === "GET") {
        return new Response(JSON.stringify({
          enabled: true,
          devices: [
            { name: "Logitech MX Master", mac: "AA:BB:CC:DD:EE:FF", connected: true, paired: true },
            { name: "Bose QC35 II", mac: "11:22:33:44:55:66", connected: false, paired: true },
            { name: "Pixel 8 Pro", mac: "99:88:77:66:55:44", connected: false, paired: false }
          ]
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
        const filename = url.pathname.replace("/api/media/", "");
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
      const filename = url.pathname.replace("/media/", "");
      const filePath = join(process.cwd(), "media", "uploads", filename);
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        return new Response(Bun.file(filePath));
      }
    }

    // 6. Fallback Static Client Assets Host (Vite admin/dist or minimal dashboard)
    let filePath = join(ADMIN_DIST_DIR, url.pathname === "/" ? "index.html" : url.pathname);
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      return new Response(Bun.file(filePath));
    }

    // Fallback if client bundle is not compiled yet
    if (url.pathname === "/") {
      return new Response(
        "<html><body><h1>PiDashboard Admin Web Server</h1><p>Static admin web panel compiles in Phase C. Access core services at <code>/display/main</code> or <code>/api/auth/status</code>.</p></body></html>",
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
  websocket: {
    open(ws) {
      kiosks.add(ws);
      logger.info("WEBSOCKET", `Kiosk connected successfully. Active: ${kiosks.size}`);

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
      kiosks.delete(ws);
      logger.info("WEBSOCKET", `Kiosk disconnected. Active: ${kiosks.size}`);
    },
    message(ws, msg) {
      // Kiosk receiver-only
    }
  }
});

// Initialize IPC RAM-disk directory, scheduler timers, and folder watcher
initIpcDir();
startWidgetScheduler();

startIpcWatcher((widgetId, data) => {
  const packet = JSON.stringify({ type: "data", widget: widgetId, data });
  kiosks.forEach((ws) => {
    try {
      ws.send(packet);
    } catch (e) {}
  });
});

logger.info("SERVER", `Host process listening on port ${PORT}...`);

export { server, kiosks };
