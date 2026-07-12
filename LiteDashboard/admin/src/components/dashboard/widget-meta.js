// Visual metadata for widget cards keyed by widget type id.
// Categories also have colors so unknown widget types still look styled.
const CATEGORY_COLORS = {
  time: { color: "#2563EB", bg: "#EFF6FF" },
  weather: { color: "#0EA5E9", bg: "#ECFEFF" },
  data: { color: "#0891B2", bg: "#ECFEFF" },
  media: { color: "#7C3AED", bg: "#F5F3FF" },
  typography: { color: "#8B5CF6", bg: "#F5F3FF" },
  info: { color: "#0F766E", bg: "#ECFDF5" },
  system: { color: "#EA580C", bg: "#FFF7ED" },
  "smart-home": { color: "#16A34A", bg: "#F0FDF4" },
  default: { color: "#475569", bg: "#F1F5F9" },
};

export function getWidgetVisuals(manifest) {
  const cat = String(manifest?.category || "default").toLowerCase();
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;
}
