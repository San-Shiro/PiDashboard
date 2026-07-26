import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const CONFIG_DIR = join(process.cwd(), 'config');
const PROVENANCE_PATH = join(CONFIG_DIR, 'widget-provenance.json');
const WIDGETS_DIR = join(process.cwd(), 'widgets');

export type WidgetSource = 'builtin' | 'installed';
export type TrustLevel = 'core' | 'verified' | 'community' | 'unsafe';

interface ProvenanceEntry {
  source: WidgetSource;
  maxTrust: TrustLevel;
  installedAt?: string;
}

type ProvenanceRegistry = Record<string, ProvenanceEntry>;

const TRUST_RANK: Record<TrustLevel, number> = {
  core: 3,
  verified: 2,
  community: 1,
  unsafe: 0,
};

let _cache: ProvenanceRegistry | null = null;

function load(): ProvenanceRegistry {
  if (_cache) return _cache;
  if (!existsSync(PROVENANCE_PATH)) {
    _cache = {};
    return _cache;
  }
  try {
    _cache = JSON.parse(readFileSync(PROVENANCE_PATH, 'utf8'));
    return _cache!;
  } catch {
    _cache = {};
    return _cache;
  }
}

function save(registry: ProvenanceRegistry) {
  _cache = registry;
  writeFileSync(PROVENANCE_PATH, JSON.stringify(registry, null, 2), 'utf8');
}

export function initProvenance() {
  const registry = load();
  let changed = false;

  const folders = existsSync(WIDGETS_DIR)
    ? readdirSync(WIDGETS_DIR).filter(f => !f.startsWith('_') && !f.startsWith('.'))
    : [];

  for (const folder of folders) {
    if (!registry[folder]) {
      // Widgets already carrying the community- prefix at first boot are
      // treated as installed (capped at community), not grandfathered to core.
      if (folder.startsWith('community-')) {
        registry[folder] = { source: 'installed', maxTrust: 'community' };
      } else {
        registry[folder] = { source: 'builtin', maxTrust: 'core' };
      }
      changed = true;
    }
  }

  if (changed) save(registry);
}

export function registerInstalled(widgetId: string) {
  const registry = load();
  registry[widgetId] = {
    source: 'installed',
    maxTrust: 'community',
    installedAt: new Date().toISOString(),
  };
  save(registry);
}

export function resolveTrust(widgetId: string, manifestTrust?: TrustLevel): TrustLevel {
  const registry = load();
  const entry = registry[widgetId];

  if (!entry) return 'community';

  const maxTrust = entry.maxTrust;
  if (!manifestTrust) return maxTrust === 'core' ? 'verified' : maxTrust;

  if (TRUST_RANK[manifestTrust] > TRUST_RANK[maxTrust]) {
    return maxTrust;
  }

  return manifestTrust;
}

export function getIsolation(trust: TrustLevel): 'inline' | 'shadow' | 'iframe' {
  switch (trust) {
    case 'core': return 'inline';
    case 'verified': return 'shadow';
    case 'community': return 'iframe';
    case 'unsafe': return 'iframe';
    default: return 'iframe';
  }
}
