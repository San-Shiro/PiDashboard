// Structured documentation data — rendered by docs-tab.jsx
// Organised into sections, each with subsections containing text, tables, or code blocks.

export const DOCS_SECTIONS = [
  {
    id: "architecture",
    title: "Architecture overview",
    icon: "Server",
    subsections: [
      {
        id: "three-tier",
        title: "Three-tier model",
        type: "text",
        content: [
          "The Pi Dashboard is built on a strict three-tier separation of concerns, optimised for the Pi Zero 2W's 512MB RAM envelope.",
          "",
          "Tier 0 — Core services (always-on): A single Bun process handles three jobs simultaneously: composing the display page from widget fragments, serving the admin API, and fetching Tier 1b widget data. This keeps the runtime footprint to ~40-80MB instead of having separate Node/Bun processes.",
          "",
          "Tier 1a — Client-only widgets (zero server cost): Widgets like Clock, Image, Video, and Slideshow run entirely inside the WPE WebKit kiosk process. Once the page loads, they are completely self-sufficient — they use setInterval, Date(), <video>, and <img> tags. Bun never touches them again after serving the page. RAM cost: ~0 MB incremental.",
          "",
          "Tier 1b — Bun-fetched widgets (~0.5-3 MB each): Widgets like Weather, RSS, and Stocks ask for external HTTP data. Bun fetches on a schedule, caches the response in /tmp/widgets/<id>.json, and pushes DOM patches to the kiosk via WebSocket. No extra process is needed.",
          "",
          "Tier 2 — Native daemons (~2-20 MB each): Widgets that need system access — MPD/lyrics, sysinfo, GPIO, camera — run as isolated systemd services (Go or Rust). They write JSON to /tmp/widgets/<id>.json. Bun watches for changes and pushes updates. Daemons crash without affecting Bun.",
        ].join("\n"),
      },
      {
        id: "ascii-arch",
        title: "System diagram",
        type: "code",
        language: "text",
        content:
          "Pi Zero 2W — DietPi 32-bit\n│\n├── /opt/pi-dashboard/core/server/   (Bun — Tier 0)\n│   ├── Admin API          → http://pi.local/\n│   ├── Display compositor → http://pi.local/display/main\n│   ├── Tier 1b fetcher    → writes /tmp/widgets/*.json\n│   └── WebSocket relay    → pushes DOM patches to kiosk\n│\n├── pi-dashboard-kiosk.service  (Cog/WPE — Tier 0)\n│   └── Full-screen, points at http://127.0.0.1:<port>/display/main\n│\n├── Tier 2 daemons (systemd units)\n│   ├── pi-dashboard-widget-sysinfo.service (Go)\n│   ├── pi-dashboard-widget-music-player.service (Go)\n│   └── ... more as needed\n│\n└── /tmp/widgets/           (tmpfs — RAM disk IPC)\n    ├── weather.json        ← written by Bun (Tier 1b)\n    ├── sysinfo.json        ← written by Go daemon (Tier 2)\n    └── music-player.json   ← written by Go daemon (Tier 2)",
      },
      {
        id: "ram-budget",
        title: "RAM budget (Pi Zero 2W)",
        type: "table",
        headers: ["Component", "Tech", "RAM estimate"],
        rows: [
          ["DietPi OS", "Debian 32-bit", "~40 MB"],
          ["Bun (compositor + server + Tier 1b)", "Bun runtime", "~40–80 MB"],
          ["WPE WebKit kiosk (Cog)", "WebKit", "~60–100 MB"],
          ["Tier 1a widgets", "Browser JS/HTML", "~0 MB (runs in kiosk)"],
          ["Tier 1b widgets", "JSON in tmpfs", "~0.5–3 MB each"],
          ["Tier 2 daemons (3–4)", "Go / Rust", "~15–40 MB total"],
          ["Wi-Fi / SSH / BT", "OS networking", "~15 MB"],
          ["Video decode buffer", "Pi GPU hardware", "~40–60 MB"],
          ["tmpfs IPC", "/tmp/widgets/", "~2 MB"],
          ["Total", "", "~212–337 MB"],
          ["Free headroom", "", "~175–300 MB"],
        ],
      },
    ],
  },

  {
    id: "codebase",
    title: "Codebase file map",
    icon: "Folder",
    subsections: [
      {
        id: "api-routes",
        title: "Backend API routes (/apps/web/src/app/api/)",
        type: "table",
        headers: ["Route", "Method(s)", "Purpose"],
        rows: [
          [
            "/api/widgets/registry",
            "GET",
            "List all installed widget manifests from widget_registry table",
          ],
          [
            "/api/widgets/instances",
            "GET, POST",
            "List all widget instances; POST creates a new instance from a registry entry with defaults from manifest",
          ],
          [
            "/api/widgets/instances/[id]",
            "PATCH, DELETE",
            "Update (label, enabled, base_config, widget_config) or delete a single widget instance",
          ],
          [
            "/api/widget-data/[name]",
            "GET",
            "Widget live data proxy — on Pi this reads /tmp/widgets/<name>.json; in dev returns mock data",
          ],
          [
            "/api/media",
            "GET, POST",
            "List media files with deep usage analysis (scans widget_config + template snapshots); POST registers upload",
          ],
          [
            "/api/media/[id]",
            "DELETE",
            "Delete media file — blocked with 409 if referenced by any active enabled widget",
          ],
          [
            "/api/templates",
            "GET, POST",
            "List canvas templates with canvas_config dimensions; POST snapshots current layout + canvas settings",
          ],
          ["/api/templates/[id]", "DELETE", "Delete a saved canvas template"],
          [
            "/api/templates/[id]/apply",
            "POST",
            "Restore snapshot atomically — clears all instances, inserts snapshot instances, marks template active",
          ],
          [
            "/api/themes",
            "GET, POST",
            "List all themes (4 built-in + custom); POST creates a new custom theme",
          ],
          [
            "/api/themes/[id]",
            "DELETE",
            "Delete custom theme only — built-ins return 403",
          ],
          [
            "/api/themes/[id]/activate",
            "POST",
            "Set theme as active using transaction (clears all others first)",
          ],
          [
            "/api/system/state",
            "GET, PATCH",
            "Read/write maintenance_mode and display_enabled flags — checked by display page every 5s",
          ],
          [
            "/api/system/stats",
            "GET",
            "CPU%, RAM, temp, uptime, load avg, per-process breakdown — mock on dev, real /proc on Pi",
          ],
          [
            "/api/system/services",
            "GET",
            "Systemd service list with status — mock on dev, real systemctl on Pi",
          ],
          [
            "/api/system/services/restart",
            "POST",
            "Restart a named service — mock on dev, real systemctl restart on Pi",
          ],
          [
            "/api/system/wifi",
            "GET",
            "WiFi networks + current connection — mock on dev, nmcli on Pi",
          ],
          [
            "/api/system/bluetooth",
            "GET",
            "Paired/nearby BT devices — mock on dev, bluetoothctl on Pi",
          ],
          [
            "/api/auth/status",
            "GET",
            "Check if password configured + if current cookie session is valid",
          ],
          [
            "/api/auth/setup",
            "POST",
            "Hash admin password with argon2 and store in admin_auth table",
          ],
          [
            "/api/auth/login",
            "POST",
            "Verify password, issue 7-day session cookie (admin_token)",
          ],
          [
            "/api/auth/logout",
            "POST",
            "Delete session from admin_sessions table, clear cookie",
          ],
        ],
      },
      {
        id: "components",
        title: "Frontend components (/apps/web/src/components/dashboard/)",
        type: "table",
        headers: ["File", "Purpose"],
        rows: [
          [
            "auth-gate.jsx",
            "Wraps the entire admin app — shows password setup on first run, login screen if session expired",
          ],
          [
            "theme-provider.jsx",
            "Fetches active theme from /api/themes, injects CSS custom properties onto :root, exposes useTheme() hook with toggleDarkLight()",
          ],
          [
            "icon.jsx",
            "Resolves manifest icon name strings (e.g. 'Cloud') to Lucide React components — widget authors never import icons",
          ],
          [
            "widget-meta.js",
            "Maps widget category IDs to colour/background pairs; exports CANVAS_W=1280, CANVAS_H=720 constants",
          ],
          [
            "widget-renderers.jsx",
            "All widget JSX renderers (Clock, Weather, Lyrics, Sysinfo, Automation, Image, Video, Slideshow, RssTicker). WidgetRenderer routes by widget_id",
          ],
          [
            "use-widget-data.js",
            "Custom hook — polls /api/widget-data/* at per-widget intervals, preserves stale data on error, returns {name: data} dict",
          ],
          [
            "manifest-field.jsx",
            "Auto-renders any configSchema field type: text/number/slider/toggle/color/time/select/radio/file — the core of manifest-driven admin UI",
          ],
          [
            "widget-edit-panel.jsx",
            "Right-side slide-in panel. Four sub-tabs: General (label + widget info), Layout (x/y/w/h/opacity/zIndex), Widget config (auto-generated from manifest), Schedule (time gating)",
          ],
          [
            "ui-primitives.jsx",
            "Design token components: Pill, StatusDot, Card, PrimaryButton, GhostButton, SectionHeader, EmptyState, FieldLabel, Spinner",
          ],
          [
            "tabs/overview-tab.jsx",
            "Live CPU/RAM sparkline charts (30-point history), per-process memory table, service list, maintenance mode toggle with banner",
          ],
          [
            "tabs/widgets-tab.jsx",
            "Widget instance cards grid, Add Widget modal (shows registry), enable/disable toggle, edit launcher",
          ],
          [
            "tabs/layout-tab.jsx",
            "Drag-and-drop canvas: mousemove-based dragging, resize handles, live widget preview (polls widget data), grid snap, dynamic scale from canvas dimensions",
          ],
          [
            "tabs/media-tab.jsx",
            "Upload (drag-drop + file picker), grid list, usage labels, deletion protection, orphan detection",
          ],
          [
            "tabs/templates-tab.jsx",
            "Canvas management: create with custom dimensions, canvas settings editor, save/apply/delete templates",
          ],
          [
            "tabs/themes-tab.jsx",
            "Theme grid with colour swatches, activate button, light/dark quick switch, custom theme builder",
          ],
          [
            "tabs/system-control-tab.jsx",
            "WiFi signal bars browser, Bluetooth paired/nearby, display on/off, reboot/shutdown",
          ],
          [
            "tabs/marketplace-tab.jsx",
            "Phase 8 preview — browse-only widget catalog with coming-soon install buttons",
          ],
          [
            "tabs/docs-tab.jsx",
            "In-app documentation — renders DOCS_SECTIONS from data/docs-data.js with copy buttons and syntax styling",
          ],
          [
            "data/docs-data.js",
            "All documentation content as structured JS data (no DB, no fetch) — sections/subsections with type: text | table | code",
          ],
        ],
      },
      {
        id: "db-tables",
        title: "Database tables",
        type: "table",
        headers: ["Table", "Key columns", "Purpose"],
        rows: [
          [
            "widget_registry",
            "id TEXT PK, manifest JSONB, version TEXT, enabled BOOL, installed_at TIMESTAMP",
            "Installed widget package manifests. manifest.configSchema drives the auto-generated config UI",
          ],
          [
            "widget_instances",
            "id TEXT PK, widget_id TEXT, label TEXT, enabled BOOL, base_config JSONB, widget_config JSONB",
            "Each placed widget on the layout. base_config = x/y/w/h/zIndex/opacity/schedule. widget_config = type-specific configSchema values",
          ],
          [
            "layout_templates",
            "id SERIAL PK, name TEXT UNIQUE, snapshot JSONB, canvas_config JSONB, is_active BOOL",
            "Saved canvas snapshots. canvas_config = {width, height, background, displayTarget, pixelRatio}. snapshot.instances is a full copy of widget_instances",
          ],
          [
            "media_files",
            "id SERIAL PK, filename TEXT, url TEXT, mime_type TEXT, size_bytes BIGINT, uploaded_at TIMESTAMP",
            "Upload inventory. Usage computed at query-time by recursive scan of widget_config values matching file URL",
          ],
          [
            "themes",
            "id TEXT PK, name TEXT, is_builtin BOOL, is_active BOOL, config JSONB",
            "Theme CSS custom property maps. Only one row has is_active=true. Built-in: light, dark, midnight, forest",
          ],
          [
            "admin_auth",
            "id INT=1 (single row), password_hash TEXT, updated_at TIMESTAMP",
            "argon2 hash of the admin password. Single-row enforced by CHECK (id = 1) constraint",
          ],
          [
            "admin_sessions",
            "token TEXT PK, created_at TIMESTAMP, expires_at TIMESTAMP",
            "Cookie session tokens. Checked on every authenticated request. Add a cron to purge expired rows in production",
          ],
          [
            "system_state",
            "id INT=1 (single row), maintenance_mode BOOL, display_enabled BOOL",
            "Global system flags. maintenance_mode pauses kiosk + widget daemons. display_enabled controls DPMS/screen power",
          ],
          [
            "crash_log",
            "id SERIAL PK, service_name TEXT, error_message TEXT, occurred_at TIMESTAMP",
            "Widget daemon crash records — written when systemd marks a service as failed. Shown in Overview tab",
          ],
        ],
      },
    ],
  },

  {
    id: "widget-dev",
    title: "Widget development guide",
    icon: "Code",
    subsections: [
      {
        id: "tier-choice",
        title: "Choose your tier",
        type: "text",
        content:
          "Tier 1a — Client-only: No external data needed. Widget runs in the browser (clock, image, video, slideshow). Cost: 0 MB extra.\n\nTier 1b — Bun-fetched: HTTP API data on a schedule (weather, RSS, stocks). Bun fetches + caches in tmpfs. Cost: ~0.5-3 MB.\n\nTier 2 — Go/Rust daemon: System access, persistent sockets, heavy computation (MPD, sysinfo, GPIO). Cost: ~2-20 MB per daemon.",
      },
      {
        id: "manifest-rss",
        title: "Example manifest.json — RSS Ticker (Tier 1b)",
        type: "code",
        language: "json",
        content:
          '{\n  "widgetId": "rss-ticker",\n  "displayName": "RSS Ticker",\n  "version": "1.0.0",\n  "tier": "1b",\n  "runner": "hosted",\n  "entrypoints": {\n    "fragment": "fragment/rss-ticker.html",\n    "fetchModule": "fetch/rss-ticker.ts"\n  },\n  "defaultLayout": { "x": 0, "y": 660, "width": 1280, "height": 60, "zIndex": 15, "opacity": 1.0 },\n  "polling": {\n    "pollIntervalSec": 900,\n    "jitterSec": 30,\n    "timeoutMs": 5000,\n    "backoff": { "baseSec": 60, "maxSec": 3600 }\n  },\n  "configSchema": [\n    { "key": "feedUrl", "label": "RSS Feed URL", "type": "text", "default": "https://feeds.bbci.co.uk/news/rss.xml", "hint": "Any standard RSS 2.0 or Atom feed" },\n    { "key": "maxItems", "label": "Headlines to show", "type": "slider", "default": 5, "min": 1, "max": 20 },\n    { "key": "scrollSpeed", "label": "Scroll speed", "type": "select", "default": "medium", "options": [ {"value": "slow","label": "Slow"}, {"value": "medium","label": "Medium"}, {"value": "fast","label": "Fast"} ] },\n    { "key": "textColor", "label": "Text colour", "type": "color", "default": "#FFFFFF" },\n    { "key": "showSource", "label": "Show source name", "type": "toggle", "default": true }\n  ],\n  "requirements": { "capabilities": ["network"] },\n  "fallbackData": { "items": [{"title": "RSS feed unavailable", "source": "", "pubDate": ""}], "fetchedAt": 0 }\n}',
      },
      {
        id: "register-sql",
        title: "Step 2 — Register in widget_registry (SQL)",
        type: "code",
        language: "sql",
        content:
          "INSERT INTO widget_registry (id, manifest, version, enabled)\nVALUES (\n  'rss-ticker',\n  '{ ...paste manifest JSON here... }',\n  '1.0.0',\n  true\n)\nON CONFLICT (id) DO UPDATE\n  SET manifest = EXCLUDED.manifest,\n      version  = EXCLUDED.version;",
      },
      {
        id: "renderer-jsx",
        title: "Step 3 — Add renderer to widget-renderers.jsx",
        type: "code",
        language: "jsx",
        content:
          "// Add your renderer function:\nexport function RssTickerRenderer({ instance, data }) {\n  const cfg = instance.widget_config || {};\n  const items = data?.items || [];\n  return (\n    <div style={{ color: cfg.textColor || '#fff', overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center' }}>\n      <div style={{ whiteSpace: 'nowrap', fontSize: 14 }}>\n        {items.map((item, i) => (\n          <span key={i} style={{ marginRight: 60 }}>\n            {cfg.showSource && <span style={{ opacity: 0.5, marginRight: 8 }}>[{item.source}]</span>}\n            {item.title}\n          </span>\n        ))}\n      </div>\n    </div>\n  );\n}\n\n// Add to WidgetRenderer router:\n// if (wid === 'rss-ticker') return <RssTickerRenderer instance={instance} data={widgetData?.['rss-ticker']} />;",
      },
      {
        id: "config-auto-note",
        title: "Step 4 — Config panel auto-generates (no UI code needed)",
        type: "text",
        content:
          "You do NOT write any admin UI code. Once your manifest is registered with a configSchema, the WidgetEditPanel automatically renders the correct form controls.\n\nField types supported by ManifestField:\n• text → text input\n• number → number input\n• slider → range input with min/max/unit labels\n• toggle → animated toggle switch\n• color → color picker + hex input\n• time → time input\n• select → dropdown\n• radio → pill-style radio group\n• file → Media Library picker (filtered by accepts MIME type)\n\nBase fields (x, y, width, height, zIndex, opacity, activeFrom, activeTo) are injected automatically into the Layout and Schedule tabs. Widget authors never define these.",
      },
    ],
  },

  {
    id: "pi-setup",
    title: "Production Pi setup",
    icon: "Terminal",
    subsections: [
      {
        id: "fstab",
        title: "/etc/fstab — tmpfs RAM disk for widget IPC",
        type: "code",
        language: "bash",
        content:
          "# Add to /etc/fstab — 32MB RAM disk for widget JSON (eliminates SD card write wear)\ntmpfs /tmp/widgets tmpfs defaults,size=32M,mode=0755 0 0\n\n# Apply immediately (no reboot needed):\nsudo mkdir -p /tmp/widgets\nsudo mount /tmp/widgets",
      },
      {
        id: "bun-server",
        title: "Production Bun server — reads /tmp/widgets/*.json",
        type: "code",
        language: "javascript",
        content:
          '// /opt/pi-dashboard/core/server/server.js\nimport { readFileSync, existsSync, watchFile } from "fs";\nimport { join } from "path";\n\nconst WIDGET_DIR = "/tmp/widgets";\nconst MEDIA_DIR  = "/opt/pi-dashboard/media/uploads";\nconst PORT       = process.env.PORT || 3000;\n\nconst wsClients  = new Set();\nconst widgetCache = new Map();\n\n// Watch /tmp/widgets/ — push DOM patches to kiosk via WebSocket\nfunction watchWidgetDir() {\n  try {\n    const result = Bun.spawnSync(["ls", WIDGET_DIR]);\n    const files  = result.stdout.toString().trim().split("\\n");\n    for (const file of files) {\n      if (!file.endsWith(".json")) continue;\n      const widgetId = file.replace(".json", "");\n      const path = join(WIDGET_DIR, file);\n      watchFile(path, { interval: 500 }, () => {\n        try {\n          const data = JSON.parse(readFileSync(path, "utf8"));\n          widgetCache.set(widgetId, data);\n          const msg = JSON.stringify({ type: "widget-update", widgetId, data });\n          for (const ws of wsClients) {\n            if (ws.readyState === WebSocket.OPEN) ws.send(msg);\n          }\n        } catch (e) { console.error("watchFile error:", e.message); }\n      });\n    }\n  } catch (e) { console.error("watchWidgetDir:", e.message); }\n}\n\nBun.serve({\n  port: PORT,\n  async fetch(req, server) {\n    const url = new URL(req.url);\n    if (url.pathname === "/ws") {\n      if (server.upgrade(req)) return undefined;\n      return new Response("WebSocket required", { status: 400 });\n    }\n    // Widget data from tmpfs\n    if (url.pathname.startsWith("/api/widget-data/")) {\n      const name = url.pathname.split("/")[3];\n      const filePath = join(WIDGET_DIR, name + ".json");\n      if (existsSync(filePath)) {\n        const data = JSON.parse(readFileSync(filePath, "utf8"));\n        widgetCache.set(name, data);\n        return Response.json(data);\n      }\n      const cached = widgetCache.get(name);\n      if (cached) return Response.json(cached, { headers: { "X-Cache": "stale" } });\n      return Response.json({ error: "No data yet" }, { status: 404 });\n    }\n    // Media files\n    if (url.pathname.startsWith("/media/")) {\n      const filename = url.pathname.replace("/media/", "");\n      const filePath = join(MEDIA_DIR, filename);\n      if (!existsSync(filePath)) return new Response("Not found", { status: 404 });\n      return new Response(Bun.file(filePath));\n    }\n    // Fallback — static admin SPA\n    return new Response(Bun.file("./public" + (url.pathname === "/" ? "/index.html" : url.pathname)));\n  },\n  websocket: {\n    open(ws) {\n      wsClients.add(ws);\n      for (const [widgetId, data] of widgetCache) {\n        ws.send(JSON.stringify({ type: "widget-update", widgetId, data }));\n      }\n    },\n    close(ws) { wsClients.delete(ws); },\n  },\n});\n\nwatchWidgetDir();\nconsole.log("Pi Dashboard server on port " + PORT);',
      },
      {
        id: "systemd-units",
        title: "systemd service units",
        type: "code",
        language: "ini",
        content:
          "# === pi-dashboard.service (Bun server) ===\n[Unit]\nDescription=Pi Dashboard — Bun compositor + admin server\nAfter=network-online.target\n\n[Service]\nType=simple\nUser=pi\nWorkingDirectory=/opt/pi-dashboard\nExecStart=/home/pi/.bun/bin/bun run core/server/server.js\nRestart=always\nRestartSec=3\nEnvironment=PORT=3000\nNoNewPrivileges=true\nStandardOutput=journal\nSyslogIdentifier=pi-dashboard\n\n[Install]\nWantedBy=multi-user.target\n\n\n# === pi-dashboard-kiosk.service (WPE WebKit) ===\n[Unit]\nDescription=Pi Dashboard — WPE WebKit kiosk\nAfter=pi-dashboard.service graphical.target\nRequires=pi-dashboard.service\n\n[Service]\nType=simple\nUser=pi\nEnvironment=DISPLAY=:0\nExecStartPre=/bin/sleep 5\nExecStart=/usr/bin/cog --platform=drm http://127.0.0.1:3000/display/main\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=graphical.target\n\n\n# === pi-dashboard-widget-sysinfo.service (Tier 2 daemon template) ===\n[Unit]\nDescription=Pi Dashboard Widget — Sysinfo daemon\nAfter=pi-dashboard.service\n\n[Service]\nType=simple\nUser=pi\nExecStart=/opt/pi-dashboard/widgets/sysinfo/daemon/bin/sysinfod\nRestart=on-failure\nRestartSec=2\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\nReadWritePaths=/tmp/widgets\nStandardOutput=journal\nSyslogIdentifier=pi-dashboard-widget-sysinfo\n\n[Install]\nWantedBy=multi-user.target",
      },
      {
        id: "install-sh",
        title: "Master installer (install.sh)",
        type: "code",
        language: "bash",
        content:
          '#!/usr/bin/env bash\n# /opt/pi-dashboard/installer/install.sh\nset -euo pipefail\n\nINSTALL_DIR="/opt/pi-dashboard"\nSERVICE_USER="pi"\n\necho "=== Pi Dashboard Installer ==="\n\nARCH=$(uname -m)\nRAM_KB=$(grep MemTotal /proc/meminfo | awk \'{print $2}\')\nRAM_MB=$((RAM_KB / 1024))\necho "Platform: $ARCH, RAM: ${RAM_MB}MB"\n\nif [ "$RAM_MB" -lt 256 ]; then\n  echo "ERROR: Minimum 256MB RAM required. Found ${RAM_MB}MB." >&2\n  exit 1\nfi\n\napt-get update -qq\napt-get install -y --no-install-recommends curl unzip git cog fonts-noto\n\nif ! command -v bun &>/dev/null; then\n  curl -fsSL https://bun.sh/install | bash\n  export PATH="$HOME/.bun/bin:$PATH"\nfi\n\nmkdir -p \\\n  "$INSTALL_DIR/core/server" \\\n  "$INSTALL_DIR/widgets/_base" \\\n  "$INSTALL_DIR/media/uploads" \\\n  "$INSTALL_DIR/canvases/saved" \\\n  "$INSTALL_DIR/state/cache" \\\n  "$INSTALL_DIR/secrets"\n\nchown -R $SERVICE_USER:$SERVICE_USER "$INSTALL_DIR"\nchmod 700 "$INSTALL_DIR/secrets"\n\nif ! grep -q "/tmp/widgets" /etc/fstab; then\n  echo "tmpfs /tmp/widgets tmpfs defaults,size=32M,mode=0755 0 0" >> /etc/fstab\nfi\nmkdir -p /tmp/widgets && mount /tmp/widgets 2>/dev/null || true\n\ncp installer/systemd/*.service /etc/systemd/system/\nsystemctl daemon-reload\nsystemctl enable --now pi-dashboard.service\nsystemctl enable --now pi-dashboard-kiosk.service\n\nfor widget_dir in widgets/*/; do\n  [ -f "$widget_dir/install.sh" ] && bash "$widget_dir/install.sh" install\ndone\n\necho "✓ Done! Admin panel: http://$(hostname -I | awk \'{print $1}\')/"',
      },
    ],
  },

  {
    id: "standard-widgets",
    title: "Standard widget implementations",
    icon: "Layers",
    subsections: [
      {
        id: "image-widget",
        title: "Image widget renderer (JSX)",
        type: "code",
        language: "jsx",
        content:
          "// Tier 1a — client only. No server cost.\n// Source is a URL from the Media Library (picked via manifest file field).\nexport function ImageRenderer({ instance }) {\n  const cfg = instance.widget_config || {};\n  if (!cfg.source) return (\n    <div style={{ width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.06)',\n      display: 'flex', alignItems: 'center', justifyContent: 'center',\n      color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>\n      No image set\n    </div>\n  );\n  return (\n    <img src={cfg.source} alt=\"\"\n      style={{ width: '100%', height: '100%',\n        objectFit: cfg.fit || 'cover',       // cover / contain / fill\n        borderRadius: cfg.borderRadius || 0,\n        display: 'block' }} />\n  );\n}\n// manifest configSchema:\n// { key: 'source', type: 'file', accepts: 'image/*', required: true }\n// { key: 'fit', type: 'radio', options: ['cover','contain','fill'], default: 'cover' }\n// { key: 'borderRadius', type: 'slider', min: 0, max: 200, unit: 'px', default: 0 }",
      },
      {
        id: "video-widget",
        title: "Video background widget renderer (JSX)",
        type: "code",
        language: "jsx",
        content:
          "// Tier 1a — client only.\n// WPE WebKit hardware-decodes H.264 via GStreamer on Pi GPU.\n// Encode as H.264 baseline for best Pi performance:\n// ffmpeg -i input.mov -vcodec h264 -acodec aac output.mp4\nexport function VideoRenderer({ instance }) {\n  const cfg = instance.widget_config || {};\n  if (!cfg.source) return (\n    <div style={{ width: '100%', height: '100%', backgroundColor: '#111',\n      display: 'flex', alignItems: 'center', justifyContent: 'center',\n      color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>No video set</div>\n  );\n  return (\n    <video src={cfg.source}\n      autoPlay\n      loop={cfg.loop !== false}\n      muted={cfg.muted !== false}\n      playsInline\n      style={{ width: '100%', height: '100%',\n        objectFit: cfg.fit || 'cover',\n        display: 'block',\n        borderRadius: cfg.borderRadius || 0 }} />\n  );\n}\n// manifest configSchema:\n// { key: 'source', type: 'file', accepts: 'video/*', required: true }\n// { key: 'loop', type: 'toggle', default: true }\n// { key: 'muted', type: 'toggle', default: true }\n// { key: 'fit', type: 'radio', options: ['cover','contain','fill'], default: 'cover' }\n// { key: 'borderRadius', type: 'slider', min: 0, max: 100, unit: 'px', default: 0 }",
      },
      {
        id: "slideshow-widget",
        title: "Slideshow widget renderer (JSX)",
        type: "code",
        language: "jsx",
        content:
          "// Tier 1a — client only. CSS fade transition between images.\nimport { useState, useEffect } from 'react';\nexport function SlideshowRenderer({ instance }) {\n  const cfg = instance.widget_config || {};\n  const sources = cfg.sources || [];\n  const intervalMs = (cfg.intervalSec || 8) * 1000;\n  const [current, setCurrent] = useState(0);\n  const [visible, setVisible] = useState(true);\n\n  useEffect(() => {\n    if (sources.length <= 1) return;\n    const t = setInterval(() => {\n      setVisible(false);\n      setTimeout(() => { setCurrent(i => (i + 1) % sources.length); setVisible(true); }, 500);\n    }, intervalMs);\n    return () => clearInterval(t);\n  }, [sources.length, intervalMs]);\n\n  if (!sources.length) return (\n    <div style={{ width: '100%', height: '100%', backgroundColor: '#111',\n      display: 'flex', alignItems: 'center', justifyContent: 'center',\n      color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>No images added</div>\n  );\n  return (\n    <div style={{ width: '100%', height: '100%', position: 'relative',\n                  overflow: 'hidden', borderRadius: cfg.borderRadius || 0 }}>\n      <img src={sources[current]} alt=\"\" style={{\n        width: '100%', height: '100%', objectFit: cfg.fit || 'cover',\n        opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease-in-out'\n      }} />\n      {cfg.showDots && (\n        <div style={{ position: 'absolute', bottom: 8, width: '100%',\n          display: 'flex', justifyContent: 'center', gap: 4 }}>\n          {sources.map((_, i) => (\n            <span key={i} style={{ width: 6, height: 6, borderRadius: '50%',\n              backgroundColor: i === current ? '#fff' : 'rgba(255,255,255,0.3)' }} />\n          ))}\n        </div>\n      )}\n    </div>\n  );\n}",
      },
      {
        id: "go-daemon",
        title:
          "Go daemon boilerplate — sysinfo (production-ready, full source)",
        type: "code",
        language: "go",
        content:
          '// /opt/pi-dashboard/widgets/sysinfo/daemon/main.go\n// Compile: GOARCH=arm GOOS=linux go build -o bin/sysinfod main.go\npackage main\n\nimport (\n    "encoding/json"\n    "log"\n    "os"\n    "os/signal"\n    "strconv"\n    "strings"\n    "syscall"\n    "time"\n)\n\nconst outputPath = "/tmp/widgets/sysinfo.json"\n\ntype SysinfoData struct {\n    CpuTemp    float64 `json:"cpu_temp"`\n    CpuPercent float64 `json:"cpu_percent"`\n    MemUsedMB  int     `json:"mem_used_mb"`\n    MemTotalMB int     `json:"mem_total_mb"`\n    UptimeHrs  float64 `json:"uptime_hours"`\n    LoadAvg1   float64 `json:"load_avg_1"`\n    UpdatedAt  int64   `json:"updated_at"`\n}\n\nfunc readCpuTemp() float64 {\n    data, err := os.ReadFile("/sys/class/thermal/thermal_zone0/temp")\n    if err != nil { return 0 }\n    milli, _ := strconv.ParseFloat(strings.TrimSpace(string(data)), 64)\n    return milli / 1000.0\n}\n\nfunc readMemInfo() (used, total int) {\n    data, _ := os.ReadFile("/proc/meminfo")\n    for _, line := range strings.Split(string(data), "\\n") {\n        parts := strings.Fields(line)\n        if len(parts) < 2 { continue }\n        val, _ := strconv.Atoi(parts[1])\n        switch parts[0] {\n        case "MemTotal:": total = val / 1024\n        case "MemAvailable:": used = total - val/1024\n        }\n    }\n    return\n}\n\nfunc atomicWrite(path string, data []byte) error {\n    tmp := path + ".tmp"\n    if err := os.WriteFile(tmp, data, 0644); err != nil { return err }\n    return os.Rename(tmp, path)\n}\n\nfunc main() {\n    log.SetPrefix("[sysinfod] ")\n    os.MkdirAll("/tmp/widgets", 0755)\n\n    quit := make(chan os.Signal, 1)\n    signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)\n    ticker := time.NewTicker(5 * time.Second)\n    defer ticker.Stop()\n\n    collect := func() {\n        memUsed, memTotal := readMemInfo()\n        d := SysinfoData{\n            CpuTemp: readCpuTemp(), MemUsedMB: memUsed, MemTotalMB: memTotal,\n            UpdatedAt: time.Now().Unix(),\n        }\n        b, _ := json.Marshal(d)\n        if err := atomicWrite(outputPath, b); err != nil {\n            log.Printf("write error: %v", err)\n        }\n    }\n\n    collect() // write immediately on start\n    for {\n        select {\n        case <-quit: log.Println("shutdown"); return\n        case <-ticker.C: collect()\n        }\n    }\n}',
      },
    ],
  },

  {
    id: "api-reference",
    title: "API reference & curl examples",
    icon: "FileText",
    subsections: [
      {
        id: "curl-examples",
        title: "curl command examples",
        type: "code",
        language: "bash",
        content:
          '# List all widget instances\ncurl http://pi.local/api/widgets/instances\n\n# Toggle a widget\ncurl -X PATCH http://pi.local/api/widgets/instances/<id> \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"enabled": false}\'\n\n# Move a widget\ncurl -X PATCH http://pi.local/api/widgets/instances/<id> \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"base_config": {"x": 100, "y": 200, "width": 300, "height": 150, "zIndex": 10, "opacity": 0.9, "activeFrom": "00:00", "activeTo": "23:59"}}\'\n\n# Save layout as canvas template\ncurl -X POST http://pi.local/api/templates \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"name": "evening-mode", "canvas_config": {"width": 1920, "height": 1080, "background": "#000", "displayTarget": "primary"}}\'\n\n# Apply a template (restores layout)\ncurl -X POST http://pi.local/api/templates/3/apply\n\n# Switch to dark theme\ncurl -X POST http://pi.local/api/themes/dark/activate\n\n# Enable maintenance mode\ncurl -X PATCH http://pi.local/api/system/state \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"maintenance_mode": true}\'\n\n# Login and save session cookie\ncurl -X POST http://pi.local/api/auth/login \\\n  -H \'Content-Type: application/json\' \\\n  -c cookies.txt \\\n  -d \'{"password": "yourpassword"}\'\n\n# Get system stats\ncurl -b cookies.txt http://pi.local/api/system/stats',
      },
      {
        id: "media-usage",
        title: "How media usage tracking works",
        type: "text",
        content:
          "Media usage is computed entirely at query time in /api/media (GET) — there is no separate usage index table.\n\nThe algorithm:\n1. Fetch all media_files rows\n2. Fetch all widget_instances rows (including disabled ones)\n3. Fetch all layout_templates rows (the snapshot.instances arrays)\n4. For each media file URL, scan every widget_config object's values recursively — if any string value equals the file's URL, that instance is marked as using the file\n5. Template snapshots are scanned the same way — if a template (even inactive) references a file, it gets an 'inactiveTemplateUses' label\n6. The result is returned per-file: { activeUses: [...], inactiveTemplateUses: [...] }\n\nDelete protection:\n- DELETE /api/media/[id] first checks all enabled widget_instances\n- If any enabled instance's widget_config contains the file URL → 409 Conflict\n- Disabled instances and template references do NOT block deletion\n- This means: disable the widget first, then delete the file\n\nThe UI in media-tab.jsx displays:\n- Green 'Used by active widget' when enabled instance references the file\n- Amber 'Used by disabled widget' for disabled instances\n- Blue 'In N template(s)' for template snapshot references\n- Gray 'Unused — safe to delete' when no references found",
      },
    ],
  },
];
