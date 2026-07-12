# 11 — IPC Pipeline

> Parent: [Architecture Overview](./00-architecture-overview.md) · Source: `core/server/ipc/tmpfs-watcher.ts`, `core/server/api/scheduler.ts`

---

## Architecture

```
Writer (daemon/scheduler)  →  /tmp/widgets/<name>.json  →  fs.watch  →  stateCache  →  WS broadcast
```

---

## IPC Directory

| Environment | Path | Filesystem | Persistence |
|:---|:---|:---|:---|
| Linux (production) | `/tmp/widgets/` | tmpfs (RAM) | No — cleared on reboot |
| Linux (custom) | Configurable via `PIDASHBOARD_IPC_DIR` env var | Any | Depends on mount |
| Windows/Mac (dev) | `<project>/state/cache/widgets/` | Disk | Yes |

### Directory Initialization

```typescript
export function initIpcDir(): string {
  const dir = process.env.PIDASHBOARD_IPC_DIR 
    || (process.platform === 'linux' ? '/tmp/widgets' : join(process.cwd(), 'state', 'cache', 'widgets'));
  
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  return dir;
}
```

**Potential error:** On Linux, `/tmp` may not be tmpfs (some distros mount it on disk). Verify with `df /tmp | grep tmpfs`. If not tmpfs, performance degrades from ~50K writes/sec to ~5K writes/sec (still fine for normal use).

---

## File Watcher

### Core Implementation

```typescript
const debounceTimers = new Map<string, Timer>();
const DEBOUNCE_MS = 100;

export function startIpcWatcher(
  ipcDir: string,
  onData: (widgetType: string, data: any) => void
): void {
  // Watch the directory
  const watcher = watch(ipcDir, (event, filename) => {
    if (!filename) return;
    if (!filename.endsWith('.json')) return;
    if (filename.endsWith('.cmd.json')) return;  // Command files are consumed by daemons, not us
    if (filename.startsWith('.')) return;         // Temp files
    
    const widgetType = filename.replace('.json', '');
    
    // Per-file debounce
    const existing = debounceTimers.get(filename);
    if (existing) clearTimeout(existing);
    
    debounceTimers.set(filename, setTimeout(() => {
      debounceTimers.delete(filename);
      readAndDispatch(ipcDir, filename, widgetType, onData);
    }, DEBOUNCE_MS));
  });
  
  // Also do an initial scan of existing files
  for (const file of readdirSync(ipcDir)) {
    if (file.endsWith('.json') && !file.endsWith('.cmd.json') && !file.startsWith('.')) {
      readAndDispatch(ipcDir, file, file.replace('.json', ''), onData);
    }
  }
}
```

### File Read with Error Handling

```typescript
function readAndDispatch(
  dir: string, 
  filename: string, 
  widgetType: string, 
  onData: (widgetType: string, data: any) => void
): void {
  const filepath = join(dir, filename);
  
  try {
    // Check file exists (could have been deleted between watch event and read)
    if (!existsSync(filepath)) return;
    
    const content = readFileSync(filepath, 'utf8');
    
    // Skip empty files (daemon may write empty file first, then content)
    if (!content.trim()) return;
    
    const data = JSON.parse(content);
    onData(widgetType, data);
    
  } catch (e) {
    if (e instanceof SyntaxError) {
      // Invalid JSON — daemon wrote partial content or corrupt data
      // This is expected during atomic writes (write to .tmp then rename)
      // Silent skip — the next write will be complete
      logger.debug('IPC', `Invalid JSON in ${filename}, skipping`);
    } else {
      logger.warn('IPC', `Error reading ${filename}: ${e}`);
    }
  }
}
```

### Debouncing Strategy

**Per-file, not global.** Each IPC file has its own debounce timer.

```
sysinfo.json written at T+0ms     → timer starts (100ms)
sysinfo.json written at T+50ms    → timer reset (100ms from now)
sysinfo.json written at T+150ms   → first timer fires, reads file
weather.json written at T+80ms    → separate timer starts (100ms)
weather.json timer fires at T+180ms
sysinfo.json timer fires at T+250ms
```

**Why 100ms?** Balances responsiveness vs CPU on Pi Zero:
- Lower (10ms): More responsive but more syscalls, higher CPU
- Higher (500ms): Lower CPU but visible lag on sysinfo updates
- 100ms: ~10 reads/sec max per file, imperceptible delay, minimal CPU

---

## State Cache

In-memory cache of latest data per widget type.

```typescript
const stateCache = new Map<string, { data: any; timestamp: number }>();

export function updateStateCache(widgetType: string, data: any): void {
  stateCache.set(widgetType, { data, timestamp: Date.now() });
}

export function getStateCache(): Map<string, { data: any; timestamp: number }> {
  return stateCache;
}

export function getStateCacheEntry(widgetType: string): any | null {
  return stateCache.get(widgetType)?.data || null;
}
```

**Used for:**
1. **WebSocket state hydration:** When a new kiosk connects, send all cached data immediately so widgets don't show "Loading..." until the next daemon write.
2. **Compositor:** Can embed latest data in the HTML for instant rendering (optional, not in v1).

---

## Scheduler (Pull Tier)

The scheduler manages fetch timers for `pull` tier widgets.

```typescript
interface SchedulerEntry {
  widgetId: string;
  fetchModule: string;
  config: Record<string, any>;
  intervalMs: number;
  jitterMs: number;
  timer: Timer | null;
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
    const manifest = registry.find(r => r.id === widget.widget_id);
    if (!manifest || manifest.tier !== 'pull') continue;
    
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
    
    schedulerEntries.set(widget.widget_id, entry);
    scheduleFetch(entry, ipcDir, true); // true = immediate first fetch
  }
}

async function scheduleFetch(entry: SchedulerEntry, ipcDir: string, immediate: boolean): void {
  const delay = immediate 
    ? 0 
    : (entry.intervalMs * entry.backoffMultiplier) + (Math.random() * entry.jitterMs * 2 - entry.jitterMs);
  
  entry.timer = setTimeout(async () => {
    try {
      // Dynamic import of fetch module
      const mod = await import(join(process.cwd(), 'widgets', entry.widgetId, entry.fetchModule));
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
      
      logger.debug('SCHEDULER', `Fetched ${entry.widgetId} successfully`);
      
    } catch (e) {
      entry.consecutiveFailures++;
      entry.backoffMultiplier = Math.min(8, Math.pow(2, entry.consecutiveFailures - 1));
      
      logger.warn('SCHEDULER', `Fetch failed for ${entry.widgetId} (attempt ${entry.consecutiveFailures}, next backoff ${entry.backoffMultiplier}x): ${e}`);
    }
    
    // Schedule next fetch
    scheduleFetch(entry, ipcDir, false);
    
  }, delay);
}
```

### Backoff Strategy

```
Attempt 1: fail → backoff 1x (normal interval)
Attempt 2: fail → backoff 2x
Attempt 3: fail → backoff 4x
Attempt 4: fail → backoff 8x (cap)
Attempt 5+: fail → backoff 8x (stays at cap)

On success: reset to 1x immediately
```

For a 60-second interval:
```
Fail 1: retry in 60s
Fail 2: retry in 120s
Fail 3: retry in 240s
Fail 4+: retry in 480s (8 minutes)
```

---

## Throughput Analysis

| Component | Throughput on Pi Zero | Bottleneck? |
|:---|:---|:---|
| tmpfs write (1KB) | ~50,000/sec | ❌ |
| `fs.watch` (inotify) | ~100-500 events/sec | ⚠️ (with many files) |
| Debounce (100ms) | 10 reads/sec per file | By design |
| JSON.parse (1KB) | ~200,000/sec | ❌ |
| stateCache.set() | >1,000,000/sec | ❌ |
| WS broadcast (10 clients) | ~10,000 msgs/sec | ❌ |

**Realistic load:** 10 push widgets updating every 2 seconds + 5 pull widgets polling every 60 seconds = ~5 events/sec. The pipeline handles this trivially.

**Stress limit:** ~40-50 file changes/sec across all widgets before fs.watch starts dropping events. This is well beyond any realistic dashboard configuration.

---

## Potential Errors

| Error | Cause | Impact | Handling |
|:---|:---|:---|:---|
| File deleted between watch and read | Daemon removes old data | `readFileSync` throws ENOENT | `existsSync` check before read |
| Partial JSON read | Daemon mid-write | `JSON.parse` throws SyntaxError | Silent skip, next write will be complete |
| IPC directory doesn't exist | First boot, no daemon running yet | `watch` throws ENOENT | `initIpcDir()` creates it |
| Too many open files | >1000 widgets (impossible in practice) | OS ulimit hit | Not a concern for realistic widget counts |
| `fs.watch` not reliable on network mounts | IPC dir on NFS/CIFS | Events missed | Don't put IPC dir on network mounts. tmpfs only. |
| Daemon writes huge JSON (>1MB) | Bug in daemon | Memory spike | Log warning; consider adding file size check before read |
| Scheduler fetch module has syntax error | Bug in widget code | Dynamic import fails | try/catch prevents crash, error logged, backoff applied |
| Atomic rename fails | Cross-filesystem rename | `renameSync` throws EXDEV | Ensure tmp file and final file are in same directory |

---

## Code Reminders

- **Always use atomic writes.** Write to `.tmp` then `rename()`. Never write directly to the final path — partial reads cause JSON parse errors.
- **`.cmd.json` files are NOT watched.** The watcher ignores command files (they're consumed by daemons, not by us). Only data `.json` files trigger callbacks.
- **`fs.watch` is NOT recursive.** It watches the directory, not subdirectories. All IPC files must be in the root of the IPC directory.
- **The debounce timer is per-file, not global.** A write to `sysinfo.json` doesn't delay reading `weather.json`.
- **State cache never expires.** Old data stays in the cache until overwritten. If a daemon crashes, the cache holds the last good data indefinitely. This is intentional — stale data is better than "Loading..." on a kiosk.
- **The scheduler does NOT watch for canvas changes.** When the active canvas changes (publish/apply), the server must call `startScheduler()` again with the new canvas to reconfigure timers.
