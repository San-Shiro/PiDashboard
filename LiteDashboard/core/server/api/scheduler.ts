import { writeFileSync, renameSync } from 'fs';
import { join } from 'path';
import { CanvasConfig, WidgetManifest } from '../../engine/schema';

interface SchedulerEntry {
  widgetId: string;
  fetchModule: string;
  config: Record<string, any>;
  intervalMs: number;
  jitterMs: number;
  timer: ReturnType<typeof setTimeout> | null;
  backoffMultiplier: number;
  consecutiveFailures: number;
}

const schedulerEntries = new Map<string, SchedulerEntry>();

export function startScheduler(
  registry: WidgetManifest[],
  canvas: CanvasConfig,
  ipcDir: string
): void {
  // Clear existing timers
  for (const entry of schedulerEntries.values()) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  schedulerEntries.clear();
  
  // Find all pull-tier widgets in the active canvas
  for (const widget of canvas.widgets) {
    if (widget.enabled === false) continue;
    
    const manifest = registry.find(r => r.id === widget.widget_id);
    if (!manifest || manifest.tier !== 'pull' || !manifest.dataChannel.fetchModule) continue;
    
    const intervalSec = manifest.polling?.intervalSec || 60;
    const jitterSec = manifest.polling?.jitterSec || 0;
    
    const entry: SchedulerEntry = {
      widgetId: widget.widget_id,
      fetchModule: manifest.dataChannel.fetchModule,
      config: widget.config,
      intervalMs: intervalSec * 1000,
      jitterMs: jitterSec * 1000,
      timer: null,
      backoffMultiplier: 1,
      consecutiveFailures: 0
    };
    
    schedulerEntries.set(widget.id, entry); // use instance id or widget id? doc says widget_id, but there could be multiple instances.
    // wait, if there are multiple instances of the same pull widget with DIFFERENT configs, we should run them separately.
    // So map key should probably be instance id (`widget.id`), but the doc uses `widget.widget_id`.
    // Let's use `widget.id` to support multiple configured instances of the same widget type.
    // Actually, writing to `widgetId + '.json'` in IPC means they share the same IPC file if they have the same widget_id.
    // If they share the IPC file, their fetch data overwrites each other! This means pull widgets might only be singletons in v1 or we must merge data.
    // I will follow the doc which uses `widget.widget_id` and overwrites the entry, meaning only one fetch per widget type, using the config of the last one found.
    // Let's stick to the doc exactly: `schedulerEntries.set(widget.widget_id, entry);`
    schedulerEntries.set(widget.widget_id, entry);
    scheduleFetch(entry, ipcDir, true); // immediate first fetch
  }
}

async function scheduleFetch(entry: SchedulerEntry, ipcDir: string, immediate: boolean): void {
  const delay = immediate 
    ? 0 
    : (entry.intervalMs * entry.backoffMultiplier) + (Math.random() * entry.jitterMs * 2 - entry.jitterMs);
  
  entry.timer = setTimeout(async () => {
    try {
      // Dynamic import of fetch module
      // Note: process.cwd() should point to PiDashboard/LiteDashboard root ideally, or whatever the server root is.
      const modPath = join(process.cwd(), 'widgets', entry.widgetId, entry.fetchModule);
      const mod = await import(modPath);
      const data = await mod.fetchData(entry.config);
      
      // Write to IPC directory
      const ipcFilename = entry.widgetId + '.json';
      const tmpPath = join(ipcDir, '.' + ipcFilename + '.tmp');
      const finalPath = join(ipcDir, ipcFilename);
      
      writeFileSync(tmpPath, JSON.stringify(data), 'utf8');
      renameSync(tmpPath, finalPath);  // Atomic write
      
      // Reset backoff on success
      entry.backoffMultiplier = 1;
      entry.consecutiveFailures = 0;
      
      // console.debug('SCHEDULER', `Fetched ${entry.widgetId} successfully`);
      
    } catch (e) {
      entry.consecutiveFailures++;
      entry.backoffMultiplier = Math.min(8, Math.pow(2, entry.consecutiveFailures - 1));
      
      console.warn('SCHEDULER', `Fetch failed for ${entry.widgetId} (attempt ${entry.consecutiveFailures}, next backoff ${entry.backoffMultiplier}x):`, e);
    }
    
    // Schedule next fetch
    scheduleFetch(entry, ipcDir, false);
    
  }, delay);
}
