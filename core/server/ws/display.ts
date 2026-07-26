import { stateStore } from '../state/state-store';
import { daemonManager } from '../daemon/daemon-manager';
import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const IPC_DIR = join(ROOT, 'state', 'ipc');
const WIDGETS_DIR = join(ROOT, 'widgets');

const cmdRateMap = new Map<string, number[]>();
const CMD_RATE_LIMIT = 10;
const CMD_RATE_WINDOW_MS = 1000;

// Cache the parsed active canvas, invalidated by mtime, so command routing does
// not re-read and re-parse the file on every command (up to 10/s per instance).
let _canvasCache: { mtime: number; canvas: any } | null = null;
function loadActiveCanvas(): any | null {
  const canvasPath = join(ROOT, 'canvases', 'active.json');
  if (!existsSync(canvasPath)) return null;
  try {
    const mtime = statSync(canvasPath).mtimeMs;
    if (_canvasCache && _canvasCache.mtime === mtime) return _canvasCache.canvas;
    const canvas = JSON.parse(readFileSync(canvasPath, 'utf8'));
    _canvasCache = { mtime, canvas };
    return canvas;
  } catch {
    return null;
  }
}

function resolveCommand(instanceId: string, commandName: string): { daemonId: string; manifest: any } | null {
  const canvas = loadActiveCanvas();
  if (!canvas) return null;

  const widgets = canvas.widgets || [];
  const instance = widgets.find((w: any) => w.id === instanceId);
  if (!instance) return null;

  const manifestPath = join(WIDGETS_DIR, instance.widget_id, 'manifest.json');
  if (!existsSync(manifestPath)) return null;

  let manifest: any;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { return null; }

  if (!manifest.daemon) return null;

  if (manifest.commands && Array.isArray(manifest.commands)) {
    const cmd = manifest.commands.find((c: any) => c.name === commandName);
    if (!cmd) return null;
  }

  const daemonId = `${manifest.daemon}__${instanceId}`;
  return { daemonId, manifest };
}

export interface ServerWebSocket {
  readyState: number;
  send(data: string | Uint8Array): void;
  data: any;
}

interface ClientMeta {
  role: 'display' | 'daemon' | 'admin';
  id?: string;
  initialized?: boolean;
  isDaemonChannel?: boolean;
}

const displays = new Set<ServerWebSocket>();
const daemons = new Map<string, ServerWebSocket>(); // daemonId -> ws
const admins = new Set<ServerWebSocket>();

const BROADCAST_DEBOUNCE_MS = 150;
const broadcastTimers = new Map<string, Timer>();

export const websocketHandler = {
  open(ws: ServerWebSocket) {
    if (!ws.data || !ws.data.role) {
      ws.data = { role: 'display', id: 'global' } as ClientMeta;
    }
    const meta = ws.data as ClientMeta;

    // Daemon-channel sockets register themselves via `hello`; they are not
    // broadcast receivers and must not join the display/admin sets.
    if (meta.isDaemonChannel) return;

    // Each socket belongs to exactly one broadcast set (admins OR displays) so
    // broadcasts that iterate both do not deliver twice.
    if (meta.role === 'admin') {
      admins.add(ws);
    } else {
      displays.add(ws);
    }

    if (ws.readyState === 1) {
      const allStates = stateStore.getAll();
      for (const [key, data] of Object.entries(allStates)) {
        const parts = key.split(':');
        const widget = parts[0];
        const instance = parts.length > 1 ? parts[1] : 'global';

        try {
          ws.send(JSON.stringify({ type: 'state', widget, instance, data }));
        } catch (err) {
          displays.delete(ws);
          break;
        }
      }
    }
  },
  
  close(ws: ServerWebSocket) {
    const meta = ws.data as ClientMeta;
    displays.delete(ws);
    if (meta.role === 'admin') {
      admins.delete(ws);
      if (meta.id) daemonManager.setPreview(meta.id, null);
    } else if (meta.role === 'daemon' && meta.id) {
      if (daemons.get(meta.id) === ws) {
        daemons.delete(meta.id);
      }
    }
  },
  
  message(ws: ServerWebSocket, rawMsg: string | Uint8Array) {
    if (rawMsg.length > 65536) {
      ws.close();
      return;
    }
    try {
      const msgStr = typeof rawMsg === 'string' ? rawMsg : new TextDecoder().decode(rawMsg);
      const msg = JSON.parse(msgStr);
      
      // ws.data may be absent when broadcasts are triggered internally via a
      // mock socket (updateStateCache / daemon-manager). Default to a plain
      // object so role checks resolve to non-admin rather than throwing.
      const meta = (ws.data || {}) as ClientMeta;
      const isAdmin = meta.role === 'admin';

      switch (msg.type) {
        case 'hello':
          handleHello(ws, msg);
          break;
        case 'preview':
          if (isAdmin) handlePreview(ws, msg);
          break;
        case 'patch':
          handlePatch(msg);
          break;
        case 'cmd':
          handleCmd(msg);
          break;
        case 'subscribe_logs':
          if (isAdmin) handleSubscribeLogs(ws);
          break;
        case 'heartbeat':
          handleHeartbeat(ws, msg);
          break;
        case 'widget_command':
          handleWidgetCommand(msg);
          break;
        case 'widget_state_save':
          handleWidgetStateSave(msg);
          break;
      }
    } catch (e) {
      // ignore malformed
    }
  }
};

function handleSubscribeLogs(ws: ServerWebSocket) {
  // Send the current buffer of logs to the client
  import('../logger').then(({ getLogs }) => {
    ws.send(JSON.stringify({ type: 'logs', logs: getLogs() }));
  });
}

export function broadcastLogs(logs: any[]) {
  const msg = JSON.stringify({ type: 'logs', logs });
  for (const ws of admins) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

function handleHello(ws: ServerWebSocket, msg: any) {
  const meta = ws.data as ClientMeta;
  if (meta.initialized) return;
  meta.initialized = true;

  if (msg.canvasId) meta.id = msg.canvasId;

  // Daemon registration is only honored on the dedicated /ws/daemon channel
  // (local daemon processes), never on a browser display/admin socket.
  if (msg.role === 'daemon' && meta.isDaemonChannel) {
    if (!msg.daemonId) return;
    const safeId = msg.daemonId.replace(/[^a-zA-Z0-9_-]/g, '');
    meta.role = 'daemon';
    meta.id = safeId;
    daemons.set(safeId, ws);
  }
}

function handlePreview(ws: ServerWebSocket, msg: any) {
  const meta = ws.data as ClientMeta;
  if (meta.role === 'admin' && meta.id) {
    if (msg.canvas) {
      daemonManager.setPreview(meta.id, msg.canvas);
    } else {
      daemonManager.setPreview(meta.id, null);
    }
  }
}

function handlePatch(msg: any) {
  if (!msg.widget || !msg.delta) return;
  const safeWidget = msg.widget.replace(/[^a-zA-Z0-9_-]/g, '');
  const instance = msg.instance || 'global';
  const safeInstance = instance.replace(/[^a-zA-Z0-9_-]/g, '');
  const key = instance === 'global' ? safeWidget : `${safeWidget}:${safeInstance}`;

  try {
    stateStore.patch(key, msg.delta);
    scheduleBroadcast(key, safeWidget, safeInstance);
  } catch (err) {
    // 50KB limit exceeded, silently drop or log
    console.error(`[WS] Patch failed for ${key}:`, err);
  }
}

function handleCmd(msg: any) {
  const instance = msg.instance;
  const name = msg.name;

  // Legacy path: daemon specified directly (backward compat for existing widgets)
  if (msg.daemon && msg.data && !name) {
    const safeDaemon = msg.daemon.replace(/[^a-zA-Z0-9_-]/g, '');
    const daemonWs = daemons.get(safeDaemon);
    if (daemonWs && daemonWs.readyState === 1) {
      daemonWs.send(JSON.stringify(msg));
    }
    return;
  }

  if (!instance || !name) return;
  const safeInstance = instance.replace(/[^a-zA-Z0-9_-]/g, '');

  // Rate limit per instance
  const now = Date.now();
  let timestamps = cmdRateMap.get(safeInstance) || [];
  timestamps = timestamps.filter(t => now - t < CMD_RATE_WINDOW_MS);
  if (timestamps.length >= CMD_RATE_LIMIT) return;
  timestamps.push(now);
  cmdRateMap.set(safeInstance, timestamps);

  const resolved = resolveCommand(safeInstance, name);
  if (!resolved) return;

  const cmdPayload = {
    id: msg.id || `c${now}`,
    action: name,
    params: msg.params || {},
    ts: now,
  };

  // Write to IPC command file
  try {
    mkdirSync(IPC_DIR, { recursive: true });
    writeFileSync(join(IPC_DIR, `${resolved.daemonId}.cmd.json`), JSON.stringify(cmdPayload), 'utf8');
  } catch (err) {
    console.error(`[WS] Failed to write cmd for ${resolved.daemonId}:`, err);
  }

  // Also forward to daemon WS if connected
  const daemonWs = daemons.get(resolved.daemonId);
  if (daemonWs && daemonWs.readyState === 1) {
    daemonWs.send(JSON.stringify({ type: 'cmd', ...cmdPayload }));
  }
}

function scheduleBroadcast(key: string, widget: string, instance: string) {
  if (broadcastTimers.has(key)) return;
  
  const executeBroadcast = () => {
    broadcastTimers.delete(key);
    
    const data = stateStore.get(key);
    if (!data) return;
    
    const stateMsg = JSON.stringify({
      type: 'state',
      widget,
      instance,
      data
    });
    
    // Broadcast to all displays and admins
    for (const ws of displays) {
      if (ws.readyState === 1) {
        ws.send(stateMsg);
      } else {
        displays.delete(ws);
      }
    }
    for (const ws of admins) {
      if (ws.readyState === 1) {
        ws.send(stateMsg);
      } else {
        admins.delete(ws);
      }
    }
  };

  if (broadcastTimers.size > 50) {
    // If overwhelmed, skip debounce and broadcast synchronously
    executeBroadcast();
    return;
  }
  
  const timer = setTimeout(executeBroadcast, BROADCAST_DEBOUNCE_MS);
  broadcastTimers.set(key, timer as any);
}

export function pushReload(): void {
  for (const ws of displays) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'reload' }));
  }
}

export function pushRefresh(widget: string, instance: string, config: any): void {
  const msg = JSON.stringify({ type: 'refresh', widget, instance, config });
  for (const ws of displays) {
    if (ws.readyState === 1) ws.send(msg);
  }
  for (const ws of admins) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

export function pushData(widget: string, data: any): void {
  const msg = JSON.stringify({ type: 'data', widget, data });
  for (const ws of displays) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// Deliver a command acknowledgement to displays/admins. Routed to the owning
// widget by (widget, instance) exactly like state, so iframe delivery is free.
export function pushAck(widget: string, instance: string, ack: any): void {
  const msg = JSON.stringify({ type: 'ack', widget, instance, ack });
  for (const ws of displays) {
    if (ws.readyState === 1) ws.send(msg);
  }
  for (const ws of admins) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

export function pushMaintenance(enabled: boolean): void {
  for (const ws of displays) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'maintenance', enabled }));
  }
}

export function getDisplayStatuses() {
  return Array.from(displays).map(ws => ({
    canvasId: ws.data.id,
    status: ws.readyState === 1 ? 'online' : 'offline'
  }));
}

function handleHeartbeat(ws: ServerWebSocket, msg: any) {
  if (msg.canvas_id) ws.data.id = msg.canvas_id;
}

function handleWidgetCommand(msg: any) {
  if (!msg.widget || !msg.action) return;
  const safeWidget = msg.widget.replace(/[^a-zA-Z0-9_-]/g, '');
  const ipcDir = process.env.IPC_DIR || IPC_DIR;
  const cmdPath = join(ipcDir, `${safeWidget}.cmd.json`);

  const cmdData = {
    action: msg.action,
    payload: msg.payload || {}
  };

  try {
    mkdirSync(ipcDir, { recursive: true });
    writeFileSync(cmdPath, JSON.stringify(cmdData), 'utf8');
  } catch (err) {
    console.error(`[WS] Failed to write widget command to ${cmdPath}:`, err);
  }
}

function handleWidgetStateSave(msg: any) {
  if (!msg.instance || !msg.state) return;
  const safeInstance = msg.instance.replace(/[^a-zA-Z0-9_-]/g, '');
  const stateDir = join(process.cwd(), 'state', 'widgets');
  const statePath = join(stateDir, `${safeInstance}.json`);
  
  try {
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(statePath, JSON.stringify(msg.state), 'utf8');
  } catch (err) {
    console.error(`[WS] Failed to save widget state to ${statePath}:`, err);
  }
}
