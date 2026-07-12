# 12 — WebSocket Protocol

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `core/server/ws/display.ts`, `core/server/index.ts`

---

## Connection Architecture

```
                    ┌─────────────────────────┐
                    │      Bun WS Server      │
                    │                         │
                    │  /ws/display endpoint    │
  Kiosk Browser ◄──┤                         │
  Admin Panel ◄────┤  Connection Registry:    │
  Phone Viewer ◄───┤  Set<ServerWebSocket>    │
                    │                         │
                    └─────────────────────────┘
```

All kiosk displays and admin viewers connect to the same WebSocket endpoint.

---

## Message Types

### Server → Client (Downlink)

| Type | Trigger | Payload | Description |
|:---|:---|:---|:---|
| `data` | IPC file change | `{ type: "data", widget: string, data: any }` | Live widget data update |
| `reload` | Canvas published/applied | `{ type: "reload" }` | Tell display to reload the page |
| `maintenance` | Maintenance mode toggle | `{ type: "maintenance", enabled: boolean }` | Switch to/from maintenance page |
| `hydrate` | New connection | Multiple `data` messages | Send all cached state on connect |

### Client → Server (Uplink)

| Type | Trigger | Payload | Description |
|:---|:---|:---|:---|
| `heartbeat` | 30s interval | `{ type: "heartbeat", canvas_id, uptime, widget_errors, timestamp }` | Display health report |
| `widget_command` | User interaction | `{ type: "widget_command", widget, action, payload }` | Interactive widget command |
| `widget_state_save` | Widget persistence | `{ type: "widget_state_save", instance, state }` | Persist widget state to disk |

---

## Server Implementation

### Connection Handling

```typescript
const kiosks = new Set<ServerWebSocket>();

// In Bun.serve websocket config:
websocket: {
  open(ws) {
    kiosks.add(ws);
    logger.info('WS', `Display connected (${kiosks.size} total)`);
    
    // State hydration: send all cached data
    const cache = getStateCache();
    for (const [widgetType, entry] of cache) {
      ws.send(JSON.stringify({
        type: 'data',
        widget: widgetType,
        data: entry.data
      }));
    }
  },
  
  close(ws) {
    kiosks.delete(ws);
    displayStatus.delete(ws);
    logger.info('WS', `Display disconnected (${kiosks.size} remaining)`);
  },
  
  message(ws, rawMsg) {
    try {
      const msg = JSON.parse(typeof rawMsg === 'string' ? rawMsg : new TextDecoder().decode(rawMsg));
      
      switch (msg.type) {
        case 'heartbeat':
          handleHeartbeat(ws, msg);
          break;
        case 'widget_command':
          handleWidgetCommand(msg.widget, msg.action, msg.payload);
          break;
        case 'widget_state_save':
          handleWidgetStateSave(msg.instance, msg.state);
          break;
        default:
          logger.debug('WS', `Unknown message type: ${msg.type}`);
      }
    } catch (e) {
      logger.warn('WS', `Failed to parse message: ${e}`);
    }
  }
}
```

### Broadcasting

```typescript
export function pushData(widgetType: string, data: any): void {
  const msg = JSON.stringify({ type: 'data', widget: widgetType, data });
  
  for (const ws of kiosks) {
    try {
      if (ws.readyState === 1) {  // OPEN
        ws.send(msg);
      }
    } catch (e) {
      // Dead connection — will be cleaned up on close event
      logger.debug('WS', `Send failed, removing dead connection`);
      kiosks.delete(ws);
    }
  }
}

export function pushReload(): void {
  broadcast(JSON.stringify({ type: 'reload' }));
}

export function pushMaintenance(enabled: boolean): void {
  broadcast(JSON.stringify({ type: 'maintenance', enabled }));
}

function broadcast(msg: string): void {
  for (const ws of kiosks) {
    try {
      if (ws.readyState === 1) ws.send(msg);
    } catch { kiosks.delete(ws); }
  }
}
```

### Heartbeat Handler

```typescript
interface DisplayInfo {
  canvasId: string;
  uptime: number;          // Seconds
  widgetErrors: number;
  lastSeen: number;        // Date.now()
}

const displayStatus = new Map<ServerWebSocket, DisplayInfo>();

function handleHeartbeat(ws: ServerWebSocket, msg: any): void {
  displayStatus.set(ws, {
    canvasId: msg.canvas_id || 'unknown',
    uptime: msg.uptime || 0,
    widgetErrors: msg.widget_errors || 0,
    lastSeen: Date.now()
  });
}

// API endpoint for admin panel
export function getDisplayStatuses(): Array<{
  status: 'online' | 'stale' | 'offline';
  canvasId: string;
  uptime: string;
  widgetErrors: number;
  lastSeen: string;
}> {
  const now = Date.now();
  const result = [];
  
  for (const [ws, info] of displayStatus) {
    const ageSec = (now - info.lastSeen) / 1000;
    
    result.push({
      status: ageSec < 60 ? 'online' : ageSec < 120 ? 'stale' : 'offline',
      canvasId: info.canvasId,
      uptime: formatUptime(info.uptime),
      widgetErrors: info.widgetErrors,
      lastSeen: `${Math.floor(ageSec)}s ago`
    });
  }
  
  // Clean up truly dead entries (not in kiosks set anymore)
  for (const ws of displayStatus.keys()) {
    if (!kiosks.has(ws)) displayStatus.delete(ws);
  }
  
  return result;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
```

---

## Client Implementation (Injected by Compositor)

```javascript
(function() {
  var ws;
  var reconnectDelay = 1000;
  var maxReconnectDelay = 30000;
  
  function connect() {
    var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + location.host + '/ws/display');
    window.__piWs = ws;  // Expose to PiWidget SDK
    
    ws.onopen = function() {
      console.log('[WS] Connected');
      reconnectDelay = 1000;  // Reset backoff
    };
    
    ws.onmessage = function(event) {
      try {
        var msg = JSON.parse(event.data);
        
        switch (msg.type) {
          case 'data':
            // Dispatch to widget handlers via SDK
            PiWidget._dispatch(msg.widget, msg.data);
            
            // Also forward to community iframes
            var iframes = document.querySelectorAll('iframe[data-instance]');
            iframes.forEach(function(iframe) {
              var parent = iframe.closest('[data-widget]');
              if (parent && parent.dataset.widget === msg.widget) {
                iframe.contentWindow.postMessage({
                  type: 'widget_data',
                  payload: msg.data
                }, '*');
              }
            });
            break;
            
          case 'reload':
            console.log('[WS] Reload requested');
            location.reload();
            break;
            
          case 'maintenance':
            if (msg.enabled) {
              document.getElementById('kiosk-viewport').style.display = 'none';
              // Show maintenance page
              document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0d1117;color:#8b949e;font-family:sans-serif;"><h1>🔧 Maintenance</h1></div>';
            } else {
              location.reload();
            }
            break;
        }
      } catch (e) {
        console.error('[WS] Message parse error:', e);
      }
    };
    
    ws.onclose = function() {
      console.log('[WS] Disconnected, reconnecting in ' + reconnectDelay + 'ms');
      window.__piWs = null;
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
    };
    
    ws.onerror = function(e) {
      console.error('[WS] Error:', e);
    };
  }
  
  // Heartbeat
  setInterval(function() {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'heartbeat',
        canvas_id: (document.getElementById('kiosk-viewport') || {}).dataset?.canvasId || 'unknown',
        uptime: Math.floor(performance.now() / 1000),
        widget_errors: window.__widgetErrorCount || 0,
        timestamp: Date.now()
      }));
    }
  }, 30000);
  
  connect();
})();
```

### Reconnection Strategy

```
Disconnect → wait 1s → reconnect attempt
Fail → wait 2s → reconnect
Fail → wait 4s → reconnect
Fail → wait 8s → reconnect
...
Fail → wait 30s (cap) → reconnect
Success → reset delay to 1s
```

---

## State Hydration

When a kiosk connects (or reconnects), it may have missed data updates. The server sends all cached data immediately:

```typescript
// In ws.open handler:
const cache = getStateCache();
for (const [widgetType, entry] of cache) {
  ws.send(JSON.stringify({
    type: 'data',
    widget: widgetType,
    data: entry.data
  }));
}
```

This ensures widgets never show "Loading..." on reconnect — they immediately get the latest cached values.

---

## Message Size Budget

| Message | Typical Size | Max Expected |
|:---|:---|:---|
| heartbeat | ~120 bytes | ~200 bytes |
| widget_command | ~80 bytes | ~500 bytes |
| data (sysinfo) | ~500 bytes | ~2KB |
| data (weather) | ~300 bytes | ~1KB |
| reload | ~20 bytes | ~20 bytes |
| widget_state_save | ~200 bytes | ~50KB (notepad) |

**Total bandwidth:** With 10 widgets updating every 2s + heartbeat every 30s ≈ **~3KB/sec**. Negligible for local network.

---

## Potential Errors

| Error | Cause | Impact | Handling |
|:---|:---|:---|:---|
| Client sends invalid JSON | Bug or malicious client | Server throws | `try/catch` in message handler, log and ignore |
| WS send to closed connection | Race condition | `.send()` throws | `try/catch`, remove from `kiosks` set |
| Reconnect loop (server down) | Bun crashed or restarting | Display frozen | Exponential backoff with 30s cap, auto-reconnect on recovery |
| Heartbeat stops (tab backgrounded) | Browser throttles background tabs | Admin shows "stale" | Acceptable — chromium kiosk mode doesn't background tabs |
| Too many concurrent connections | Many admin panels open | Memory pressure | Each WS connection ≈ 2KB. 100 connections = 200KB. Not a concern |
| Message ordering | Two rapid updates | Widget sees old then new data | Acceptable — last update wins, no sequence guarantees needed |
| Binary WS message | Unexpected client | Parse fails | `TextDecoder` fallback in message handler |

---

## Code Reminders

- **`window.__piWs` is set by the WS client.** The PiWidget SDK references it for `sendCommand` and `saveState`. When WS disconnects, set it to `null` to prevent `send()` on closed socket.
- **Don't send heartbeat with `ws.ping()`.** Bun handles WS ping/pong automatically for connection keep-alive. Our heartbeat is an application-level message with data (canvas_id, errors), not a transport-level ping.
- **The `reload` message triggers `location.reload()`.** This is a full page reload. The compositor re-runs, SDK re-initializes, WS reconnects. It's intentionally heavy — only sent on canvas publish (rare event).
- **Community iframe forwarding requires `'*'` as origin** in `postMessage`. The iframe has no origin (loaded via `srcdoc`), so we can't restrict it.
- **Maintenance mode replaces the entire body.** When maintenance is disabled, we reload the page to restore normal rendering. Don't try to restore the DOM — just reload.
