// Visual metadata for widget cards keyed by widget type id.
// Categories also have colors so unknown widget types still look styled.
const CATEGORY_COLORS = {
  time: { color: "#2563EB", bg: "#EFF6FF" },
  data: { color: "#0891B2", bg: "#ECFEFF" },
  media: { color: "#7C3AED", bg: "#F5F3FF" },
  system: { color: "#EA580C", bg: "#FFF7ED" },
  "smart-home": { color: "#16A34A", bg: "#F0FDF4" },
  default: { color: "#475569", bg: "#F1F5F9" },
};

export function getWidgetVisuals(manifest) {
  const cat = manifest?.category || "default";
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;
}

export const CANVAS_W = 1280;
export const CANVAS_H = 720;
