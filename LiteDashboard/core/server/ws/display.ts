import { stateStore } from '../state/state-store';

export interface ServerWebSocket {
  readyState: number;
  send(data: string | Uint8Array): void;
  data: any; // Allow attaching client data
}

interface ClientMeta {
  role: 'display' | 'daemon' | 'unknown';
  id?: string; // canvasId or daemonId
}

const displays = new Set<ServerWebSocket>();
const daemons = new Map<string, ServerWebSocket>(); // daemonId -> ws

const BROADCAST_DEBOUNCE_MS = 150;
const broadcastTimers = new Map<string, Timer>();

export const websocketHandler = {
  open(ws: ServerWebSocket) {
    ws.data = { role: 'unknown' } as ClientMeta;
  },
  
  close(ws: ServerWebSocket) {
    const meta = ws.data as ClientMeta;
    if (meta.role === 'display') {
      displays.delete(ws);
    } else if (meta.role === 'daemon' && meta.id) {
      if (daemons.get(meta.id) === ws) {
        daemons.delete(meta.id);
      }
    }
  },
  
  message(ws: ServerWebSocket, rawMsg: string | Uint8Array) {
    try {
      const msgStr = typeof rawMsg === 'string' ? rawMsg : new TextDecoder().decode(rawMsg);
      const msg = JSON.parse(msgStr);
      
      switch (msg.type) {
        case 'hello':
          handleHello(ws, msg);
          break;
        case 'patch':
          handlePatch(msg);
          break;
        case 'cmd':
          handleCmd(msg);
          break;
        case 'heartbeat':
          // Legacy/health heartbeat, ignore for now
          break;
      }
    } catch (e) {
      // ignore malformed
    }
  }
};

function handleHello(ws: ServerWebSocket, msg: any) {
  if (msg.role === 'display') {
    ws.data = { role: 'display', id: msg.canvasId };
    displays.add(ws);
    
    // Hydrate display with ALL states
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
    ws.data = { role: 'daemon', id: safeId };
    daemons.set(safeId, ws);
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
    
    // Broadcast to all displays
    for (const ws of displays) {
      if (ws.readyState === 1) {
        ws.send(stateMsg);
      } else {
        displays.delete(ws);
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

export function pushMaintenance(enabled: boolean): void {
  for (const ws of displays) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'maintenance', enabled }));
  }
}
