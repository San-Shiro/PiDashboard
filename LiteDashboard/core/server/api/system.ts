import * as os from 'os';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { Router, json, error } from '../router';
import { pushMaintenance } from '../ws/display';
import { daemonManager } from '../daemon/daemon-manager';
import { getLogs } from '../logger';

// In-memory server state
let maintenanceMode = false;
let displayEnabled = true;

// CPU state for delta calculation
let lastTotalTick = 0;
let lastTotalIdle = 0;

export function registerSystemRoutes(router: Router) {
  // GET /api/system/stats — real system metrics
  router.get('/api/system/stats', () => {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }
    
    let cpuPercent = 0;
    if (lastTotalTick > 0) {
      const deltaTick = totalTick - lastTotalTick;
      const deltaIdle = totalIdle - lastTotalIdle;
      cpuPercent = Math.round((1 - deltaIdle / deltaTick) * 100);
    } else {
      // First call fallback
      cpuPercent = Math.round((1 - totalIdle / totalTick) * 100);
    }
    
    lastTotalTick = totalTick;
    lastTotalIdle = totalIdle;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memTotalMb = Math.round(totalMem / 1024 / 1024);
    const memUsedMb = Math.round(usedMem / 1024 / 1024);
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // CPU temp (Linux only — /sys/class/thermal/thermal_zone0/temp)
    let cpuTemp = 0;
    try {
      const tempFile = '/sys/class/thermal/thermal_zone0/temp';
      if (existsSync(tempFile)) {
        cpuTemp = parseInt(readFileSync(tempFile, 'utf8').trim()) / 1000;
      }
    } catch { /* no thermal data available */ }

    // Disk percent (Linux)
    let diskPercent = 0;
    try {
      const output = execSync('df -k / | tail -1').toString();
      const match = output.match(/(\d+)%/);
      if (match) diskPercent = parseInt(match[1]);
    } catch { /* ignore error on Windows or if df fails */ }

    return json({
      cpu_percent: cpuPercent,
      mem_percent: memPercent,
      mem_used_mb: memUsedMb,
      mem_total_mb: memTotalMb,
      cpu_temp: cpuTemp,
      disk_percent: diskPercent,
      uptime_seconds: Math.floor(os.uptime()),
      load_avg: os.loadavg(),
      server_rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      processes: {
        bun: { ram_mb: Math.round(process.memoryUsage().rss / 1024 / 1024), cpu: 0 },
      },
    });
  });

  // GET /api/system/state
  router.get('/api/system/state', () => {
    return json({ maintenance_mode: maintenanceMode, display_enabled: displayEnabled });
  });

  // PATCH /api/system/state
  router.patch('/api/system/state', async (req) => {
    const body = await req.json() as any;

    if (body.maintenance_mode !== undefined) {
      maintenanceMode = !!body.maintenance_mode;
      pushMaintenance(maintenanceMode);
    }
    if (body.display_enabled !== undefined) {
      displayEnabled = !!body.display_enabled;
    }

    return json({ success: true });
  });

  // GET /api/system/services — return real daemons
  router.get('/api/system/services', () => {
    const daemons = daemonManager.getStatus();
    const coreServices = [
      { id: 'pi-dashboard', name: 'PiDashboard Server', state: 'running', uptimeSec: Math.floor(process.uptime()), healthy: true, core: true },
      { id: 'pi-compositor', name: 'Display Compositor', state: 'running', uptimeSec: Math.floor(process.uptime()), healthy: true, core: true },
    ];
    
    return json({
      services: [...coreServices, ...daemons.map(d => ({ ...d, name: `Daemon: ${d.id}`, core: false }))],
    });
  });

  // GET /api/system/logs — fetch recent logs
  router.get('/api/system/logs', () => {
    return json({ logs: getLogs() });
  });

  // POST /api/system/services/restart
  router.post('/api/system/services/restart', async (req) => {
    const body = await req.json() as { name?: string, id?: string };
    const targetId = body.id || body.name;
    if (!targetId) return error('Service ID required', 400);
    
    if (targetId.startsWith('pi-')) {
       return error('Cannot restart core service via this API', 403);
    }
    
    console.log(`[System] Service restart requested: ${targetId}`);
    daemonManager.stopDaemon(targetId);
    // It will be reconciled and restarted on the next tick if required
    return json({ success: true });
  });

  // GET /api/system/wifi — mock data for dev (real implementation wraps nmcli)
  router.get('/api/system/wifi', () => {
    return json({
      current: { ssid: 'PiNetwork', ip: '192.168.1.100', signal: 85 },
      networks: [
        { ssid: 'PiNetwork', signal: 85, secured: true, connected: true },
        { ssid: 'Neighbor_5G', signal: 45, secured: true, connected: false },
        { ssid: 'OpenWifi', signal: 30, secured: false, connected: false },
      ],
    });
  });

  // GET /api/system/bluetooth — mock data for dev
  router.get('/api/system/bluetooth', () => {
    return json({
      enabled: true,
      devices: [
        { name: 'JBL Speaker', mac: 'AA:BB:CC:DD:EE:FF', paired: true, connected: false },
        { name: 'AirPods Pro', mac: '11:22:33:44:55:66', paired: true, connected: true },
      ],
    });
  });
}
