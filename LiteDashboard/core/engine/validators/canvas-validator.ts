import { CanvasConfig } from '../schema';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized: CanvasConfig;
}

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function validateCanvas(raw: any, registryIds: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Phase 1: Structure Checks (fail-fast)
  if (!raw || typeof raw !== 'object') {
    errors.push("Canvas must be a JSON object");
    return { valid: false, errors, warnings, sanitized: raw };
  }
  if (!raw.canvas || typeof raw.canvas !== 'object') {
    errors.push("Missing 'canvas' config block");
    return { valid: false, errors, warnings, sanitized: raw };
  }
  if (!Array.isArray(raw.widgets)) {
    errors.push("Missing 'widgets' array");
    return { valid: false, errors, warnings, sanitized: raw };
  }

  // Phase 2: Canvas-Level Clamping
  raw.schemaVersion = 2;
  
  const originalWidth = raw.canvas.width;
  raw.canvas.width = clamp(raw.canvas.width || 1920, 320, 7680);
  if (originalWidth !== raw.canvas.width) warnings.push(`Width ${originalWidth} clamped to ${raw.canvas.width}`);

  const originalHeight = raw.canvas.height;
  raw.canvas.height = clamp(raw.canvas.height || 1080, 240, 4320);
  if (originalHeight !== raw.canvas.height) warnings.push(`Height ${originalHeight} clamped to ${raw.canvas.height}`);

  raw.canvas.background = raw.canvas.background || "#0d1117";
  
  raw.canvas.displayTarget = ["primary", "secondary", "all"].includes(raw.canvas.displayTarget) 
    ? raw.canvas.displayTarget 
    : "primary";
    
  raw.canvas.pixelRatio = [1, 2].includes(raw.canvas.pixelRatio) ? raw.canvas.pixelRatio : 1;
  raw.canvas.fps = [30, 60].includes(raw.canvas.fps) ? raw.canvas.fps : 60;

  // Phase 3: Widget Instance Validation
  const seenIds = new Set<string>();

  raw.widgets = raw.widgets.filter((w: any) => {
    if (!w.id || typeof w.id !== 'string') {
      errors.push("Widget missing id");
      return false;
    }
    if (!w.widget_id || typeof w.widget_id !== 'string') {
      errors.push("Widget missing widget_id");
      return false;
    }
    
    if (!registryIds.includes(w.widget_id)) {
      warnings.push(`Unknown widget '${w.widget_id}' skipped`);
      return false;
    }
    
    if (seenIds.has(w.id)) {
      errors.push(`Duplicate instance: ${w.id}`);
      return false;
    }
    seenIds.add(w.id);
    
    w.label = w.label || w.widget_id;
    w.enabled = w.enabled !== false;
    w.config = w.config || {};
    
    w.layout = w.layout || {};
    w.layout.x = Math.max(0, clamp(w.layout.x, 0, Infinity));
    w.layout.y = Math.max(0, clamp(w.layout.y, 0, Infinity));
    w.layout.width = clamp(w.layout.width || 320, 50, raw.canvas.width);
    w.layout.height = clamp(w.layout.height || 240, 50, raw.canvas.height);
    w.layout.zIndex = clamp(w.layout.zIndex || 1, 1, 999);
    w.layout.opacity = clamp(w.layout.opacity ?? 1, 0, 1);
    w.layout.overflow = w.layout.overflow === "visible" ? "visible" : "hidden";
    
    const validBlendModes = [
      "normal","multiply","screen","overlay","darken","lighten",
      "color-dodge","color-burn","hard-light","soft-light","difference","exclusion"
    ];
    if (w.layout.blendMode && !validBlendModes.includes(w.layout.blendMode)) {
      warnings.push(`Invalid blendMode '${w.layout.blendMode}' stripped`);
      delete w.layout.blendMode;
    }
    
    if (w.layout.filter && typeof w.layout.filter === 'object') {
      const f = w.layout.filter;
      if (f.brightness !== undefined) f.brightness = clamp(f.brightness, 0, 2);
      if (f.contrast !== undefined) f.contrast = clamp(f.contrast, 0, 2);
      if (f.grayscale !== undefined) f.grayscale = clamp(f.grayscale, 0, 1);
      if (f.saturate !== undefined) f.saturate = clamp(f.saturate, 0, 3);
      if (f.sepia !== undefined) f.sepia = clamp(f.sepia, 0, 1);
      if (f.opacity !== undefined) f.opacity = clamp(f.opacity, 0, 1);
    }
    
    if (w.schedule) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!w.schedule.activeFrom || !timeRegex.test(w.schedule.activeFrom)) delete w.schedule;
      else if (!w.schedule.activeTo || !timeRegex.test(w.schedule.activeTo)) delete w.schedule;
      else if (w.schedule.days) {
        const validDays = ["mon","tue","wed","thu","fri","sat","sun"];
        w.schedule.days = w.schedule.days.filter((d: string) => validDays.includes(d));
        if (w.schedule.days.length === 0) delete w.schedule.days;
      }
    }
    
    return true;
  });

  // Phase 4: Cleanup
  delete raw.widget_count;
  raw.updated_at = new Date().toISOString();

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized: raw as CanvasConfig
  };
}
