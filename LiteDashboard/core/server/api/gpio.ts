import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Router, json, error } from '../router';

const CONFIG_PATH = join(process.cwd(), 'config.json');
const GPIO_BASE = '/sys/class/gpio';
const IS_PI = existsSync(GPIO_BASE);

// Available BCM GPIO pins on Pi Zero 2W
const AVAILABLE_PINS = [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27];

// Available actions for pin bindings
const VALID_ACTIONS = ['toggle_maintenance', 'toggle_display', 'next_canvas', 'prev_canvas', 'reload_display'];

// Mock state for dev (not on real Pi)
const mockPins: Record<number, { mode: string; value: number }> = {};

// ── sysfs helpers ────────────────────────────────────────────────────────────

function exportPin(pin: number) {
  if (!IS_PI) return;
  if (!existsSync(`${GPIO_BASE}/gpio${pin}`)) {
    try { writeFileSync(`${GPIO_BASE}/export`, String(pin)); } catch { /* may already be exported */ }
  }
}

function readPin(pin: number): { mode: string; value: number } {
  if (!IS_PI) return mockPins[pin] || { mode: 'in', value: 0 };
  exportPin(pin);
  const dir = readFileSync(`${GPIO_BASE}/gpio${pin}/direction`, 'utf8').trim();
  const val = parseInt(readFileSync(`${GPIO_BASE}/gpio${pin}/value`, 'utf8').trim());
  return { mode: dir, value: val };
}

function writePin(pin: number, value: number) {
  if (!IS_PI) {
    mockPins[pin] = { ...(mockPins[pin] || { mode: 'out' }), value };
    return;
  }
  writeFileSync(`${GPIO_BASE}/gpio${pin}/value`, String(value));
}

function setPinMode(pin: number, mode: string) {
  if (!IS_PI) {
    mockPins[pin] = { ...(mockPins[pin] || { value: 0 }), mode };
    return;
  }
  exportPin(pin);
  writeFileSync(`${GPIO_BASE}/gpio${pin}/direction`, mode);
}

// ── Config helpers ───────────────────────────────────────────────────────────

function loadConfig(): any {
  if (!existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

function saveConfig(data: any) {
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ── Route registration ───────────────────────────────────────────────────────

export function registerGpioRoutes(router: Router) {
  // GET /api/gpio/pins — list all configured GPIO pins with mode and value
  router.get('/api/gpio/pins', () => {
    const pins: Record<number, { mode: string; value: number }> = {};
    for (const pin of AVAILABLE_PINS) {
      pins[pin] = readPin(pin);
    }
    return json({ pins, is_pi: IS_PI });
  });

  // POST /api/gpio/pins/:pin/mode — set pin direction (in/out)
  router.post('/api/gpio/pins/:pin/mode', async (req, params) => {
    const pin = parseInt(params.pin);
    if (!AVAILABLE_PINS.includes(pin)) return error(`Invalid GPIO pin: ${pin}`, 400);

    const body = await req.json() as { mode?: string };
    if (!body.mode || !['in', 'out'].includes(body.mode)) {
      return error('Mode must be "in" or "out"', 400);
    }

    try {
      setPinMode(pin, body.mode);
      return json({ success: true, pin, mode: body.mode });
    } catch (e: any) {
      return error(`Failed to set pin mode: ${e.message}`, 500);
    }
  });

  // POST /api/gpio/pins/:pin/write — set output pin value (0/1)
  router.post('/api/gpio/pins/:pin/write', async (req, params) => {
    const pin = parseInt(params.pin);
    if (!AVAILABLE_PINS.includes(pin)) return error(`Invalid GPIO pin: ${pin}`, 400);

    const body = await req.json() as { value?: number };
    if (body.value !== 0 && body.value !== 1) {
      return error('Value must be 0 or 1', 400);
    }

    try {
      writePin(pin, body.value);
      return json({ success: true, pin, value: body.value });
    } catch (e: any) {
      return error(`Failed to write pin: ${e.message}`, 500);
    }
  });

  // GET /api/gpio/pins/:pin/read — read current pin value
  router.get('/api/gpio/pins/:pin/read', (req, params) => {
    const pin = parseInt(params.pin);
    if (!AVAILABLE_PINS.includes(pin)) return error(`Invalid GPIO pin: ${pin}`, 400);

    try {
      const state = readPin(pin);
      return json({ pin, ...state });
    } catch (e: any) {
      return error(`Failed to read pin: ${e.message}`, 500);
    }
  });

  // GET /api/gpio/bindings — get pin-to-action bindings from config
  router.get('/api/gpio/bindings', () => {
    const config = loadConfig();
    return json({ bindings: config.gpioBindings || [] });
  });

  // POST /api/gpio/bindings — save pin-to-action bindings to config
  router.post('/api/gpio/bindings', async (req) => {
    const body = await req.json() as { bindings?: any[] };
    if (!Array.isArray(body.bindings)) {
      return error('bindings must be an array', 400);
    }

    // Validate each binding
    for (const binding of body.bindings) {
      if (typeof binding.pin !== 'number' || !AVAILABLE_PINS.includes(binding.pin)) {
        return error(`Invalid pin in binding: ${binding.pin}`, 400);
      }
      if (!['rising', 'falling', 'both'].includes(binding.trigger)) {
        return error(`Invalid trigger "${binding.trigger}" for pin ${binding.pin}. Must be rising, falling, or both`, 400);
      }
      if (!VALID_ACTIONS.includes(binding.action)) {
        return error(`Invalid action "${binding.action}" for pin ${binding.pin}. Valid: ${VALID_ACTIONS.join(', ')}`, 400);
      }
    }

    const config = loadConfig();
    config.gpioBindings = body.bindings;
    saveConfig(config);
    return json({ success: true, bindings: body.bindings });
  });
}
