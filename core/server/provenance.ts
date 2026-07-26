import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync } from 'fs';
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
// Set when the registry could not be parsed. In that state we must NOT
// re-derive provenance (that would grandfather every widget to `core` and
// persist the escalation); instead every lookup fails closed to `community`.
let _degraded = false;

function load(): ProvenanceRegistry {
  if (_cache) return _cache;
  if (!existsSync(PROVENANCE_PATH)) {
    _cache = {};
    return _cache;
  }
  try {
    const parsed = JSON.parse(readFileSync(PROVENANCE_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    _cache = parsed as ProvenanceRegistry;
    return _cache;
  } catch (e) {
    console.error(
      '[Provenance] widget-provenance.json is unreadable/corrupt. Failing closed: ' +
      'all widgets are treated as community (sandboxed) until it is repaired or removed.'
    );
    _degraded = true;
    _cache = {};
    return _cache;
  }
}

// Atomic write (tmp + rename), matching state-store. A torn write here would
// corrupt the trust registry, which is the input to sandboxing decisions.
function save(registry: ProvenanceRegistry) {
  _cache = registry;
  const tmp = PROVENANCE_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(registry, null, 2), 'utf8');
  renameSync(tmp, PROVENANCE_PATH);
}

export function initProvenance() {
  const registry = load();
  if (_degraded) return; // never re-derive (and re-persist) trust from a corrupt file
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
  if (_degraded) return 'community';
  const entry = Object.prototype.hasOwnProperty.call(registry, widgetId) ? registry[widgetId] : undefined;

  // Unknown widget, or a malformed entry, is capped at community (sandboxed).
  if (!entry || typeof entry !== 'object' || !(entry.maxTrust in TRUST_RANK)) return 'community';

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
