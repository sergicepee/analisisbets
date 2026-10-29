"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "./I18nProvider";
import { SettingsModal } from "./SettingsModal";
import { IconGo, IconHandshake, IconHelp, IconLogOut, IconSend, IconSettings, IconUser } from "./icons";

export function UserMenu({ loggedIn, tz, telegramUrl }: { loggedIn: boolean; tz: string; telegramUrl?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); window.removeEventListener("keydown", esc); };
  }, [open]);

  const row = "flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-bold hover:bg-card2";
  const Chevron = <IconGo className="ml-auto h-4 w-4 text-muted" />;
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={t("Mi cuenta")} aria-expanded={open} className="relative flex h-9 w-9 items-center justify-center">
        <IconUser className={`h-5 w-5 ${loggedIn ? "text-brand" : "text-slate-300"}`} />
        {loggedIn && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-win" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-line bg-card p-2 shadow-2xl">
          {loggedIn ? (
            <Link href="/cuenta" onClick={() => setOpen(false)} className={row}><IconUser className="h-5 w-5" />{t("Mi cuenta")}{Chevron}</Link>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className={row}><IconUser className="h-5 w-5" />{t("Iniciar sesión")}{Chevron}</Link>
          )}
          <button onClick={() => { setOpen(false); setSettings(true); }} className={row}><IconSettings className="h-5 w-5" />{t("Ajustes")}{Chevron}</button>
          {telegramUrl && (
            <a href={telegramUrl} target="_blank" rel="noopener noreferrer" className={row}><IconSend className="h-5 w-5" />{t("Canal de Telegram")}{Chevron}</a>
          )}
          <Link href="/ayuda" onClick={() => setOpen(false)} className={row}><IconHelp className="h-5 w-5" />{t("Ayuda y soporte")}{Chevron}</Link>
          <Link href="/colaboracion" onClick={() => setOpen(false)} className={row}><IconHandshake className="h-5 w-5" />{t("Colaboración")}{Chevron}</Link>
          {loggedIn && (
            <form action="/auth/signout" method="post" className="mt-1 border-t border-line pt-1">
              <button className={`${row} text-loss`}><IconLogOut className="h-5 w-5" />{t("Cerrar sesión")}</button>
            </form>
          )}
        </div>
      )}
      {settings && <SettingsModal tz={tz} onClose={() => setSettings(false)} />}
    </div>
  );
}
