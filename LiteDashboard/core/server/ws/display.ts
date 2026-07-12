import { stateStore } from '../state/state-store';
import { daemonManager } from '../daemon/daemon-manager';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface ServerWebSocket {
  readyState: number;
  send(data: string | Uint8Array): void;
  data: any; // Allow attaching client data
}

interface ClientMeta {
  role: 'display' | 'daemon' | 'admin' | 'unknown';
  id?: string; // canvasId or daemonId
}

const displays = new Set<ServerWebSocket>();
const daemons = new Map<string, ServerWebSocket>(); // daemonId -> ws
const admins = new Set<ServerWebSocket>();

const BROADCAST_DEBOUNCE_MS = 150;
const broadcastTimers = new Map<string, Timer>();

export const websocketHandler = {
  open(ws: ServerWebSocket) {
    ws.data = { role: 'display', id: 'global' } as ClientMeta;
    displays.add(ws);
    
    // Hydrate display with ALL states
    if (ws.readyState === 1) {
      const allStates = stateStore.getAll();
      for (const [key, data] of Object.entries(allStates)) {
        const parts = key.split(':');
        const widget = parts[0];
        const instance = parts.length > 1 ? parts[1] : 'global';
        
        try {
          ws.send(JSON.stringify({
            type: 'state',
            widget,
            instance,
            data
          }));
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
      
      switch (msg.type) {
        case 'hello':
          handleHello(ws, msg);
          break;
        case 'preview':
          handlePreview(ws, msg);
          break;
        case 'patch':
          handlePatch(msg);
          break;
        case 'cmd':
          handleCmd(msg);
          break;
        case 'subscribe_logs':
          handleSubscribeLogs(ws);
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
  if ((ws.data as any).initialized) return;
  (ws.data as any).initialized = true;

  if (msg.role === 'display' || msg.role === 'admin') {
    const isDisplay = msg.role === 'display';
    ws.data.role = msg.role;
    if (msg.canvasId) ws.data.id = msg.canvasId;
    
    if (isDisplay) {
      displays.add(ws);
    } else {
      admins.add(ws);
    }
    
    // Hydrate display/admin with ALL states
    const allStates = stateStore.getAll();
    for (const [key, data] of Object.entries(allStates)) {
      const parts = key.split(':');
      const widget = parts[0];
      const instance = parts.length > 1 ? parts[1] : 'global';
      
      ws.send(JSON.stringify({
        type: 'state',
        widget,
        instance,
        data
      }));
    }
  } else if (msg.role === 'daemon') {
    if (!msg.daemonId) return;
    const safeId = msg.daemonId.replace(/[^a-zA-Z0-9_-]/g, '');
    ws.data.role = 'daemon';
    ws.data.id = safeId;
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
  if (!msg.daemon || !msg.data) return;
  const safeDaemon = msg.daemon.replace(/[^a-zA-Z0-9_-]/g, '');
  
  const daemonWs = daemons.get(safeDaemon);
  if (daemonWs && daemonWs.readyState === 1) { // 1 = OPEN
    // Forward the cmd to the daemon exactly as-is
    daemonWs.send(JSON.stringify(msg));
  }
}

function scheduleBroadcast(key: string, widget: string, instance: string) {
  if (broadcastTimers.has(key)) return;
  
  const timer = setTimeout(() => {
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
  }, BROADCAST_DEBOUNCE_MS);
  
  broadcastTimers.set(key, timer);
}

export function pushReload(): void {
  for (const ws of displays) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'reload' }));
  }
}

export function pushData(widget: string, data: any): void {
  const msg = JSON.stringify({ type: 'data', widget, data });
  for (const ws of displays) {
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
  ws.data.role = 'display';
  if (msg.canvas_id) ws.data.id = msg.canvas_id;
  displays.add(ws);
}

function handleWidgetCommand(msg: any) {
  if (!msg.widget || !msg.action) return;
  const safeWidget = msg.widget.replace(/[^a-zA-Z0-9_-]/g, '');
  const ipcDir = process.env.IPC_DIR || '/tmp/widgets';
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
