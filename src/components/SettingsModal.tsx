"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLang, useT } from "./I18nProvider";
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

export function SettingsModal({ tz, onClose }: { tz: string; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [zone, setZone] = useState(tz);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const zones = useMemo(() => {
    let list = FALLBACK_ZONES;
    try { const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone"); if (all?.length) list = all; } catch { /* usa la lista corta */ }
    return list.includes(tz) ? list : [tz, ...list];
  }, [tz]);

  const chooseLang = (l: "es" | "en") => { setPref("gl_lang", l); router.refresh(); };
  const chooseTheme = (v: "dark" | "light") => { setPref("gl_theme", v); document.documentElement.dataset.theme = v; setTheme(v); };
  const chooseZone = (z: string) => { setZone(z); setPref("gl_tz", z); router.refresh(); };

  return createPortal((
    <div className="fixed inset-0 z-[100] flex h-[100dvh] items-center justify-center overflow-hidden overscroll-none bg-black/75 p-4 max-sm:p-0" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-bg p-5 overscroll-contain max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none max-sm:border-0 max-sm:px-4 max-sm:pb-[calc(env(safe-area-inset-bottom)+1rem)] max-sm:pt-[calc(env(safe-area-inset-top)+1rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-black sm:text-3xl">{t("Ajustes")}</h2>
          <button onClick={onClose} aria-label={t("Cerrar")} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card"><IconClose className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <Block Icon={IconGlobe} title={t("Idioma")} sub={t("Elige tu idioma preferido")}>
            <Option on={lang === "es"} onClick={() => chooseLang("es")}><span>🇪🇸</span>Español</Option>
            <Option on={lang === "en"} onClick={() => chooseLang("en")}><span>🇬🇧</span>English</Option>
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
