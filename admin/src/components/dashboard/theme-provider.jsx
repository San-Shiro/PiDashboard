// Fetches the active theme from /api/themes, injects CSS custom properties
// onto the root element, and exposes a context for reading + switching themes.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

function applyTheme(config) {
  if (!config || typeof document === "undefined") return;
  const root = document.documentElement;
  Object.entries(config).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

// CSS variable → Tailwind arbitrary-value bridge:
// Components can use var(--color-bg) in inline styles for theme-aware colours.
// Tailwind classes that use hardcoded values remain for structural/spacing classes.

export default function ThemeProvider({ children }) {
  const queryClient = useQueryClient();
  const [applied, setApplied] = useState(false);

  const { data } = useQuery({
    queryKey: ["themes"],
    queryFn: async () => {
      const r = await fetch("/api/themes");
      if (!r.ok) throw new Error("themes");
      return r.json();
    },
    staleTime: 30000,
  });

  const themes = data?.themes || [];
  const activeTheme = themes.find((t) => t.is_active) || themes[0] || null;

  useEffect(() => {
    if (activeTheme?.config) {
      applyTheme(activeTheme.config);
      setApplied(true);
    }
  }, [activeTheme]);

  const activate = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/themes/${id}/activate`, { method: "POST" });
      if (!r.ok) throw new Error("activate");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["themes"] }),
  });

  const toggleDarkLight = useCallback(() => {
    const isDark =
      activeTheme?.id === "dark" ||
      activeTheme?.id === "midnight" ||
      activeTheme?.id === "forest";
    activate.mutate(isDark ? "light" : "dark");
  }, [activeTheme, activate]);

  const isDark = activeTheme
    ? (activeTheme.config?.["--color-bg"] || "").startsWith("#0") ||
      (activeTheme.config?.["--color-bg"] || "").startsWith("#1") ||
      (activeTheme.config?.["--color-bg"] || "").startsWith("#2")
    : false;

  return (
    <ThemeContext.Provider
      value={{
        activeTheme,
        themes,
        activateTheme: (id) => activate.mutate(id),
        isDark,
        toggleDarkLight,
      }}
    >
      {/* Inject fallback light-theme vars before first theme loads to avoid flash */}
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
