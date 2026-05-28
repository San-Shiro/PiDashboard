import { existsSync, statSync } from "fs";
import { join } from "path";
import { login, logout, checkAuth, serializeCookie, parseCookies } from "./api/auth";
import { configManager } from "./config/manager";

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

    // 3. Composed Kiosk Display Route (Placeholder until Wave 2 compositor)
    if (url.pathname === "/display/main" && req.method === "GET") {
      return new Response(
        "<html><body><h1>PiDashboard Compositor Core</h1><p>Compositor initialized. Dynamic layout composition template mounts in Wave 2.</p></body></html>",
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // 4. Fallback Static Client Assets Host (Vite admin/dist or minimal dashboard)
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
