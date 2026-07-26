import { describe, it, expect, beforeEach } from 'bun:test';
import { mkdtempSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { startIpcWatcher, updateStateCache, getStateCacheEntry } from './tmpfs-watcher';

// Helper for timing in tests
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('IPC Pipeline', () => {
  let ipcDir: string;
  
  beforeEach(() => {
    ipcDir = mkdtempSync(join(tmpdir(), 'ipc-test-'));
  });
  
  it('detects new JSON file', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'sysinfo.json'), '{"cpu":42}');
    await sleep(200); // Debounce + read
    
    expect(received.length).toBe(1);
    expect(received[0].type).toBe('sysinfo');
    expect(received[0].data.cpu).toBe(42);
  });
  
  it('debounces rapid writes to same file', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    // Write 5 times in 50ms
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(ipcDir, 'sysinfo.json'), JSON.stringify({ cpu: i }));
      await sleep(10);
    }
    
    await sleep(200);
    
    // Should have fired once (or possibly twice depending on timing)
    expect(received.length).toBeLessThanOrEqual(2);
    expect(received[received.length - 1].data.cpu).toBe(4); // Last value
  });
  
  it('handles separate files independently', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'sysinfo.json'), '{"cpu":1}');
    writeFileSync(join(ipcDir, 'weather.json'), '{"temp":32}');
    await sleep(200);
    
    expect(received.length).toBe(2);
    expect(received.map(r => r.type).sort()).toEqual(['sysinfo', 'weather']);
  });
  
  it('ignores .cmd.json files', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'mpd.cmd.json'), '{"action":"play"}');
    await sleep(200);
    
    expect(received.length).toBe(0);
  });
  
  it('ignores non-JSON files', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'readme.txt'), 'hello');
    await sleep(200);
    
    expect(received.length).toBe(0);
  });
  
  it('handles corrupted JSON without crashing', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'broken.json'), 'not json{{{');
    await sleep(200);
    
    expect(received.length).toBe(0); // Skipped, no crash
  });
  
  it('handles empty file without crashing', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    writeFileSync(join(ipcDir, 'empty.json'), '');
    await sleep(200);
    
    expect(received.length).toBe(0);
  });
  
  it('handles file deletion without crashing', async () => {
    const received: any[] = [];
    startIpcWatcher(ipcDir, (type, data) => received.push({ type, data }));
    
    const path = join(ipcDir, 'temp.json');
    writeFileSync(path, '{"val":1}');
    await sleep(200);
    
    unlinkSync(path);
    await sleep(200);
    
    // Should have received once, no crash on delete
    expect(received.length).toBe(1);
  });
  
  it('updates stateCache on change', async () => {
    startIpcWatcher(ipcDir, (type, data) => updateStateCache(type, data));
    
    writeFileSync(join(ipcDir, 'weather.json'), '{"temp":25}');
    await sleep(200);
    
    expect(getStateCacheEntry('weather')).toEqual({ temp: 25 });
  });
});
