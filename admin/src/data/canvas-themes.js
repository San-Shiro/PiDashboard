/**
 * Canvas Theme Presets — built-in themes for kiosk display.
 * Widgets can bind to these variables directly from any color-capable field.
 */

export const CANVAS_TOKEN_GROUPS = [
  {
    id: "text",
    label: "Text",
    tokens: [
      { key: "--canvas-text", label: "Text Primary" },
      { key: "--canvas-text-2", label: "Text Secondary" },
      { key: "--canvas-text-3", label: "Text Tertiary" },
    ],
  },
  {
    id: "accent",
    label: "Accent",
    tokens: [
      { key: "--canvas-accent", label: "Accent Primary" },
      { key: "--canvas-accent-2", label: "Accent Secondary" },
      { key: "--canvas-accent-3", label: "Accent Tertiary" },
    ],
  },
  {
    id: "background",
    label: "Background",
    tokens: [
      { key: "--canvas-bg", label: "Background Primary" },
      { key: "--canvas-bg-2", label: "Background Secondary" },
      { key: "--canvas-bg-3", label: "Background Tertiary" },
    ],
  },
  {
    id: "surface",
    label: "Surface",
    tokens: [
      { key: "--canvas-surface", label: "Surface Primary" },
      { key: "--canvas-surface-2", label: "Surface Secondary" },
      { key: "--canvas-surface-3", label: "Surface Tertiary" },
    ],
  },
  {
    id: "border",
    label: "Border",
    tokens: [
      { key: "--canvas-border", label: "Border Primary" },
      { key: "--canvas-border-2", label: "Border Secondary" },
    ],
  },
  {
    id: "utility",
    label: "Utility",
    tokens: [
      { key: "--canvas-muted", label: "Muted" },
    ],
  },
];

export const CANVAS_TOKEN_OPTIONS = CANVAS_TOKEN_GROUPS.flatMap((group) =>
  group.tokens.map((token) => ({ ...token, group: group.label }))
);

export const THEME_VAR_KEYS = CANVAS_TOKEN_OPTIONS.map((token) => token.key);

function fillThemeVars(vars) {
  const base = vars || {};
  return {
    "--canvas-bg": base["--canvas-bg"] || "#0a0a0a",
    "--canvas-bg-2": base["--canvas-bg-2"] || base["--canvas-surface"] || base["--canvas-bg"] || "#111827",
    "--canvas-bg-3": base["--canvas-bg-3"] || base["--canvas-border"] || base["--canvas-bg-2"] || "#1f2937",
    "--canvas-text": base["--canvas-text"] || "#e5e7eb",
    "--canvas-text-2": base["--canvas-text-2"] || base["--canvas-muted"] || base["--canvas-text"] || "#cbd5e1",
    "--canvas-text-3": base["--canvas-text-3"] || base["--canvas-border"] || base["--canvas-text-2"] || "#94a3b8",
    "--canvas-accent": base["--canvas-accent"] || "#6366f1",
    "--canvas-accent-2": base["--canvas-accent-2"] || base["--canvas-accent"] || "#8b5cf6",
    "--canvas-accent-3": base["--canvas-accent-3"] || base["--canvas-muted"] || "#c084fc",
    "--canvas-surface": base["--canvas-surface"] || base["--canvas-bg-2"] || "#1a1a2e",
    "--canvas-surface-2": base["--canvas-surface-2"] || base["--canvas-surface"] || "#23263a",
    "--canvas-surface-3": base["--canvas-surface-3"] || base["--canvas-bg-3"] || "#2d3148",
    "--canvas-border": base["--canvas-border"] || "#2a2a3e",
    "--canvas-border-2": base["--canvas-border-2"] || base["--canvas-border"] || "#3f4664",
    "--canvas-muted": base["--canvas-muted"] || "#94a3b8",
  };
}

function makeTheme(id, name, preview, vars) {
  return {
    id,
    name,
    preview,
    vars: fillThemeVars(vars),
  };
}

export const CANVAS_THEMES = [
  makeTheme("midnight", "Midnight", { bg: "#0a0a0a", accent: "#6366f1" }, {
    "--canvas-bg": "#0a0a0a",
    "--canvas-bg-2": "#111827",
    "--canvas-bg-3": "#1f2937",
    "--canvas-text": "#e0e0e0",
    "--canvas-text-2": "#cbd5e1",
    "--canvas-text-3": "#94a3b8",
    "--canvas-accent": "#6366f1",
    "--canvas-accent-2": "#8b5cf6",
    "--canvas-accent-3": "#c084fc",
    "--canvas-surface": "#1a1a2e",
    "--canvas-surface-2": "#23263a",
    "--canvas-surface-3": "#2f3347",
    "--canvas-border": "#2a2a3e",
    "--canvas-border-2": "#3f4664",
    "--canvas-muted": "#888888",
  }),
  makeTheme("arctic", "Arctic", { bg: "#f0f4f8", accent: "#3b82f6" }, {
    "--canvas-bg": "#f0f4f8",
    "--canvas-bg-2": "#e2e8f0",
    "--canvas-bg-3": "#cbd5e1",
    "--canvas-text": "#1e293b",
    "--canvas-text-2": "#334155",
    "--canvas-text-3": "#64748b",
    "--canvas-accent": "#3b82f6",
    "--canvas-accent-2": "#2563eb",
    "--canvas-accent-3": "#60a5fa",
    "--canvas-surface": "#ffffff",
    "--canvas-surface-2": "#f8fafc",
    "--canvas-surface-3": "#e2e8f0",
    "--canvas-border": "#cbd5e1",
    "--canvas-border-2": "#94a3b8",
    "--canvas-muted": "#64748b",
  }),
  makeTheme("forest", "Forest", { bg: "#0d1f0d", accent: "#4caf50" }, {
    "--canvas-bg": "#0d1f0d",
    "--canvas-bg-2": "#163316",
    "--canvas-bg-3": "#214a21",
    "--canvas-text": "#c8e6c9",
    "--canvas-text-2": "#a5d6a7",
    "--canvas-text-3": "#81c784",
    "--canvas-accent": "#4caf50",
    "--canvas-accent-2": "#2e7d32",
    "--canvas-accent-3": "#66bb6a",
    "--canvas-surface": "#1b3a1b",
    "--canvas-surface-2": "#254825",
    "--canvas-surface-3": "#2f5630",
    "--canvas-border": "#2e5a2e",
    "--canvas-border-2": "#437a43",
    "--canvas-muted": "#81a784",
  }),
  makeTheme("sunset", "Sunset", { bg: "#1a0a0a", accent: "#ff6b35" }, {
    "--canvas-bg": "#1a0a0a",
    "--canvas-bg-2": "#2a1515",
    "--canvas-bg-3": "#3a1f1f",
    "--canvas-text": "#ffd7b5",
    "--canvas-text-2": "#f8c49a",
    "--canvas-text-3": "#dca37a",
    "--canvas-accent": "#ff6b35",
    "--canvas-accent-2": "#f97316",
    "--canvas-accent-3": "#fb923c",
    "--canvas-surface": "#2a1515",
    "--canvas-surface-2": "#341d1d",
    "--canvas-surface-3": "#442727",
    "--canvas-border": "#4a2525",
    "--canvas-border-2": "#663232",
    "--canvas-muted": "#b08060",
  }),
  makeTheme("ocean", "Ocean", { bg: "#0a1628", accent: "#06b6d4" }, {
    "--canvas-bg": "#0a1628",
    "--canvas-bg-2": "#102038",
    "--canvas-bg-3": "#17304d",
    "--canvas-text": "#b8d4e3",
    "--canvas-text-2": "#8fc0d4",
    "--canvas-text-3": "#6ea0b8",
    "--canvas-accent": "#06b6d4",
    "--canvas-accent-2": "#0891b2",
    "--canvas-accent-3": "#67e8f9",
    "--canvas-surface": "#0f2840",
    "--canvas-surface-2": "#163654",
    "--canvas-surface-3": "#20466a",
    "--canvas-border": "#1a3d5c",
    "--canvas-border-2": "#2f5d82",
    "--canvas-muted": "#5b8fa8",
  }),
  makeTheme("rose", "Rosé", { bg: "#1a0f14", accent: "#f43f5e" }, {
    "--canvas-bg": "#1a0f14",
    "--canvas-bg-2": "#24131b",
    "--canvas-bg-3": "#321925",
    "--canvas-text": "#fce4ec",
    "--canvas-text-2": "#f8bbd0",
    "--canvas-text-3": "#e79ab4",
    "--canvas-accent": "#f43f5e",
    "--canvas-accent-2": "#e11d48",
    "--canvas-accent-3": "#fb7185",
    "--canvas-surface": "#2d1a22",
    "--canvas-surface-2": "#3a212b",
    "--canvas-surface-3": "#482a35",
    "--canvas-border": "#4a2a36",
    "--canvas-border-2": "#6a3c4b",
    "--canvas-muted": "#c08090",
  }),
  makeTheme("amber", "Amber Glow", { bg: "#12100e", accent: "#f59e0b" }, {
    "--canvas-bg": "#12100e",
    "--canvas-bg-2": "#1a1712",
    "--canvas-bg-3": "#272117",
    "--canvas-text": "#fef3c7",
    "--canvas-text-2": "#fde68a",
    "--canvas-text-3": "#e7c96d",
    "--canvas-accent": "#f59e0b",
    "--canvas-accent-2": "#d97706",
    "--canvas-accent-3": "#fbbf24",
    "--canvas-surface": "#1c1a16",
    "--canvas-surface-2": "#29241d",
    "--canvas-surface-3": "#3a3227",
    "--canvas-border": "#3d3627",
    "--canvas-border-2": "#5c5039",
    "--canvas-muted": "#a89060",
  }),
];

export function ensureThemeVars(vars) {
  return fillThemeVars(vars);
}

/** Default theme when none is set */
export const DEFAULT_THEME = CANVAS_THEMES[0];
