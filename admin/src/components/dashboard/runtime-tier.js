const TIER_ORDER = {
  lite: 0,
  standard: 1,
  heavy: 2,
};

const DEFAULT_TIER = "standard";
const STORAGE_KEY = "pidash_runtime_tier";

export function normalizeRuntimeTier(value) {
  if (value === "lite" || value === "standard" || value === "heavy") {
    return value;
  }
  return DEFAULT_TIER;
}

export function getWidgetRuntimeTier(widget) {
  return normalizeRuntimeTier(widget?.runtimeTier);
}

export function allowsTier(selectedTier, widgetTier) {
  const selected = normalizeRuntimeTier(selectedTier);
  const widget = normalizeRuntimeTier(widgetTier);
  return TIER_ORDER[widget] <= TIER_ORDER[selected];
}

export function loadSelectedRuntimeTier() {
  try {
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    return normalizeRuntimeTier(fromStorage);
  } catch {
    return DEFAULT_TIER;
  }
}

export function saveSelectedRuntimeTier(tier) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeRuntimeTier(tier));
  } catch {
    // Ignore storage failures in private mode / restricted contexts.
  }
}
