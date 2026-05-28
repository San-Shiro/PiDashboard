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

function applyTheme(config) {
  if (!config || typeof document === "undefined") return;
  const root = document.documentElement;
  Object.entries(config).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export default function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pidash_dark_mode");
      if (saved !== null) return saved === "true";
      // Fallback to system dark mode preference
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const config = isDark ? DARK_THEME : LIGHT_THEME;
    applyTheme(config);
    if (typeof window !== "undefined") {
      localStorage.setItem("pidash_dark_mode", isDark.toString());
    }
  }, [isDark]);

  const toggleDarkLight = useCallback(() => {
    setIsDark((prev) => !prev);
  }, []);

  const activeTheme = {
    id: isDark ? "dark" : "light",
    name: isDark ? "Dark Theme" : "Light Theme",
    is_active: true,
    config: isDark ? DARK_THEME : LIGHT_THEME
  };

  return (
    <ThemeContext.Provider
      value={{
        activeTheme,
        themes: [
          { id: "light", name: "Light Theme", config: LIGHT_THEME },
          { id: "dark", name: "Dark Theme", config: DARK_THEME }
        ],
        activateTheme: (id) => setIsDark(id === "dark"),
        isDark,
        toggleDarkLight,
      }}
    >
      <style>{`
        :root {
          --color-bg: #F9FAFB;
          --color-surface: #FFFFFF;
          --color-surface-2: #F3F4F6;
          --color-border: #E5E7EB;
          --color-border-2: #D1D5DB;
          --color-text-primary: #111827;
          --color-text-secondary: #6B7280;
          --color-text-muted: #9CA3AF;
          --color-accent: #2563EB;
          --color-accent-bg: #EFF6FF;
          --color-accent-hover: #1D4ED8;
          --color-danger: #DC2626;
          --color-danger-bg: #FEF2F2;
          --color-warn: #D97706;
          --color-warn-bg: #FFFBEB;
          --color-success: #16A34A;
          --color-success-bg: #F0FDF4;
          --color-header-bg: #FFFFFF;
          --color-header-border: #E5E7EB;
        }
        body { background-color: var(--color-bg); }
      `}</style>
      {children}
    </ThemeContext.Provider>
  );
}
