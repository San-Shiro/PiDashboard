import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BOARDS_DIR = join(process.cwd(), 'config', 'boards');
const CONFIG_PATH = join(process.cwd(), 'config.json');
const DEVICE_TREE_MODEL = '/proc/device-tree/model';

export interface PinConfig {
  caps: string[];
}

export interface BoardProfile {
  id: string;
  name: string;
  match: string[];
  gpio: {
    backend: 'sysfs' | 'libgpiod' | 'none';
    chip: string | null;
    pins: Record<string, PinConfig>;
  };
  ramClass: 'lite' | 'standard' | 'heavy';
  features: string[];
}

let _detected: BoardProfile | null = null;

function loadAllProfiles(): BoardProfile[] {
  if (!existsSync(BOARDS_DIR)) return [];
  const profiles: BoardProfile[] = [];
  for (const file of readdirSync(BOARDS_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      profiles.push(JSON.parse(readFileSync(join(BOARDS_DIR, file), 'utf8')));
    } catch { /* skip invalid */ }
  }
  return profiles;
}

function getDeviceModel(): string | null {
  try {
    if (existsSync(DEVICE_TREE_MODEL)) {
      return readFileSync(DEVICE_TREE_MODEL, 'utf8').replace(/\0/g, '').trim();
    }
  } catch { /* not on Linux or no device tree */ }
  return null;
}

export function detectBoard(): BoardProfile {
  if (_detected) return _detected;

  const profiles = loadAllProfiles();

  // Check for config override first
  try {
    if (existsSync(CONFIG_PATH)) {
      const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
      if (config.boardOverride) {
        const override = profiles.find(p => p.id === config.boardOverride);
        if (override) {
          _detected = override;
          console.log(`[Board] Using config override: ${override.name}`);
          return _detected;
        }
      }
    }
  } catch { /* ignore */ }

  // Auto-detect from /proc/device-tree/model
  const model = getDeviceModel();
  if (model) {
    for (const profile of profiles) {
      for (const pattern of profile.match) {
        if (model.includes(pattern)) {
          _detected = profile;
          console.log(`[Board] Detected: ${profile.name} (model: ${model})`);
          return _detected;
        }
      }
    }
    console.log(`[Board] Unknown model: "${model}", falling back to generic-linux`);
  } else {
    console.log(`[Board] No device tree found, falling back to generic-linux`);
  }

  _detected = profiles.find(p => p.id === 'generic-linux') || {
    id: 'generic-linux',
    name: 'Generic Linux',
    match: [],
    gpio: { backend: 'none', chip: null, pins: {} },
    ramClass: 'standard',
    features: [],
  };

  return _detected;
}

export function getAvailablePins(): string[] {
  const board = detectBoard();
  return Object.keys(board.gpio.pins);
}

export function isPinAvailable(pin: number | string): boolean {
  const board = detectBoard();
  return String(pin) in board.gpio.pins;
}

export function getPinCaps(pin: number | string): string[] {
  const board = detectBoard();
  return board.gpio.pins[String(pin)]?.caps || [];
}

export function isGpioEnabled(): boolean {
  return detectBoard().gpio.backend !== 'none';
}
