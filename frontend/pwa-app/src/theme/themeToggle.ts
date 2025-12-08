import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "rcme-theme";

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

const applyThemeToRoot = (theme: ThemeMode) => {
  if (!isBrowser) return;
  document.documentElement.setAttribute("data-theme", theme);
};

export const getCurrentTheme = (): ThemeMode => {
  if (!isBrowser) return "light";

  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

export const setTheme = (theme: ThemeMode) => {
  applyThemeToRoot(theme);
  if (isBrowser) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage failures
    }
  }
};

export const useTheme = () => {
  const [theme, setThemeState] = useState<ThemeMode>(() => getCurrentTheme());

  useEffect(() => {
    applyThemeToRoot(theme);
    if (isBrowser) {
      try {
        window.localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // ignore storage failures
      }
    }
  }, [theme]);

  useEffect(() => {
    const current = getCurrentTheme();
    if (current !== theme) {
      setThemeState(current);
    }
  }, []);

  return {
    theme,
    setTheme: (next: ThemeMode) => setThemeState(next),
  };
};

