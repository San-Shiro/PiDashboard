import { existsSync, statSync } from "fs";
import { join } from "path";
import { login, logout, checkAuth, serializeCookie, parseCookies } from "./api/auth";
import { getActiveCanvas, publishCanvas, saveNamedCanvas, getSavedCanvases, deleteSavedCanvas } from "./api/canvas";
import { getSystemStats, setMaintenanceMode, getMaintenanceMode } from "./api/system";
import { getMediaList, uploadMedia, deleteMedia } from "./api/media";
import { composeHTML } from "./compositor/compose";

const PORT = 3000;
const ADMIN_DIST_DIR = join(process.cwd(), "admin", "dist");

// Connection registry for kiosk WebSockets
const kiosks = new Set<any>();

const server = Bun.serve({
  port: PORT,
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

    if (url.pathname === "/api/auth/status" && req.method === "GET") {
      const authenticated = checkAuth(req);
      return new Response(JSON.stringify({ authenticated }), {
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

      // System Endpoints
      if (url.pathname === "/api/system/stats" && req.method === "GET") {
        return new Response(JSON.stringify(getSystemStats()), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/system/state" && req.method === "GET") {
        return new Response(JSON.stringify({ maintenanceMode: getMaintenanceMode() }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === "/api/system/state" && req.method === "POST") {
        return req.json().then((body: any) => {
          const { maintenanceMode } = body;
          if (maintenanceMode === undefined) {
            return new Response(JSON.stringify({ error: "maintenanceMode property required" }), { status: 400 });
          }
          setMaintenanceMode(maintenanceMode);
          return new Response(JSON.stringify({ success: true }), {
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
    },
    close(ws) {
      kiosks.delete(ws);
    },
    message(ws, msg) {
      // Kiosk receiver-only
    }
  }
});

console.log(`[server] Host process listening on port ${PORT}...`);

export { server, kiosks };
