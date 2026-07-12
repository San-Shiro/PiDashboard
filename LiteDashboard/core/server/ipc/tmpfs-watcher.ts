import { watch, readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { stateStore } from '../state/state-store';
import { websocketHandler } from '../ws/display'; // For scheduleBroadcast, wait we can just use patch

const DEBOUNCE_MS = 50;

// Exported for testing
export function updateStateCache(type: string, data: any) {
  try {
    stateStore.patch(type, data);
    
    // Broadcast via WS
    // The easiest way is to mock a patch message to websocketHandler.
    // However, stateStore.patch itself does not trigger broadcast.
    // display.ts handles broadcasting manually. 
    // We should directly call the internal function or mock a patch message.
    websocketHandler.message({} as any, JSON.stringify({
      type: 'patch',
      widget: type,
      instance: 'global',
      delta: data
    }));
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

  // Read initial files to populate state instantly (fixes widgets like weather stuck on Loading)
  try {
    const files = readdirSync(ipcDir);
    for (const filename of files) {
      if (!filename.endsWith('.json') || filename.endsWith('.cmd.json')) continue;
      const type = basename(filename, '.json');
      const fullPath = join(ipcDir, filename);
      try {
        const content = readFileSync(fullPath, 'utf8').trim();
        if (content) {
          const data = JSON.parse(content);
          if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
            callback(type, data);
          }
        }
      } catch (e) {
        // Ignore parse errors on boot
      }
    }
  } catch (err) {
    console.error('[IPC] Failed to read initial IPC directory:', err);
  }

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
        
        const content = readFileSync(fullPath, 'utf8').trim();
        if (!content) return; // Empty file
        
        const data = JSON.parse(content);
        if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
          callback(type, data);
        }
        
      } catch (e) {
        // Ignore parse errors (partially written files, corrupted)
      }
    }, DEBOUNCE_MS));
  });

  console.log(`[IPC] Watching ${ipcDir} for daemon updates...`);
}
