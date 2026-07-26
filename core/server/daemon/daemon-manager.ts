import { spawn, spawnSync, execSync, ChildProcess } from 'child_process';
import { join, basename } from 'path';
import { existsSync, readFileSync, statSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { CanvasConfig } from '../../engine/schema';
import { addLog } from '../logger';
import { stateStore } from '../state/state-store';
import { applyTrustedPatch, pushRefresh } from '../ws/display';

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
            const instanceDaemonId = `${manifest.daemon}__${widget.id}`;
            requiredDaemons.set(instanceDaemonId, {
              daemonType: manifest.daemon,
              config: widget.config || {}
            });
          }
        } catch (e) {
          console.warn(`[DaemonManager] Failed to read manifest for ${widget.widget_id}`);
        }
      }
    }
    
    // 2. Start new daemons, update configs for existing
    for (const [daemonId, dInfo] of requiredDaemons.entries()) {
      const config = dInfo.config;
      const daemonType = dInfo.daemonType;
      
      if (!this.daemons.has(daemonId)) {
        this.startDaemon(daemonId, daemonType, config);
      } else {
        const d = this.daemons.get(daemonId)!;
        if (JSON.stringify(d.config || {}) !== JSON.stringify(config || {})) {
          console.log(`[DaemonManager] Config changed for ${daemonId}...`);
          const instanceId = daemonId.includes('__') ? daemonId.split('__')[1] : 'global';
          
          if (d.manifest?.hotReload) {
            console.log(`[DaemonManager] Sending config_update command to daemon...`);
            d.config = config;
            try {
              mkdirSync(IPC_DIR, { recursive: true });
              writeFileSync(join(IPC_DIR, `${daemonId}.cmd.json`), JSON.stringify({ action: 'config_update', config }), 'utf8');
            } catch (err) {
              console.error(`[DaemonManager] Failed to write cmd for ${daemonId}`, err);
            }
            pushRefresh(daemonType, instanceId, config);
          } else {
            console.log(`[DaemonManager] Restarting synchronously...`);
            try {
              const ipcFile = join(IPC_DIR, `${daemonId}.json`);
              const legacyIpcFile = join(IPC_DIR, `${daemonType}.json`);
              if (existsSync(ipcFile)) unlinkSync(ipcFile);
              if (existsSync(legacyIpcFile)) unlinkSync(legacyIpcFile);
              
              const stateKey = instanceId === 'global' ? daemonType : `${daemonType}:${instanceId}`;
              stateStore.patch(stateKey, null);
              applyTrustedPatch(daemonType, instanceId, null);
            } catch (e) {}
            
            pushRefresh(daemonType, instanceId, config);
            this.stopDaemon(daemonId);
            this.startDaemon(daemonId, daemonType, config);
          }
        } else {
          d.config = config; // update config
        }
      }
    }
    
    // 3. Stop daemons that are no longer needed
    for (const daemonId of this.daemons.keys()) {
      if (!requiredDaemons.has(daemonId)) {
        this.stopDaemon(daemonId);
      }
    }
  }

  public startDaemon(daemonId: string, daemonType: string, config: any) {
    if (this.daemons.has(daemonId)) {
      const d = this.daemons.get(daemonId)!;
      if (d.state === 'running' || d.state === 'starting') return;
    }

    console.log(`[DaemonManager] Starting daemon: ${daemonId} (type: ${daemonType})`);
    
    let daemonManifest: any = {
      id: daemonId,
      daemonType: daemonType,
      communication: { mode: 'ipc_file', ipcFilename: `${daemonId}.json` },
      health: { strategy: 'file_mtime', maxStaleSec: 300, startupGraceSec: 15 },
      restart: { policy: 'on-failure', maxRestarts: 5, backoffBaseSec: 2, backoffMaxSec: 120 }
    };
    
    let cmd = '';
    let cwd = ROOT;
    
    const widgetDir = join(WIDGETS_DIR, daemonType); 
    const daemonJsonPath = join(widgetDir, 'daemon', 'daemon.json');
    const legacyDaemonPath = join(ROOT, 'daemons', `${daemonType}.sh`);
    const newDaemonPath = join(widgetDir, 'daemon', `${daemonType}.sh`);
    
    if (existsSync(daemonJsonPath)) {
      try {
        const loaded = JSON.parse(readFileSync(daemonJsonPath, 'utf8'));
        const defaults = daemonManifest;
        daemonManifest = { ...defaults, ...loaded };

        // Merge per-field rather than replacing whole blocks: a daemon.json
        // declaring a PARTIAL health/restart block would otherwise leave
        // undefined numbers, producing NaN backoff (=> 0ms respawn spin loop)
        // and comparisons that silently disable the health check.
        daemonManifest.health = { ...defaults.health, ...(loaded.health || {}) };
        daemonManifest.restart = { ...defaults.restart, ...(loaded.restart || {}) };

        // Ensure communication config uses the instance-specific daemonId
        daemonManifest.communication = {
          ...defaults.communication,
          ...(loaded.communication || {}),
          ipcFilename: `${daemonId}.json`,
        };
        
        cmd = daemonManifest.runtime?.command;
        cwd = daemonManifest.runtime?.cwd ? join(widgetDir, daemonManifest.runtime.cwd) : join(widgetDir, 'daemon');
      } catch (e) {
        console.warn(`[DaemonManager] Failed to read daemon.json for ${daemonId}`);
      }
    } else if (existsSync(newDaemonPath)) {
      cmd = `./${daemonType}.sh`;
      cwd = join(widgetDir, 'daemon');
    } else if (existsSync(legacyDaemonPath)) {
      cmd = `./${daemonType}.sh`;
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
      d.process = spawn(cmd, { shell: true, cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
      
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
      const pid = d.process.pid;
      if (pid) {
        try {
          process.kill(-pid, 'SIGTERM');
        } catch (e) {
          try { d.process.kill('SIGTERM'); } catch (err) {}
        }
        setTimeout(() => {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch (e) {
            try { if (d.process) d.process.kill('SIGKILL'); } catch (err) {}
          }
        }, 5000);
      }
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
        this.startDaemon(daemonId, d.manifest.daemonType || daemonId.split('__')[0], d.config);
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

  public refreshAll() {
    console.log('[DaemonManager] Refreshing all active daemons...');
    for (const [daemonId, d] of this.daemons.entries()) {
      try {
        mkdirSync(IPC_DIR, { recursive: true });
        writeFileSync(join(IPC_DIR, `${daemonId}.cmd.json`), JSON.stringify({ action: 'refresh', config: d.config }), 'utf8');
      } catch (err) {
        console.error(`[DaemonManager] Failed to write refresh cmd for ${daemonId}`, err);
      }
    }
  }

  private verifyDependencies(manifest: any): string[] {
    const missing: string[] = [];
    if (!manifest || !manifest.dependencies) return missing;

    const deps = manifest.dependencies;

    // Dependency names come from an installed widget's daemon.json and are
    // untrusted. Never interpolate them into a shell string — pass as an
    // argument ($1) and additionally reject anything that isn't a plain
    // executable name, so a hostile manifest cannot execute commands here.
    const SAFE_CMD_RE = /^[A-Za-z0-9._+-]{1,64}$/;
    const checkCommand = (cmd: string): boolean => {
      if (typeof cmd !== 'string' || !SAFE_CMD_RE.test(cmd)) return false;
      const result = spawnSync('sh', ['-c', 'command -v "$1" >/dev/null 2>&1', 'sh', cmd], { stdio: 'ignore' });
      return result.status === 0;
    };

    if (Array.isArray(deps.system)) {
      for (const pkg of deps.system) {
        if (!checkCommand(pkg)) missing.push(pkg);
      }
    }

    if (Array.isArray(deps.python) && deps.python.length > 0) {
      if (!checkCommand('python3')) missing.push('python3');
    }

    if (Array.isArray(deps.npm) && deps.npm.length > 0) {
      if (!checkCommand('npm')) missing.push('npm');
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
