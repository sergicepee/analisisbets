"use client";

import type { ThemePreference } from "@/lib/theme";
import { setPref } from "./prefs-client";

export function getThemePreference(): ThemePreference {
  const saved = document.cookie.match(/(?:^|;\s*)gl_theme=(dark|light|system)(?:;|$)/)?.[1];
  return saved === "light" || saved === "system" ? saved : "dark";
}

export function applyThemePreference(theme: ThemePreference) {
  setPref("gl_theme", theme);
  document.documentElement.dataset.theme = theme;
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const resolvedTheme = theme === "system" ? (prefersLight ? "light" : "dark") : theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "light" ? "#f4f6f8" : "#0f0f0f");
}
