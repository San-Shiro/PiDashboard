import { readFileSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  widgetId: string;
}

function getDirectorySizeBytes(dirPath: string): number {
  // Simplified for validation - a real impl would recursively sum sizes
  return 0; // Stub for now unless we need full recursive stats
}

export function validateWidget(widgetDir: string): ValidationResult {
  const result: ValidationResult = {
    valid: false,
    errors: [],
    warnings: [],
    widgetId: basename(widgetDir)
  };

  const error = (msg: string) => result.errors.push(msg);
  const warn = (msg: string) => result.warnings.push(msg);

  // Phase 1: Manifest Structure
  const manifestPath = join(widgetDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    error("manifest.json not found");
    return result;
  }

  let manifest: any;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    error("manifest.json is not valid JSON");
    return result;
  }

  if (!manifest.id || typeof manifest.id !== 'string') error("Missing 'id'");
  if (!manifest.name) error("Missing 'name'");
  if (!manifest.version) error("Missing 'version'");

  const validTiers = ['static', 'pull', 'push', 'stream'];
  if (!manifest.tier || !validTiers.includes(manifest.tier)) {
    error(`Invalid tier: '${manifest.tier}'. Must be: static|pull|push|stream`);
  }

  const validTrusts = ['core', 'verified', 'community', 'unsafe'];
  if (!manifest.trust) {
    error("Missing 'trust' field");
  } else if (!validTrusts.includes(manifest.trust)) {
    error(`Invalid trust: '${manifest.trust}'`);
  }

  if (manifest.id && manifest.id !== result.widgetId) {
    error(`Manifest id '${manifest.id}' doesn't match folder name '${result.widgetId}'`);
  }

  if (result.errors.length > 0) return result;

  // Phase 2: Fragment Structure
  const fragmentFile = manifest.fragment?.file || manifest.entrypoints?.fragment;
  if (!fragmentFile) {
    error("No fragment file declared");
    return result;
  }

  const fragmentPath = join(widgetDir, fragmentFile);
  if (!existsSync(fragmentPath)) {
    error(`Fragment file not found: '${fragmentPath}'`);
    return result;
  }

  const content = readFileSync(fragmentPath, 'utf8');

  if (content.includes('<!DOCTYPE')) error("Fragment contains <!DOCTYPE>. Must be a snippet, not a full HTML page");
  if (content.includes('<html')) error("Fragment contains <html> tag. Remove it — fragments are injected into the compositor's HTML");
  if (content.includes('<head>') || content.includes('<head ')) error("Fragment contains <head> tag");
  if (content.includes('<body>') || content.includes('<body ')) error("Fragment contains <body> tag");

  const sizeKB = Buffer.byteLength(content, 'utf8') / 1024;
  if (sizeKB > 100) error(`Fragment is ${sizeKB.toFixed(1)}KB. Maximum: 100KB`);
  else if (sizeKB > 50) warn(`Fragment is ${sizeKB.toFixed(1)}KB. Consider optimizing (limit: 100KB)`);

  const base64Matches = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{10000,}/g);
  if (base64Matches) error("Fragment contains base64-encoded image >10KB. Use /media/ uploads instead");

  // Phase 3: Tier-DataChannel Consistency
  if (manifest.tier === 'static' && manifest.dataChannel?.type !== 'none') {
    warn("Static widget declares dataChannel — it will be ignored");
  }

  if (manifest.tier === 'pull') {
    const fetchModule = manifest.dataChannel?.fetchModule;
    if (!fetchModule) error("Pull tier widget missing dataChannel.fetchModule");
    else if (!existsSync(join(widgetDir, fetchModule))) error(`Fetch module not found: '${fetchModule}'`);
  }

  if (manifest.tier === 'push') {
    if (!manifest.dataChannel?.ipcFilename) error("Push tier widget missing dataChannel.ipcFilename");
  }

  if (manifest.tier === 'stream') {
    warn("Stream tier is not implemented in v1. Widget will fallback to push behavior");
  }

  // Phase 4: Security Checks
  if (manifest.trust === 'verified' || manifest.trust === 'community') {
    const dangerousPatterns = [
      { pattern: /\beval\s*\(/, name: 'eval()' },
      { pattern: /new\s+Function\s*\(/, name: 'new Function()' },
      { pattern: /setTimeout\s*\(\s*['"`]/, name: 'setTimeout with string argument' },
      { pattern: /setInterval\s*\(\s*['"`]/, name: 'setInterval with string argument' },
    ];

    for (const { pattern, name } of dangerousPatterns) {
      if (pattern.test(content)) {
        if (manifest.trust === 'verified') {
          error(`${name} found in fragment. Blocked for 'verified' trust level`);
        } else {
          warn(`${name} found — will be sandboxed in iframe for 'community' trust`);
        }
      }
    }

    if (manifest.trust === 'verified') {
      if (/<script\s+[^>]*src\s*=/i.test(content)) {
        error("External <script src='...'> tag found. Verified widgets must bundle dependencies via manifest.resources.externalScripts");
      }
    }
  }

  // Phase 5: SDK Compliance
  if (!content.includes('PiWidget.register')) {
    warn("Fragment doesn't use PiWidget.register(). Consider migrating to the SDK pattern");
  }

  // Phase 6: Resource Checks
  if (manifest.configSchema && Array.isArray(manifest.configSchema)) {
    for (const field of manifest.configSchema) {
      if (!field.key) warn(`configSchema entry missing 'key'`);
      if (!field.type) warn(`configSchema entry '${field.key}' missing 'type'`);
      if (!field.label) warn(`configSchema entry '${field.key}' missing 'label'`);
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}
