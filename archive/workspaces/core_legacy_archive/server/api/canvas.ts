import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync, unlinkSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";
import { pushReload } from "../ws/display";

const CANVASES_DIR = join(process.cwd(), "canvases");
const SAVED_DIR = join(CANVASES_DIR, "saved");
const ACTIVE_PATH = join(CANVASES_DIR, "active.json");

// Ensure canvas directories exist
if (!existsSync(CANVASES_DIR)) {
  require("fs").mkdirSync(CANVASES_DIR, { recursive: true });
}
if (!existsSync(SAVED_DIR)) {
  require("fs").mkdirSync(SAVED_DIR, { recursive: true });
}

let activeCanvasCache: any = null;

export function getActiveCanvas(): any {
  if (activeCanvasCache) return activeCanvasCache;
  try {
    if (existsSync(ACTIVE_PATH)) {
      activeCanvasCache = JSON.parse(readFileSync(ACTIVE_PATH, "utf8"));
      return activeCanvasCache;
    }
  } catch (e) {
    console.error(`[canvas] Failed to read active canvas: ${(e as Error).message}`);
  }
  return { name: "Default Canvas", width: 1920, height: 1080, widgets: [] };
}

export function publishCanvas(canvasData: any): boolean {
  try {
    const tmpPath = `${ACTIVE_PATH}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(canvasData, null, 2), "utf8");
    renameSync(tmpPath, ACTIVE_PATH);
    activeCanvasCache = canvasData;

    // Push reload alert to connected kiosk WS clients
    pushReload();
    return true;
  } catch (e) {
    console.error(`[canvas] Atomic publish failed: ${(e as Error).message}`);
    return false;
  }
}

export function saveNamedCanvas(name: string, canvasData: any): boolean {
  try {
    const safeName = name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
    const savePath = join(SAVED_DIR, `${safeName}.json`);
    writeFileSync(savePath, JSON.stringify(canvasData, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error(`[canvas] Save named failed: ${(e as Error).message}`);
    return false;
  }
}

export function getSavedCanvases(): any[] {
  try {
    const files = readdirSync(SAVED_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const raw = readFileSync(join(SAVED_DIR, f), "utf8");
        return {
          id: f.replace(".json", ""),
          ...JSON.parse(raw)
        };
      });
  } catch (e) {
    console.error(`[canvas] Failed to read saved list: ${(e as Error).message}`);
    return [];
  }
}

export function getSavedCanvasById(id: string): any | null {
  try {
    const filePath = join(SAVED_DIR, `${id}.json`);
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf8");
      return { id, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error(`[canvas] Failed to read canvas ${id}: ${(e as Error).message}`);
  }
  return null;
}

export function updateSavedCanvas(id: string, data: any): boolean {
  try {
    const filePath = join(SAVED_DIR, `${id}.json`);
    if (!existsSync(filePath)) return false;
    const tmpPath = `${filePath}.tmp`;
    const updated = { ...data, updated_at: new Date().toISOString() };
    delete updated.id; // Don't store id inside the file
    writeFileSync(tmpPath, JSON.stringify(updated, null, 2), "utf8");
    renameSync(tmpPath, filePath);
    return true;
  } catch (e) {
    console.error(`[canvas] Update canvas ${id} failed: ${(e as Error).message}`);
    return false;
  }
}

export function deleteSavedCanvas(id: string): boolean {
  try {
    const filePath = join(SAVED_DIR, `${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
  } catch (e) {
    console.error(`[canvas] Delete saved canvas failed: ${(e as Error).message}`);
  }
  return false;
}
