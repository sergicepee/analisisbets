"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLang, useSetLang, useT } from "./I18nProvider";
import { setPref } from "./prefs-client";
import { IconCalendar, IconClose, IconGlobe, IconMoon, IconSettings, IconSun } from "./icons";

const FALLBACK_ZONES = ["Europe/Madrid", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Lisbon", "America/Mexico_City", "America/Bogota", "America/Lima", "America/Santiago", "America/Argentina/Buenos_Aires", "America/New_York", "America/Los_Angeles", "Atlantic/Canary", "UTC"];

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 sm:py-3 text-left text-sm font-semibold ${on ? "border-win/70 bg-win/10" : "border-line bg-card2"}`}>
      <span className="flex items-center gap-3">{children}</span>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-win" : "border-muted/50"}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-win" />}</span>
    </button>
  );
}

function Block({ Icon, title, sub, children }: { Icon: typeof IconGlobe; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
      <div className="mb-2 flex items-center gap-3 sm:mb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-win/15 text-win sm:h-10 sm:w-10"><Icon className="h-5 w-5" /></span>
        <div><div className="font-bold">{title}</div><div className="text-xs text-muted">{sub}</div></div>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function LanguageFlag({ lang }: { lang: "es" | "en" }) {
  return lang === "es" ? (
    <svg aria-hidden="true" viewBox="0 0 24 16" className="h-4 w-6 shrink-0 overflow-hidden rounded-[3px] shadow-sm">
      <rect width="24" height="16" fill="#c60b1e" /><rect y="4" width="24" height="8" fill="#ffc400" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 16" className="h-4 w-6 shrink-0 overflow-hidden rounded-[3px] shadow-sm">
      <rect width="24" height="16" fill="#21468b" />
      <path d="M0 0 3.6 0 24 12.4 24 16 20.4 16 0 3.6ZM24 0 20.4 0 0 12.4 0 16 3.6 16 24 3.6Z" fill="#fff" />
      <path d="M0 0 1.8 0 24 13.4 24 16 22.2 16 0 2.6ZM24 0 22.2 0 0 13.4 0 16 1.8 16 24 2.6Z" fill="#c8102e" />
      <path d="M9 0h6v16H9zM0 5h24v6H0z" fill="#fff" /><path d="M10.2 0h3.6v16h-3.6zM0 6.2h24v3.6H0z" fill="#c8102e" />
    </svg>
  );
}

export function SettingsModal({ tz, onClose }: { tz: string; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const setLang = useSetLang();
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [zone, setZone] = useState(tz);
  const languageChanged = useRef(false);
  const close = useCallback(() => {
    onClose();
    if (languageChanged.current) {
      languageChanged.current = false;
      router.refresh();
    }
  }, [onClose, router]);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      window.removeEventListener("keydown", esc);
    };
  }, [close]);

  const zones = useMemo(() => {
    let list = FALLBACK_ZONES;
    try { const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone"); if (all?.length) list = all; } catch { /* usa la lista corta */ }
    return list.includes(tz) ? list : [tz, ...list];
  }, [tz]);

  const chooseLang = (l: "es" | "en") => { languageChanged.current = true; setPref("gl_lang", l); setLang(l); document.documentElement.lang = l; };
  const chooseTheme = (v: "dark" | "light") => { setPref("gl_theme", v); document.documentElement.dataset.theme = v; setTheme(v); };
  const chooseZone = (z: string) => { setZone(z); setPref("gl_tz", z); router.refresh(); };

  return createPortal((
    <div className="fixed inset-0 z-[100] flex h-[100dvh] items-center justify-center overflow-hidden overscroll-none bg-black/75 p-4 max-[720px]:p-0" onClick={close} role="dialog" aria-modal="true">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-bg p-5 overscroll-contain max-[720px]:h-[100dvh] max-[720px]:min-h-[100dvh] max-[720px]:max-h-none max-[720px]:max-w-none max-[720px]:rounded-none max-[720px]:border-0 max-[720px]:px-4 max-[720px]:pb-[calc(env(safe-area-inset-bottom)+1rem)] max-[720px]:pt-[calc(env(safe-area-inset-top)+1rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black sm:text-3xl">{t("Ajustes")}</h2>
          <button onClick={close} aria-label={t("Cerrar")} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card"><IconClose className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <Block Icon={IconGlobe} title={t("Idioma")} sub={t("Elige tu idioma preferido")}>
            <Option on={lang === "es"} onClick={() => chooseLang("es")}><LanguageFlag lang="es" />Español</Option>
            <Option on={lang === "en"} onClick={() => chooseLang("en")}><LanguageFlag lang="en" />English</Option>
          </Block>
          <Block Icon={IconSettings} title={t("Tema")} sub={t("Elige cómo se ve la web")}>
            <Option on={theme === "dark"} onClick={() => chooseTheme("dark")}><IconMoon className="h-4 w-4" />{t("Oscuro")}</Option>
            <Option on={theme === "light"} onClick={() => chooseTheme("light")}><IconSun className="h-4 w-4" />{t("Claro")}</Option>
          </Block>
        </div>
        <div className="mt-3 sm:mt-4">
          <Block Icon={IconCalendar} title={t("Zona horaria")} sub={t("Elige la hora local de los partidos")}>
            <select value={zone} onChange={(e) => chooseZone(e.target.value)} className="w-full rounded-xl border border-line bg-card2 px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand sm:py-3">
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <button type="button" onClick={() => chooseZone(Intl.DateTimeFormat().resolvedOptions().timeZone)} className="w-full rounded-xl border border-line bg-card2 py-2.5 text-sm font-bold sm:py-3">{t("Usar la zona horaria del dispositivo")}</button>
          </Block>
        </div>
      </div>
    </div>
  ), document.body);
}
