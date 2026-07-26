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
const CMD_RATE_MAP_MAX = 500;

// A single path segment: no separators, no dots, so it cannot traverse.
const SAFE_SEGMENT_RE = /^[a-zA-Z0-9_-]{1,64}$/;

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

// Resolve the daemon owned by a given widget instance. The caller never
// supplies the daemon — it is derived from the instance's own manifest, so a
// widget cannot address a daemon it does not own.
// `commandName` null => ownership lookup only (legacy object-form commands).
function resolveCommand(instanceId: string, commandName: string | null): { daemonId: string; manifest: any } | null {
  const canvas = loadActiveCanvas();
  if (!canvas) return null;

  const widgets = canvas.widgets || [];
  const instance = widgets.find((w: any) => w.id === instanceId);
  if (!instance) return null;

  if (typeof instance.widget_id !== 'string' || !SAFE_SEGMENT_RE.test(instance.widget_id)) return null;
  const manifestPath = join(WIDGETS_DIR, instance.widget_id, 'manifest.json');
  if (!existsSync(manifestPath)) return null;

  let manifest: any;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { return null; }

  // manifest.daemon lands in a filesystem path — constrain it to a single
  // path segment so a hostile manifest cannot escape the IPC directory.
  if (typeof manifest.daemon !== 'string' || !SAFE_SEGMENT_RE.test(manifest.daemon)) return null;

  // Named commands are fail-CLOSED: a widget must declare `commands` in its
  // manifest to accept any. (Legacy object-form commands pass commandName=null
  // and are routed to the widget's own daemon without a name check.)
  if (commandName !== null) {
    const declared = Array.isArray(manifest.commands) ? manifest.commands : [];
    if (!declared.some((c: any) => c && c.name === commandName)) return null;
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
const admins = new Set<ServerWebSocket>();

const BROADCAST_DEBOUNCE_MS = 150;
const broadcastTimers = new Map<string, Timer>();

export const websocketHandler = {
  open(ws: ServerWebSocket) {
    if (!ws.data || !ws.data.role) {
      ws.data = { role: 'display', id: 'global' } as ClientMeta;
    }
    const meta = ws.data as ClientMeta;

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
    const meta = (ws.data || {}) as ClientMeta;
    displays.delete(ws);
    if (meta.role === 'admin') {
      admins.delete(ws);
      if (meta.id) daemonManager.setPreview(meta.id, null);
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

  // The client's declared role is ignored — the role was assigned at upgrade
  // from the session cookie. Only the canvas id is taken from `hello`.
  //
  // Daemon registration over WebSocket was REMOVED: the endpoint could not be
  // authenticated (daemons are arbitrary local processes with no session), so
  // any LAN host could claim a daemon id and receive its commands. Daemons
  // communicate through state/ipc/*.json files, which is also the language-
  // agnostic contract the architecture is built on.
  if (typeof msg.canvasId === 'string') meta.id = msg.canvasId.slice(0, 128);
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

// Patches arriving from a display socket must name a widget that actually
// exists on the active canvas. Without this, any unauthenticated LAN client
// could invent widget keys and grow the state store without bound.
// (Internal broadcasts pass trusted=true — daemon state legitimately uses
// keys that are not canvas widget ids.)
function isKnownWidget(widget: string, instance: string): boolean {
  const canvas = loadActiveCanvas();
  if (!canvas || !Array.isArray(canvas.widgets)) return false;
  return canvas.widgets.some((w: any) =>
    w && w.widget_id === widget && (instance === 'global' || w.id === instance));
}

function handlePatch(msg: any, trusted = false) {
  if (!msg.widget || !msg.delta) return;
  if (typeof msg.widget !== 'string') return;
  const safeWidget = msg.widget.replace(/[^a-zA-Z0-9_-]/g, '');
  const instance = msg.instance || 'global';
  if (typeof instance !== 'string') return;
  const safeInstance = instance.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!trusted && !isKnownWidget(safeWidget, safeInstance)) return;
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
  const name = typeof msg.name === 'string' ? msg.name : null;

  // The sender's instance is the ONLY routing input we trust. msg.daemon (if
  // present) is ignored entirely — previously the legacy branch forwarded it
  // verbatim, letting any widget command a daemon it did not own.
  if (typeof instance !== 'string' || !instance) return;
  const safeInstance = instance.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeInstance) return;

  // Resolve ownership BEFORE recording a rate-limit entry, so unknown
  // instances cannot grow cmdRateMap without bound.
  const resolved = resolveCommand(safeInstance, name);
  if (!resolved) return;

  const now = Date.now();
  let timestamps = cmdRateMap.get(safeInstance) || [];
  timestamps = timestamps.filter(t => now - t < CMD_RATE_WINDOW_MS);
  if (timestamps.length >= CMD_RATE_LIMIT) return;
  timestamps.push(now);
  if (!cmdRateMap.has(safeInstance) && cmdRateMap.size >= CMD_RATE_MAP_MAX) {
    for (const [k, ts] of cmdRateMap) {
      if (!ts.some(t => now - t < CMD_RATE_WINDOW_MS)) cmdRateMap.delete(k);
    }
    if (cmdRateMap.size >= CMD_RATE_MAP_MAX) return;
  }
  cmdRateMap.set(safeInstance, timestamps);

  const cmdPayload = name !== null
    ? { id: msg.id || `c${now}`, action: name, params: msg.params ?? {}, ts: now }
    : { id: msg.id || `c${now}`, action: 'legacy', data: msg.data ?? {}, ts: now };

  try {
    mkdirSync(IPC_DIR, { recursive: true });
    writeFileSync(join(IPC_DIR, `${resolved.daemonId}.cmd.json`), JSON.stringify(cmdPayload), 'utf8');
  } catch (err) {
    console.error(`[WS] Failed to write cmd for ${resolved.daemonId}:`, err);
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

// Trusted server-side state patch + broadcast (daemon IPC, daemon-manager).
// Bypasses the canvas-membership check that guards socket-supplied patches,
// since daemon state keys are not necessarily canvas widget ids. Prefer this
// over synthesizing a fake socket message.
export function applyTrustedPatch(widget: string, instance: string, delta: any): void {
  handlePatch({ widget, instance, delta }, true);
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
