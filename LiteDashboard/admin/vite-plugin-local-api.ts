import fs from 'fs/promises';
import path from 'path';
import { Plugin } from 'vite';

export function localApiPlugin(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/') && !req.url?.startsWith('/weather/')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);
        const pathname = url.pathname;
        const method = req.method;

        const baseDir = path.resolve(__dirname, '..');
        const canvasesDir = path.join(baseDir, 'canvases');
        const widgetsDir = path.join(baseDir, 'widgets');
        const activeWidgetsPath = path.join(baseDir, 'config', 'active-widgets.json');

        const getActiveWidgetSet = async () => {
          if (!(await fs.stat(activeWidgetsPath).catch(() => false))) return null;
          try {
            const raw = await fs.readFile(activeWidgetsPath, 'utf-8');
            const parsed = JSON.parse(raw);
            const ids = Array.isArray(parsed?.activeWidgets) ? parsed.activeWidgets : [];
            const clean = ids.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0);
            return clean.length ? new Set(clean) : null;
          } catch {
            return null;
          }
        };

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
            const activeWidgets = await getActiveWidgetSet();
            const folders = await fs.readdir(widgetsDir);
            const widgets = [];
            for (const folder of folders) {
              if (folder.startsWith('.') || folder.startsWith('_')) continue;
              const manifestPath = path.join(widgetsDir, folder, 'manifest.json');
              if (await fs.stat(manifestPath).catch(() => false)) {
                const content = await fs.readFile(manifestPath, 'utf-8');
                const manifest = JSON.parse(content);
                if (activeWidgets && !activeWidgets.has(manifest.id)) continue;
                widgets.push(manifest);
              }
            }
            return sendJSON({ widgets });
          }

          if (pathname === '/weather/search' && method === 'GET') {
            const q = String(url.searchParams.get('q') || '').toLowerCase();
            const seed = [
              { name: 'Mumbai', admin1: 'Maharashtra', country: 'India', latitude: 19.076, longitude: 72.8777, timezone: 'Asia/Kolkata' },
              { name: 'Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' },
              { name: 'Kolkata', admin1: 'West Bengal', country: 'India', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata' },
              { name: 'London', admin1: 'England', country: 'United Kingdom', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' },
            ];
            const results = seed
              .filter((item) => !q || `${item.name} ${item.admin1} ${item.country}`.toLowerCase().includes(q))
              .map((item) => ({ ...item, label: [item.name, item.admin1, item.country].filter(Boolean).join(', ') }));
            return sendJSON({ results });
          }

          if (pathname === '/weather/current' && method === 'GET') {
            const units = url.searchParams.get('units') === 'fahrenheit' ? 'fahrenheit' : 'celsius';
            const label = String(url.searchParams.get('label') || url.searchParams.get('name') || 'Preview City');
            const latRaw = url.searchParams.get('lat');
            const lonRaw = url.searchParams.get('lon');
            const baseTemp = 29;
            const temperature = units === 'fahrenheit' ? 84 : baseTemp;
            return sendJSON({
              location: label,
              latitude: latRaw == null || latRaw === '' ? 0 : Number(latRaw),
              longitude: lonRaw == null || lonRaw === '' ? 0 : Number(lonRaw),
              temperature,
              humidity: 68,
              feels_like: units === 'fahrenheit' ? 89 : 31,
              wind: 14,
              condition: 'Partly cloudy',
              weatherCode: 2,
              isDay: true,
              units,
            });
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

          // In-memory array for mock uploads
          if (!global.__MOCK_MEDIA) global.__MOCK_MEDIA = [];

          if (pathname === '/api/media' && method === 'GET') {
            return sendJSON({ files: global.__MOCK_MEDIA });
          }

          if (pathname === '/api/media/upload' && method === 'POST') {
            // Mock upload response for local UI testing
            const filename = `mock_uploaded_${Date.now()}.webp`;
            const newFile = {
              filename,
              url: `/media/${filename}`,
              size: 150000,
              mime_type: 'image/webp',
              usage: { activeUses: [], inactiveTemplateUses: [] }
            };
            global.__MOCK_MEDIA.push(newFile);
            return sendJSON({ success: true, filename: newFile.filename, url: newFile.url });
          }

          if (pathname.match(/^\/api\/media\/(.+)$/) && method === 'DELETE') {
            const match = pathname.match(/^\/api\/media\/(.+)$/);
            const filename = decodeURIComponent(match ? match[1] : '');
            global.__MOCK_MEDIA = (global.__MOCK_MEDIA || []).filter((f: any) => f.filename !== filename);
            return sendJSON({ success: true });
          }

          if (pathname.match(/^\/api\/media\/(.+)$/) && method === 'PATCH') {
            const match = pathname.match(/^\/api\/media\/(.+)$/);
            const oldName = decodeURIComponent(match ? match[1] : '');
            const buffers: Buffer[] = [];
            for await (const chunk of req) buffers.push(chunk);
            const body = JSON.parse(Buffer.concat(buffers).toString() || '{}');
            const nextName = String(body?.filename || '').trim();
            if (!nextName) return sendJSON({ error: 'Invalid new filename' }, 400);

            const row = (global.__MOCK_MEDIA || []).find((f: any) => f.filename === oldName);
            if (!row) return sendJSON({ error: 'File not found' }, 404);
            row.filename = nextName;
            row.url = `/media/${encodeURIComponent(nextName)}`;
            return sendJSON({ success: true, filename: row.filename, url: row.url });
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
