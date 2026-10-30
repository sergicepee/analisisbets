"use client";

import { useEffect, useRef, useState } from "react";
import type { ThemePreference } from "@/lib/theme";
import { useT } from "./I18nProvider";
import { applyThemePreference, getThemePreference } from "./theme-client";
import { IconMonitor, IconMoon, IconSun } from "./icons";

const choices: { value: ThemePreference; label: string; Icon: typeof IconMoon }[] = [
  { value: "dark", label: "Oscuro", Icon: IconMoon },
  { value: "light", label: "Claro", Icon: IconSun },
  { value: "system", label: "Sistema", Icon: IconMonitor },
];

export function ThemeSwitcher() {
  const t = useT();
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(getThemePreference());
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const selected = choices.find((choice) => choice.value === theme) ?? choices[0];
  const SelectedIcon = selected.Icon;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={`${t("Tema")}: ${t(selected.label)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${t("Tema")}: ${t(selected.label)}`}
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg p-2 text-muted transition hover:bg-card2 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <SelectedIcon aria-hidden="true" className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" aria-label={t("Tema")} className="absolute right-0 top-full z-[90] mt-2 w-40 rounded-xl border border-line bg-card p-1 shadow-xl">
          {choices.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              onClick={() => {
                applyThemePreference(value);
                setTheme(value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-card2 ${theme === value ? "text-brand" : "text-fg"}`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {t(label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
