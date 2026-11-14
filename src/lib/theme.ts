/**
 * Day / night theme shared by the storefront and the admin panel.
 *
 * The initial theme is applied by a tiny inline script in index.html so the
 * first paint already matches the saved preference; this store mirrors it for
 * React and persists later changes.
 */

import { create } from "zustand";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "3dprintco-theme";

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode can refuse storage; the in-memory theme still works.
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0d110f" : "#f8f7f3");
}

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => Theme;
};

export const useTheme = create<ThemeState>((set, get) => ({
  theme: readInitialTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
  toggle: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
    return next;
  },
}));
