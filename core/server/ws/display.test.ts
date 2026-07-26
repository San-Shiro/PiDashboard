import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { 
  websocketHandler, 
  pushData, 
  pushReload, 
  getDisplayStatuses,
  ServerWebSocket
} from './display';
import { updateStateCache } from '../ipc/tmpfs-watcher';
import { readFileSync, existsSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock ServerWebSocket
function mockWs(readyState = 1): ServerWebSocket {
  return {
    readyState,
    send: mock((data: string | Uint8Array) => {})
  };
}

describe('WebSocket Pipeline', () => {
  beforeEach(() => {
    // Reset global state if possible, though they are inside the module
    // We can simulate closing connections to clear them
  });
  
  it('pushData sends to all connected kiosks', () => {
    const ws1 = mockWs();
    const ws2 = mockWs();
    websocketHandler.open(ws1);
    websocketHandler.open(ws2);
    
    pushData('weather', { temp: 32 });
    
    const expected = JSON.stringify({ type: 'data', widget: 'weather', data: { temp: 32 } });
    expect(ws1.send).toHaveBeenCalledWith(expected);
    expect(ws2.send).toHaveBeenCalledWith(expected);
    
    websocketHandler.close(ws1);
    websocketHandler.close(ws2);
  });
  
  it('skips closed connections', () => {
    const wsOpen = mockWs(1);
    const wsClosed = mockWs(3);  // CLOSED
    websocketHandler.open(wsOpen);
    websocketHandler.open(wsClosed);
    
    pushData('sysinfo', { cpu: 18 });
    
    expect(wsOpen.send).toHaveBeenCalled();
    expect(wsClosed.send).not.toHaveBeenCalled();
    
    websocketHandler.close(wsOpen);
    websocketHandler.close(wsClosed);
  });
  
  it('state hydration sends all cached data on connect', () => {
    updateStateCache('weather', { temp: 32 });
    updateStateCache('sysinfo', { cpu: 18 });
    
    const ws = mockWs();
    websocketHandler.open(ws);
    
    expect(ws.send).toHaveBeenCalledTimes(2);
    websocketHandler.close(ws);
  });
  
  it('pushReload sends reload to all kiosks', () => {
    const ws = mockWs();
    websocketHandler.open(ws);
    
    pushReload();
    
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'reload' }));
    websocketHandler.close(ws);
  });
  
  it('handles heartbeat message', () => {
    const ws = mockWs();
    websocketHandler.open(ws);
    
    websocketHandler.message(ws, JSON.stringify({
      type: 'heartbeat',
      canvas_id: 'test',
      uptime: 3600,
      widget_errors: 0,
      timestamp: Date.now()
    }));
    
    const statuses = getDisplayStatuses();
    expect(statuses.length).toBe(1);
    expect(statuses[0].canvasId).toBe('test');
    expect(statuses[0].status).toBe('online');
    
    websocketHandler.close(ws);
  });
  
  it('survives invalid JSON message', () => {
    const ws = mockWs();
    websocketHandler.open(ws);
    
    expect(() => websocketHandler.message(ws, 'not json')).not.toThrow();
    
    websocketHandler.close(ws);
  });
  
  it('removes dead connections on send error', () => {
    const ws = mockWs();
    ws.send = mock(() => { throw new Error('dead'); });
    websocketHandler.open(ws);
    
    pushData('weather', { temp: 32 });
    
    // Status should be cleaned up
    const statuses = getDisplayStatuses();
    expect(statuses.length).toBe(0);
  });
  
  it('updateStateCache broadcasts live state to already-connected displays', async () => {
    const ws = mockWs();
    websocketHandler.open(ws);

    // Live update AFTER connect — exercises the internal mock-socket broadcast
    // path (a bare {} socket) that role-gating must not throw on.
    updateStateCache('livewidget', { v: 1 }, 'global');
    await new Promise(r => setTimeout(r, 250));

    const calls = (ws.send as any).mock.calls.map((c: any[]) => String(c[0]));
    const stateMsg = calls.find((c: string) => c.includes('"widget":"livewidget"') && c.includes('"type":"state"'));
    expect(stateMsg).toBeTruthy();

    websocketHandler.close(ws);
  });

  it('updateStateCache emits an ack and strips _ack from broadcast state', async () => {
    const ws = mockWs();
    websocketHandler.open(ws);

    updateStateCache('ackwidget', { foo: 1, _ack: { id: 'a1', ok: true } }, 'instX');
    await new Promise(r => setTimeout(r, 250));

    const calls = (ws.send as any).mock.calls.map((c: any[]) => String(c[0]));

    const ackMsg = calls.find((c: string) => c.includes('"type":"ack"') && c.includes('"id":"a1"'));
    expect(ackMsg).toBeTruthy();

    const stateMsg = calls.find((c: string) => c.includes('"widget":"ackwidget"') && c.includes('"type":"state"'));
    expect(stateMsg).toBeTruthy();
    expect(stateMsg.includes('_ack')).toBe(false);

    websocketHandler.close(ws);
  });

  it('handles widget_command and writes to IPC', () => {
    const ipcDir = join(tmpdir(), 'pi-dashboard-ipc-test');
    try { mkdirSync(ipcDir, { recursive: true }); } catch (e) {}
    process.env.IPC_DIR = ipcDir;
    
    const ws = mockWs();
    websocketHandler.open(ws);
    
    websocketHandler.message(ws, JSON.stringify({
      type: 'widget_command',
      widget: 'mpd-player',
      action: 'toggle',
      payload: { test: 1 }
    }));
    
    const cmdPath = join(ipcDir, 'mpd-player.cmd.json');
    expect(existsSync(cmdPath)).toBe(true);
    
    const cmd = JSON.parse(readFileSync(cmdPath, 'utf8'));
    expect(cmd.action).toBe('toggle');
    expect(cmd.payload.test).toBe(1);
    
    unlinkSync(cmdPath);
    websocketHandler.close(ws);
  });
  
  it('handles widget_state_save and persists to disk', () => {
    const ws = mockWs();
    websocketHandler.open(ws);
    
    websocketHandler.message(ws, JSON.stringify({
      type: 'widget_state_save',
      instance: 'test-instance-123',
      state: { text: 'hello' }
    }));
    
    const statePath = join(process.cwd(), 'state', 'widgets', 'test-instance-123.json');
    expect(existsSync(statePath)).toBe(true);
    
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    expect(state.text).toBe('hello');
    
    try { unlinkSync(statePath); } catch (e) {}
    websocketHandler.close(ws);
  });
});
