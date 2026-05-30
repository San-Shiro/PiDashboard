/**
 * Canvas Theme Presets — built-in themes for kiosk display.
 * Widgets use these via CSS variables: var(--canvas-text), var(--canvas-accent), etc.
 */

export const CANVAS_THEMES = [
  {
    id: "midnight",
    name: "Midnight",
    preview: { bg: "#0a0a0a", accent: "#6366f1" },
    vars: {
      "--canvas-bg": "#0a0a0a",
      "--canvas-text": "#e0e0e0",
      "--canvas-accent": "#6366f1",
      "--canvas-surface": "#1a1a2e",
      "--canvas-border": "#2a2a3e",
      "--canvas-muted": "#888888",
    },
  },
  {
    id: "arctic",
    name: "Arctic",
    preview: { bg: "#f0f4f8", accent: "#3b82f6" },
    vars: {
      "--canvas-bg": "#f0f4f8",
      "--canvas-text": "#1e293b",
      "--canvas-accent": "#3b82f6",
      "--canvas-surface": "#ffffff",
      "--canvas-border": "#cbd5e1",
      "--canvas-muted": "#64748b",
    },
  },
  {
    id: "forest",
    name: "Forest",
    preview: { bg: "#0d1f0d", accent: "#4caf50" },
    vars: {
      "--canvas-bg": "#0d1f0d",
      "--canvas-text": "#c8e6c9",
      "--canvas-accent": "#4caf50",
      "--canvas-surface": "#1b3a1b",
      "--canvas-border": "#2e5a2e",
      "--canvas-muted": "#81a784",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    preview: { bg: "#1a0a0a", accent: "#ff6b35" },
    vars: {
      "--canvas-bg": "#1a0a0a",
      "--canvas-text": "#ffd7b5",
      "--canvas-accent": "#ff6b35",
      "--canvas-surface": "#2a1515",
      "--canvas-border": "#4a2525",
      "--canvas-muted": "#b08060",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    preview: { bg: "#0a1628", accent: "#06b6d4" },
    vars: {
      "--canvas-bg": "#0a1628",
      "--canvas-text": "#b8d4e3",
      "--canvas-accent": "#06b6d4",
      "--canvas-surface": "#0f2840",
      "--canvas-border": "#1a3d5c",
      "--canvas-muted": "#5b8fa8",
    },
  },
  {
    id: "rose",
    name: "Rosé",
    preview: { bg: "#1a0f14", accent: "#f43f5e" },
    vars: {
      "--canvas-bg": "#1a0f14",
      "--canvas-text": "#fce4ec",
      "--canvas-accent": "#f43f5e",
      "--canvas-surface": "#2d1a22",
      "--canvas-border": "#4a2a36",
      "--canvas-muted": "#c08090",
    },
  },
  {
    id: "amber",
    name: "Amber Glow",
    preview: { bg: "#12100e", accent: "#f59e0b" },
    vars: {
      "--canvas-bg": "#12100e",
      "--canvas-text": "#fef3c7",
      "--canvas-accent": "#f59e0b",
      "--canvas-surface": "#1c1a16",
      "--canvas-border": "#3d3627",
      "--canvas-muted": "#a89060",
    },
  },
];

/** Default theme when none is set */
export const DEFAULT_THEME = CANVAS_THEMES[0]; // midnight

/** CSS variable keys that canvas themes provide */
export const THEME_VAR_KEYS = [
  "--canvas-bg",
  "--canvas-text",
  "--canvas-accent",
  "--canvas-surface",
  "--canvas-border",
  "--canvas-muted",
];
