import { existsSync, readFileSync, readdirSync, lstatSync } from "fs";
import { join } from "path";
import { getActiveCanvas, publishCanvas } from "./canvas";

const WIDGETS_DIR = join(process.cwd(), "widgets");

/**
 * Scan all widgets/ folders and read/validate manifest.json
 */
export function getWidgetRegistry(): any[] {
  if (!existsSync(WIDGETS_DIR)) return [];

  const list: any[] = [];
  try {
    const folders = readdirSync(WIDGETS_DIR);
    folders.forEach((folder) => {
      if (folder.startsWith("_") || folder.startsWith(".")) return;
      const widgetPath = join(WIDGETS_DIR, folder);
      if (!lstatSync(widgetPath).isDirectory()) return;

      const manifestPath = join(widgetPath, "manifest.json");
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
          // Robust lightweight JSON schema validation
          if (
            manifest.id &&
            manifest.name &&
            manifest.version &&
            manifest.tier &&
            manifest.entrypoints &&
            manifest.entrypoints.fragment
          ) {
            list.push(manifest);
          } else {
            console.warn(`[widgets] Skipped invalid manifest under ${folder}`);
          }
        } catch (e) {
          console.warn(`[widgets] Failed to parse manifest under ${folder}: ${(e as Error).message}`);
        }
      }
    });
  } catch (e) {
    console.error(`[widgets] Failed to scan widget folders: ${(e as Error).message}`);
  }
  return list;
}

/**
 * Return widget instances with dynamically hydrated manifests from the registry
 */
export function getWidgetInstances(): any[] {
  const activeCanvas = getActiveCanvas();
  const instances = activeCanvas.widgets || [];
  const registry = getWidgetRegistry();

  return instances.map((inst: any) => {
    const manifest = registry.find((w) => w.id === inst.widget_id) || {};
    return {
      ...inst,
      manifest
    };
  });
}

/**
 * Create a new widget instance using defaultConfig configSchema keys
 */
export function createWidgetInstance(widgetId: string): any {
  const registry = getWidgetRegistry();
  const manifest = registry.find((w) => w.id === widgetId);
  if (!manifest) {
    throw new Error(`Widget manifest not found: ${widgetId}`);
  }

  // Populate config defaults from schema definition
  const widgetConfig: Record<string, any> = {};
  if (Array.isArray(manifest.configSchema)) {
    manifest.configSchema.forEach((field: any) => {
      if (field.key && field.default !== undefined) {
        widgetConfig[field.key] = field.default;
      }
    });
  }

  const activeCanvas = getActiveCanvas();
  const instances = activeCanvas.widgets || [];

  const newInstance = {
    id: `${widgetId}_${Date.now()}`,
    widget_id: widgetId,
    label: manifest.name || widgetId,
    enabled: true,
    base_config: {
      x: 0,
      y: 0,
      width: 320,
      height: 240,
      zIndex: 1,
      opacity: 1,
      activeFrom: "00:00",
      activeTo: "23:59"
    },
    widget_config: widgetConfig
  };

  instances.push(newInstance);
  activeCanvas.widgets = instances;

  const ok = publishCanvas(activeCanvas);
  if (!ok) throw new Error("Failed to write active canvas config");

  return {
    ...newInstance,
    manifest
  };
}

/**
 * Update a widget instance atomically
 */
export function updateWidgetInstance(id: string, changes: any): any {
  const activeCanvas = getActiveCanvas();
  const instances = activeCanvas.widgets || [];

  const index = instances.findIndex((inst: any) => inst.id === id);
  if (index === -1) {
    throw new Error(`Widget instance not found: ${id}`);
  }

  const existing = instances[index];

  // Atomic merges
  const updated = {
    ...existing,
    label: changes.label !== undefined ? changes.label : existing.label,
    enabled: changes.enabled !== undefined ? changes.enabled : existing.enabled,
    base_config: changes.base_config ? { ...existing.base_config, ...changes.base_config } : existing.base_config,
    widget_config: changes.widget_config ? { ...existing.widget_config, ...changes.widget_config } : existing.widget_config
  };

  instances[index] = updated;
  activeCanvas.widgets = instances;

  const ok = publishCanvas(activeCanvas);
  if (!ok) throw new Error("Failed to write active canvas config");

  const registry = getWidgetRegistry();
  const manifest = registry.find((w) => w.id === updated.widget_id) || {};

  return {
    ...updated,
    manifest
  };
}

/**
 * Delete a widget instance
 */
export function deleteWidgetInstance(id: string): boolean {
  const activeCanvas = getActiveCanvas();
  const instances = activeCanvas.widgets || [];

  const index = instances.findIndex((inst: any) => inst.id === id);
  if (index === -1) return false;

  instances.splice(index, 1);
  activeCanvas.widgets = instances;

  return publishCanvas(activeCanvas);
}
