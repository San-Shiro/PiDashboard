import fs from 'fs/promises';
import path from 'path';
import { Plugin } from 'vite';

export function localApiPlugin(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        const method = req.method;

        const baseDir = path.resolve(__dirname, '..');
        const canvasesDir = path.join(baseDir, 'canvases');
        const widgetsDir = path.join(baseDir, 'widgets');

        // Helper to send JSON
        const sendJSON = (data: any, status = 200) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        try {
          if ((pathname === '/api/canvases' || pathname === '/api/templates') && method === 'GET') {
            const files = await fs.readdir(canvasesDir);
            const canvases = await Promise.all(
              files.filter(f => f.endsWith('.json')).map(async f => {
                const content = await fs.readFile(path.join(canvasesDir, f), 'utf-8');
                return JSON.parse(content);
              })
            );
            return sendJSON({ canvases, templates: canvases });
          }

          if (pathname.match(/^\/api\/templates\/(.+)$/) && method === 'GET') {
            const match = pathname.match(/^\/api\/templates\/(.+)$/);
            const id = match ? match[1] : '';
            const filePath = path.join(canvasesDir, `${id}.json`);
            if (await fs.stat(filePath).catch(() => false)) {
              const content = await fs.readFile(filePath, 'utf-8');
              return sendJSON(JSON.parse(content));
            } else {
              return sendJSON({ error: 'Not found' }, 404);
            }
          }

          if (pathname.match(/^\/api\/templates\/(.+)$/) && method === 'PUT') {
            const match = pathname.match(/^\/api\/templates\/(.+)$/);
            const id = match ? match[1] : '';
            
            const buffers: Buffer[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const body = Buffer.concat(buffers).toString();
            
            const filePath = path.join(canvasesDir, `${id}.json`);
            await fs.writeFile(filePath, JSON.stringify(JSON.parse(body), null, 2), 'utf-8');
            return sendJSON({ success: true });
          }

          if (pathname === '/api/templates' && method === 'POST') {
            const buffers: Buffer[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const body = JSON.parse(Buffer.concat(buffers).toString());
            const id = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
            const filePath = path.join(canvasesDir, `${id}.json`);
            const payload = {
              id,
              name: body.name,
              description: body.description,
              canvas_config: body.canvas_config,
              widgets: [],
              widget_count: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_active: false
            };
            await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
            return sendJSON(payload);
          }

          if (pathname === '/api/widgets/registry' && method === 'GET') {
            const folders = await fs.readdir(widgetsDir);
            const widgets = [];
            for (const folder of folders) {
              if (folder.startsWith('.') || folder.startsWith('_')) continue;
              const manifestPath = path.join(widgetsDir, folder, 'manifest.json');
              if (await fs.stat(manifestPath).catch(() => false)) {
                const content = await fs.readFile(manifestPath, 'utf-8');
                widgets.push(JSON.parse(content));
              }
            }
            return sendJSON({ widgets });
          }

          // System Stats mock for the sidebar
          if (pathname === '/api/system/stats' && method === 'GET') {
            return sendJSON({
              cpu_percent: Math.random() * 20 + 5,
              mem_percent: 45,
              mem_used_mb: 230,
              mem_total_mb: 512,
            });
          }

          if (pathname === '/api/media' && method === 'GET') {
            return sendJSON({ files: [] }); // TODO: read media dir
          }

          if (pathname === '/api/system/state' && method === 'GET') {
            return sendJSON({ maintenance_mode: false, display_enabled: true });
          }

          if (pathname === '/api/system/state' && method === 'PATCH') {
            return sendJSON({ success: true });
          }

          if (pathname === '/api/system/wifi' && method === 'GET') {
            return sendJSON({
              current: { ssid: "PiNetwork_5G", ip: "192.168.1.144", signal: 85 },
              networks: [
                { ssid: "HomeWifi_2.4G", signal: 60, secured: true, connected: false },
                { ssid: "Guest_Network", signal: 35, secured: false, connected: false }
              ]
            });
          }

          if (pathname === '/api/system/bluetooth' && method === 'GET') {
            return sendJSON({
              enabled: true,
              devices: [
                { name: "Bluetooth Speaker", mac: "00:1A:7D:DA:71:13", paired: true, connected: true },
                { name: "My Phone", mac: "44:55:66:77:88:99", paired: true, connected: false },
                { name: "Unknown Device", mac: "FF:EE:DD:CC:BB:AA", paired: false, connected: false }
              ]
            });
          }

          if (pathname === '/api/auth/status' && method === 'GET') {
            return sendJSON({ isConfigured: true, isAuthenticated: true });
          }

          if (pathname === '/api/auth/logout' && method === 'POST') {
            return sendJSON({ success: true });
          }

          // If no route matches, next()
          return next();
        } catch (error: any) {
          console.error('[localApiPlugin] Error:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    }
  };
}
