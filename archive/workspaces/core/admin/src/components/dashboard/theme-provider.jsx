// Exposes client-side dark/light mode switcher, applying custom CSS variables properties to :root and caching preferences in localStorage.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

const ThemeContext = createContext({
  activeTheme: null,
  themes: [],
  activateTheme: () => {},
  isDark: false,
  toggleDarkLight: () => {},
  createCustomTheme: () => {},
  deleteCustomTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const LIGHT_THEME = {
  "--color-bg": "#F9FAFB",
  "--color-surface": "#FFFFFF",
  "--color-surface-2": "#F3F4F6",
  "--color-border": "#E5E7EB",
  "--color-border-2": "#D1D5DB",
  "--color-text-primary": "#111827",
  "--color-text-secondary": "#6B7280",
  "--color-text-muted": "#9CA3AF",
  "--color-accent": "#2563EB",
  "--color-accent-bg": "#EFF6FF",
  "--color-accent-hover": "#1D4ED8",
  "--color-danger": "#DC2626",
  "--color-danger-bg": "#FEF2F2",
  "--color-warn": "#D97706",
  "--color-warn-bg": "#FFFBEB",
  "--color-success": "#16A34A",
  "--color-success-bg": "#F0FDF4",
  "--color-header-bg": "#FFFFFF",
  "--color-header-border": "#E5E7EB"
};

const DARK_THEME = {
  "--color-bg": "#0B0F19",
  "--color-surface": "#151F32",
  "--color-surface-2": "#1F2D44",
  "--color-border": "#1E293B",
  "--color-border-2": "#334155",
  "--color-text-primary": "#F8FAFC",
  "--color-text-secondary": "#94A3B8",
  "--color-text-muted": "#64748B",
  "--color-accent": "#3B82F6",
  "--color-accent-bg": "#1E293B",
  "--color-accent-hover": "#60A5FA",
  "--color-danger": "#EF4444",
  "--color-danger-bg": "#2A1F2D",
  "--color-warn": "#F59E0B",
  "--color-warn-bg": "#2D261F",
  "--color-success": "#10B981",
  "--color-success-bg": "#1F2D2A",
  "--color-header-bg": "#111A2E",
  "--color-header-border": "#1E293B"
};

const MIDNIGHT_THEME = {
  "--color-bg": "#090D1A",
  "--color-surface": "#10172A",
  "--color-surface-2": "#1E293B",
  "--color-border": "#1E293B",
  "--color-border-2": "#334155",
  "--color-text-primary": "#F8FAFC",
  "--color-text-secondary": "#94A3B8",
  "--color-text-muted": "#64748B",
  "--color-accent": "#6366F1",
  "--color-accent-bg": "#1E1B4B",
  "--color-accent-hover": "#818CF8",
  "--color-danger": "#F43F5E",
  "--color-danger-bg": "#311A2E",
  "--color-warn": "#F59E0B",
  "--color-warn-bg": "#2D261F",
  "--color-success": "#10B981",
  "--color-success-bg": "#1F2D2A",
  "--color-header-bg": "#0F172A",
  "--color-header-border": "#1E293B"
};

const FOREST_THEME = {
  "--color-bg": "#060A07",
  "--color-surface": "#0D140F",
  "--color-surface-2": "#16221A",
  "--color-border": "#162E21",
  "--color-border-2": "#234A35",
  "--color-text-primary": "#F0FDF4",
  "--color-text-secondary": "#86EFAC",
  "--color-text-muted": "#4ADE80",
  "--color-accent": "#10B981",
  "--color-accent-bg": "#064E3B",
  "--color-accent-hover": "#34D399",
  "--color-danger": "#EF4444",
  "--color-danger-bg": "#2A1F2C",
  "--color-warn": "#F59E0B",
  "--color-warn-bg": "#2D261F",
  "--color-success": "#10B981",
  "--color-success-bg": "#1F2D2A",
  "--color-header-bg": "#0E1712",
  "--color-header-border": "#162E21"
};

function applyTheme(config) {
  if (!config || typeof document === "undefined") return;
  const root = document.documentElement;
  Object.entries(config).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export default function ThemeProvider({ children }) {
  const [activeThemeId, setActiveThemeId] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("pidash_active_theme") || "midnight";
    }
    return "midnight";
  });

  const [customThemes, setCustomThemes] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("pidash_custom_themes") || "[]");
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const getThemeConfig = useCallback((id) => {
    // Check built-in themes first
    if (id === "light") return LIGHT_THEME;
    if (id === "dark") return DARK_THEME;
    if (id === "midnight") return MIDNIGHT_THEME;
    if (id === "forest") return FOREST_THEME;
    
    // Check custom themes
    const found = customThemes.find((t) => t.id === id);
    if (found) return found.config;

    return MIDNIGHT_THEME; // Default fallback
  }, [customThemes]);

  useEffect(() => {
    const config = getThemeConfig(activeThemeId);
    applyTheme(config);
    if (typeof window !== "undefined") {
      localStorage.setItem("pidash_active_theme", activeThemeId);
    }
  }, [activeThemeId, getThemeConfig]);

  const toggleDarkLight = useCallback(() => {
    setActiveThemeId((prev) => (prev === "light" ? "midnight" : "light"));
  }, []);

  const createCustomTheme = useCallback((name, config) => {
    const newTheme = { id: `custom_${Date.now()}`, name, config };
    setCustomThemes((prev) => {
      const next = [...prev, newTheme];
      localStorage.setItem("pidash_custom_themes", JSON.stringify(next));
      return next;
    });
    setActiveThemeId(newTheme.id);
  }, []);

  const deleteCustomTheme = useCallback((id) => {
    setCustomThemes((prev) => {
      const next = prev.filter((t) => t.id !== id);
      localStorage.setItem("pidash_custom_themes", JSON.stringify(next));
      return next;
    });
    setActiveThemeId((prev) => (prev === id ? "midnight" : prev));
  }, []);

  const activeThemeConfig = getThemeConfig(activeThemeId);
  const activeThemeName = activeThemeId === "light" 
    ? "Light" 
    : activeThemeId === "dark" 
      ? "Dark" 
      : activeThemeId === "midnight" 
        ? "Midnight Blue" 
        : activeThemeId === "forest" 
          ? "Forest" 
          : (customThemes.find((t) => t.id === activeThemeId)?.name || "Custom Theme");

  const activeTheme = {
    id: activeThemeId,
    name: activeThemeName,
    is_active: true,
    config: activeThemeConfig
  };

  const isDark = activeThemeId !== "light";

  const themesList = [
    { id: "dark", name: "Dark", config: DARK_THEME, is_builtin: true, is_active: activeThemeId === "dark" },
    { id: "forest", name: "Forest", config: FOREST_THEME, is_builtin: true, is_active: activeThemeId === "forest" },
    { id: "light", name: "Light", config: LIGHT_THEME, is_builtin: true, is_active: activeThemeId === "light" },
    { id: "midnight", name: "Midnight Blue", config: MIDNIGHT_THEME, is_builtin: true, is_active: activeThemeId === "midnight" },
    ...customThemes.map((t) => ({ ...t, is_builtin: false, is_active: activeThemeId === t.id }))
  ];

  return (
    <ThemeContext.Provider
      value={{
        activeTheme,
        themes: themesList,
        activateTheme: (id) => setActiveThemeId(id),
        isDark,
        toggleDarkLight,
        createCustomTheme,
        deleteCustomTheme,
      }}
    >
      <style>{`
        :root {
          --color-bg: #090D1A;
          --color-surface: #10172A;
          --color-surface-2: #1E293B;
          --color-border: #1E293B;
          --color-border-2: #334155;
          --color-text-primary: #F8FAFC;
          --color-text-secondary: #94A3B8;
          --color-text-muted: #64748B;
          --color-accent: #6366F1;
          --color-accent-bg: #1E1B4B;
          --color-accent-hover: #818CF8;
          --color-danger: #F43F5E;
          --color-danger-bg: #311A2E;
          --color-warn: #F59E0B;
          --color-warn-bg: #2D261F;
          --color-success: #10B981;
          --color-success-bg: #1F2D2A;
          --color-header-bg: #0F172A;
          --color-header-border: #1E293B;
        }
        body {
          background-color: var(--color-bg);
          color: var(--color-text-primary);
        }
        input[type="text"],
        input[type="number"],
        input[type="password"],
        input[type="time"],
        select,
        textarea {
          background-color: var(--color-surface) !important;
          border-color: var(--color-border) !important;
          color: var(--color-text-primary) !important;
        }
        input[type="text"]::placeholder,
        input[type="password"]::placeholder {
          color: var(--color-text-muted) !important;
        }
        .hover-surface-2:hover {
          background-color: var(--color-surface-2) !important;
        }
      `}</style>
      {children}
    </ThemeContext.Provider>
  );
}