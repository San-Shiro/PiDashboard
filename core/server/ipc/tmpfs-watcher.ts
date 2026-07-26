import { watch, readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { stateStore } from '../state/state-store';
import { websocketHandler, pushAck } from '../ws/display';

const DEBOUNCE_MS = 50;

// Exported for testing
export function updateStateCache(type: string, data: any, instance: string = 'global') {
  try {
    // A daemon may embed a command acknowledgement in its state write
    // (Phase 3.4). Split it out so it is never merged into the store or
    // persisted to disk — it is delivered as a separate ack signal instead.
    let ack: any = null;
    let cleanData = data;
    if (data && typeof data === 'object' && data._ack) {
      ack = data._ack;
      cleanData = { ...data };
      delete cleanData._ack;
    }

    const stateKey = instance === 'global' ? type : `${type}:${instance}`;
    stateStore.patch(stateKey, cleanData);

    // Broadcast via WS by mocking a patch message to websocketHandler.
    websocketHandler.message({} as any, JSON.stringify({
      type: 'patch',
      widget: type,
      instance: instance,
      delta: cleanData
    }));

    if (ack) pushAck(type, instance, ack);
  } catch (e) {
    console.error(`[IPC] Failed to update state for ${type}:`, e);
  }
}

export function getStateCacheEntry(type: string) {
  return stateStore.get(type);
}

export function startIpcWatcher(ipcDir: string, callback = updateStateCache) {
  if (!existsSync(ipcDir)) return;

  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const lastMtime = new Map<string, number>();

  const syncIpcDir = () => {
    try {
      const files = readdirSync(ipcDir);
      for (const filename of files) {
        if (!filename.endsWith('.json') || filename.endsWith('.cmd.json')) continue;
        const type = basename(filename, '.json');
        const fullPath = join(ipcDir, filename);
        try {
          const stats = require('fs').statSync(fullPath);
          const prevMtime = lastMtime.get(filename) || 0;
          if (stats.mtimeMs <= prevMtime) continue;
          
          lastMtime.set(filename, stats.mtimeMs);
          
          const content = readFileSync(fullPath, 'utf8').trim();
          if (content) {
            const data = JSON.parse(content);
            if (typeof data === 'object' && data !== null) {
              const parts = type.split('__');
              const widget = parts[0];
              const instance = parts.length > 1 ? parts[1] : 'global';
              callback(widget, data, instance);
            }
          }
        } catch (e) {
          // Ignore parse errors on boot/sync
        }
      }
    } catch (err) {
      console.error('[IPC] Failed to sync IPC directory:', err);
    }
  };

  // Read initial files to populate state instantly
  syncIpcDir();
  
  // Polling fallback every 60s in case inotify watch silently drops
  setInterval(syncIpcDir, 60000);

  watch(ipcDir, (eventType, filename) => {
    if (!filename) return;
    if (!filename.endsWith('.json')) return;
    if (filename.endsWith('.cmd.json')) return;

    const type = basename(filename, '.json');
    const fullPath = join(ipcDir, filename);

    if (timers.has(filename)) {
      clearTimeout(timers.get(filename)!);
    }

    timers.set(filename, setTimeout(() => {
      timers.delete(filename!);
      
      try {
        if (!existsSync(fullPath)) return; // File deleted
        
        const stats = require('fs').statSync(fullPath);
        lastMtime.set(filename, stats.mtimeMs);
        
        const content = readFileSync(fullPath, 'utf8').trim();
        if (!content) return; // Empty file
        
        const data = JSON.parse(content);
        if (typeof data === 'object' && data !== null) {
          const parts = type.split('__');
          const widget = parts[0];
          const instance = parts.length > 1 ? parts[1] : 'global';
          callback(widget, data, instance);
        }
        
      } catch (e) {
        // Ignore parse errors (partially written files, corrupted)
      }
    }, DEBOUNCE_MS));
  });

  console.log(`[IPC] Watching ${ipcDir} for daemon updates...`);
}
