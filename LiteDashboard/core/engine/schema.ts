export type BlendMode = 
  | "normal" | "multiply" | "screen" | "overlay" 
  | "darken" | "lighten" | "color-dodge" | "color-burn" 
  | "hard-light" | "soft-light" | "difference" | "exclusion";

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface WidgetSchedule {
  activeFrom: string;
  activeTo: string;
  days?: DayOfWeek[];
}

export interface WidgetFilter {
  blur?: string;
  brightness?: number;
  contrast?: number;
  grayscale?: number;
  saturate?: number;
  sepia?: number;
  opacity?: number;
}

export interface WidgetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  opacity: number;
  borderRadius?: number;
  overflow: "hidden" | "visible";
  blendMode?: BlendMode;
  filter?: WidgetFilter;
  transition?: string;
}

export interface WidgetInstance {
  id: string;
  widget_id: string;
  label: string;
  enabled: boolean;
  layout: WidgetLayout;
  schedule?: WidgetSchedule;
  config: Record<string, any>;
}

export interface CanvasConfig {
  schemaVersion: 2;
  id: string;
  name: string;
  description?: string;
  
  canvas: {
    width: number;
    height: number;
    background: string;
    displayTarget: "primary" | "secondary" | "all";
    pixelRatio: 1 | 2;
    fps: 30 | 60;
    defaultTimezone?: string;
    defaultLocale?: string;
  };
  
  widgets: WidgetInstance[];
  updated_at: string;
}

export type ConfigFieldType = 
  | "text" | "textarea" | "number" | "toggle" | "select" 
  | "color" | "file" | "timezone" | "time" | "slider";

export interface ConfigField {
  key: string;
  type: ConfigFieldType;
  label: string;
  default: any;
  required?: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
  };
  options?: Array<{ label: string; value: any }>;
  showIf?: { key: string; value: any };
}

export interface WidgetManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  tier: "static" | "pull" | "push" | "stream";
  trust: "core" | "verified" | "community" | "unsafe";
  fragment: {
    file: string;
    format: "snippet";
  };
  dataChannel: {
    type: "none" | "websocket" | "ipc_file";
    ipcFilename?: string;
    fetchModule?: string;
  };
  interactive?: {
    commands?: Array<{ action: string; description: string; payload?: object }>;
    persistence?: boolean;
    stateSchema?: object;
  };
  polling?: {
    intervalSec?: number;
    jitterSec?: number;
  };
  animations?: {
    type?: string[];
    lottieFiles?: string[];
    lottieRenderer?: string;
    targetFps?: number;
  };
  resources?: {
    estimatedRamKB?: number;
    requiresNetwork?: boolean;
    externalFonts?: string[];
    externalScripts?: string[];
  };
  permissions?: {
    network?: string[];
    persistence?: boolean;
    commands?: string[];
  };
  configSchema?: ConfigField[];
  defaults?: {
    width?: number;
    height?: number;
    minWidth?: number;
    minHeight?: number;
  };
}
