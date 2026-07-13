import { spawn, spawnSync, execSync, ChildProcess } from 'child_process';
import { join, basename } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';
import { CanvasConfig } from '../../engine/schema';
import { addLog } from '../logger';

export interface DaemonStatus {
  id: string;
  state: 'stopped' | 'starting' | 'running' | 'crashed' | 'backoff' | 'dependency_missing';
  pid: number | null;
  uptimeSec: number;
  restartCount: number;
  lastError: string | null;
  healthy: boolean;
  missingDependencies?: string[];
}

interface ManagedDaemon {
  id: string;
  manifest: any; // The daemon.json or legacy equivalent
  process: ChildProcess | null;
  state: DaemonStatus['state'];
  startTime: number | null;
  restartCount: number;
  lastError: string | null;
  checkTimer: any;
  config: any; // Current widget config
  missingDependencies?: string[];
}

const ROOT = process.cwd();
const IPC_DIR = join(ROOT, 'state', 'ipc');
const WIDGETS_DIR = join(ROOT, 'widgets');

export class DaemonManager {
  private daemons = new Map<string, ManagedDaemon>();
  
  private activeCanvas: any = null;
  private previewCanvases = new Map<string, any>(); // ws client ID -> canvas
  
  constructor() {
    setInterval(() => this.healthCheckAll(), 15000); // 15s health check loop
  }

  /**
   * Set a preview canvas from a connected Admin UI, or null to remove it.
   */
  public setPreview(clientId: string, canvas: any | null) {
    if (canvas) {
      this.previewCanvases.set(clientId, canvas);
    } else {
      this.previewCanvases.delete(clientId);
    }
    this.reconcile(); // Re-evaluate required daemons
  }

  /**
   * Reconcile running daemons with the provided active and preview canvases.
   */
  public reconcile(canvas?: any) {
    if (canvas) {
      this.activeCanvas = canvas;
    }
    
    console.log('[DaemonManager] Reconciling daemons');
    
    // 1. Find which daemons are needed based on widgets in the active canvas(es)
    const requiredDaemons = new Map<string, any>(); // daemonId -> widget instance config
    
    const canvasArray = [];
    if (this.activeCanvas) canvasArray.push(this.activeCanvas);
    for (const c of this.previewCanvases.values()) canvasArray.push(c);

    for (const canvas of canvasArray) {
      if (!canvas || !canvas.widgets) continue;
      for (const widget of canvas.widgets) {
        if (widget.enabled === false) continue;
        
        const manifestPath = join(WIDGETS_DIR, widget.widget_id, 'manifest.json');
        if (!existsSync(manifestPath)) continue;
        
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
          if (manifest.daemon) {
            // If a widget requires a daemon, track it
            if (manifest.stateMode === 'instance') {
              if (!requiredDaemons.has(manifest.daemon)) {
                requiredDaemons.set(manifest.daemon, { _isInstances: true });
              }
              requiredDaemons.get(manifest.daemon)[widget.id] = widget.config || {};
            } else {
              requiredDaemons.set(manifest.daemon, widget.config || {});
            }
          }
        } catch (e) {
          console.warn(`[DaemonManager] Failed to read manifest for ${widget.widget_id}`);
        }
      }
    }
    
    // 2. Start new daemons, update configs for existing
    for (const [daemonId, config] of requiredDaemons.entries()) {
      if (!this.daemons.has(daemonId)) {
        this.startDaemon(daemonId, config);
      } else {
        const d = this.daemons.get(daemonId)!;
        d.config = config; // update config, daemon might read this on restart
      }
    }
    
    // 3. Stop daemons that are no longer needed
    for (const daemonId of this.daemons.keys()) {
      if (!requiredDaemons.has(daemonId)) {
        this.stopDaemon(daemonId);
      }
    }
  }

  public startDaemon(daemonId: string, config: any) {
    if (this.daemons.has(daemonId)) {
      const d = this.daemons.get(daemonId)!;
      if (d.state === 'running' || d.state === 'starting') return;
    }

    console.log(`[DaemonManager] Starting daemon: ${daemonId}`);
    
    let daemonManifest: any = {
      id: daemonId,
      communication: { mode: 'ipc_file', ipcFilename: `${daemonId}.json` },
      health: { strategy: 'file_mtime', maxStaleSec: 30, startupGraceSec: 10 },
      restart: { policy: 'on-failure', maxRestarts: 5, backoffBaseSec: 2, backoffMaxSec: 120 }
    };
    
    let cmd = '';
    let cwd = ROOT;
    
    // Try to load daemon.json
    // We assume the widget folder name is the daemonId for now, or we'd have to search.
    // For simplicity, we search widgets for a manifest.json with this daemon id, or fallback.
    const widgetDir = join(WIDGETS_DIR, daemonId); 
    const daemonJsonPath = join(widgetDir, 'daemon', 'daemon.json');
    const legacyDaemonPath = join(ROOT, 'daemons', `${daemonId}.sh`);
    const newDaemonPath = join(widgetDir, 'daemon', `${daemonId}.sh`);
    
    if (existsSync(daemonJsonPath)) {
      try {
        const loaded = JSON.parse(readFileSync(daemonJsonPath, 'utf8'));
        daemonManifest = { ...daemonManifest, ...loaded };
        cmd = daemonManifest.runtime?.command;
        cwd = daemonManifest.runtime?.cwd ? join(widgetDir, daemonManifest.runtime.cwd) : join(widgetDir, 'daemon');
      } catch (e) {
        console.warn(`[DaemonManager] Failed to read daemon.json for ${daemonId}`);
      }
    } else if (existsSync(newDaemonPath)) {
      cmd = `./${daemonId}.sh`;
      cwd = join(widgetDir, 'daemon');
    } else if (existsSync(legacyDaemonPath)) {
      cmd = `./${daemonId}.sh`;
      cwd = join(ROOT, 'daemons');
    } else {
      console.warn(`[DaemonManager] No executable found for daemon: ${daemonId}`);
      return;
    }

    const missingDeps = this.verifyDependencies(daemonManifest);

    const env = {
      ...process.env,
      PIDASH_IPC_DIR: IPC_DIR,
      PIDASH_IPC_FILE: join(IPC_DIR, basename(daemonManifest.communication.ipcFilename).replace(/[^a-zA-Z0-9_.-]/g, '')),
      PIDASH_DAEMON_ID: daemonId,
      PIDASH_CONFIG: JSON.stringify(config || {}),
      PIDASH_API_URL: `http://localhost:${process.env.PORT || 3000}`
    };

    const d: ManagedDaemon = {
      id: daemonId,
      manifest: daemonManifest,
      process: null,
      state: 'starting',
      startTime: Date.now(),
      restartCount: this.daemons.get(daemonId)?.restartCount || 0,
      lastError: null,
      checkTimer: null,
      config,
      missingDependencies: missingDeps
    };
    
    this.daemons.set(daemonId, d);

    if (missingDeps.length > 0) {
      console.warn(`[DaemonManager] Daemon ${daemonId} missing dependencies: ${missingDeps.join(', ')}`);
      d.state = 'dependency_missing';
      return;
    }
    
    try {
      // Split command string if needed, or use shell:true
      d.process = spawn(cmd, { shell: true, cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
      
      d.process.stdout?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) addLog('info', `Daemon: ${daemonId}`, text);
      });
      
      d.process.stderr?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) addLog('error', `Daemon: ${daemonId}`, text);
      });
      
      d.process.on('close', (code) => {
        console.log(`[DaemonManager] Daemon ${daemonId} exited with code ${code}`);
        d.process = null;
        if (d.state !== 'stopped') {
          this.handleCrash(daemonId, `Exited with code ${code}`);
        }
      });
      
      // Set to running after grace period
      setTimeout(() => {
        if (d.state === 'starting' && d.process) {
          d.state = 'running';
        }
      }, daemonManifest.health.startupGraceSec * 1000);
      
    } catch (e: any) {
      this.handleCrash(daemonId, `Spawn failed: ${e.message}`);
    }
  }

  public stopDaemon(daemonId: string) {
    const d = this.daemons.get(daemonId);
    if (!d) return;
    
    console.log(`[DaemonManager] Stopping daemon: ${daemonId}`);
    d.state = 'stopped';
    
    if (d.process) {
      d.process.kill('SIGTERM');
      setTimeout(() => {
        if (d.process) d.process.kill('SIGKILL');
      }, 5000);
    }
    this.daemons.delete(daemonId);
  }

  private handleCrash(daemonId: string, errorMsg: string) {
    const d = this.daemons.get(daemonId);
    if (!d) return;
    
    d.lastError = errorMsg;
    d.restartCount++;
    
    if (d.restartCount > d.manifest.restart.maxRestarts) {
      console.error(`[DaemonManager] Daemon ${daemonId} crashed too many times. Giving up.`);
      d.state = 'crashed';
      return;
    }
    
    d.state = 'backoff';
    const backoffSec = Math.min(
      d.manifest.restart.backoffBaseSec * Math.pow(2, d.restartCount - 1),
      d.manifest.restart.backoffMaxSec
    );
    
    console.log(`[DaemonManager] Daemon ${daemonId} entering backoff. Restarting in ${backoffSec}s.`);
    setTimeout(() => {
      if (this.daemons.get(daemonId)?.state === 'backoff') {
        this.startDaemon(daemonId, d.config);
      }
    }, backoffSec * 1000);
  }

  private healthCheckAll() {
    const now = Date.now();
    for (const [id, d] of this.daemons.entries()) {
      if (d.state !== 'running' && d.state !== 'starting') continue;
      if (d.state === 'running') {
        const uptimeSec = (now - (d.startTime || now)) / 1000;
        if (uptimeSec > 30 && d.restartCount > 0) {
          d.restartCount = 0;
        }
      }

      if (d.manifest.health.strategy === 'file_mtime' && d.manifest.communication.mode === 'ipc_file') {
        const ipcFile = join(IPC_DIR, d.manifest.communication.ipcFilename);
        
        if (!existsSync(ipcFile)) {
          const uptimeSec = (now - (d.startTime || now)) / 1000;
          if (uptimeSec > d.manifest.health.startupGraceSec) {
            console.warn(`[DaemonManager] Health check failed for ${id}: IPC file not found.`);
            this.handleCrash(id, 'IPC file missing');
            if (d.process) d.process.kill('SIGTERM');
          }
          continue;
        }
        
        const mtime = statSync(ipcFile).mtimeMs;
        const staleSec = (now - mtime) / 1000;
        
        if (staleSec > d.manifest.health.maxStaleSec) {
          console.warn(`[DaemonManager] Health check failed for ${id}: IPC file stale (${Math.round(staleSec)}s > ${d.manifest.health.maxStaleSec}s).`);
          this.handleCrash(id, `IPC file stale (${Math.round(staleSec)}s)`);
          if (d.process) d.process.kill('SIGTERM');
        }
      }
    }
  }

  public shutdownAll() {
    console.log('[DaemonManager] Shutting down all daemons...');
    for (const id of this.daemons.keys()) {
      this.stopDaemon(id);
    }
  }

  private verifyDependencies(manifest: any): string[] {
    const missing: string[] = [];
    if (!manifest || !manifest.dependencies) return missing;

    const deps = manifest.dependencies;
    
    if (Array.isArray(deps.system)) {
      for (const pkg of deps.system) {
        try { spawnSync('command', ['-v', pkg], { stdio: 'ignore' }); }
        catch (e) { missing.push(pkg); }
      }
    }

    if (Array.isArray(deps.python) && deps.python.length > 0) {
      try { spawnSync('command', ['-v', 'python3'], { stdio: 'ignore' }); }
      catch (e) { missing.push('python3'); }
    }

    if (Array.isArray(deps.npm) && deps.npm.length > 0) {
      try { spawnSync('command', ['-v', 'npm'], { stdio: 'ignore' }); }
      catch (e) { missing.push('npm'); }
    }

    return missing;
  }

  public getStatus(): DaemonStatus[] {
    const statuses: DaemonStatus[] = [];
    for (const d of this.daemons.values()) {
      statuses.push({
        id: d.id,
        state: d.state,
        pid: d.process?.pid || null,
        uptimeSec: d.startTime ? Math.floor((Date.now() - d.startTime) / 1000) : 0,
        restartCount: d.restartCount,
        lastError: d.lastError,
        healthy: d.state === 'running',
        missingDependencies: d.missingDependencies,
      });
    }
    return statuses;
  }
}

export const daemonManager = new DaemonManager();
