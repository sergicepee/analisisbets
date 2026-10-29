import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./Logo";
import { LangToggle } from "./LangToggle";
import { t } from "@/lib/i18n";

/** Pantalla de acceso: barra mínima + tarjeta centrada (sin menú ni barra inferior). */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between border-b border-line px-5 py-4 lg:px-24">
        <Brand />
        <LangToggle />
      </div>
      <div className="flex justify-center px-4 py-12 lg:py-20">
        <div className="w-full max-w-[430px] rounded-3xl border border-line bg-card p-7 shadow-2xl">
          {children}
          <div className="mt-6 flex justify-center gap-4 text-xs text-muted">
            <Link href="/privacidad" className="hover:text-white">{t("Privacidad")}</Link>
            <Link href="/terminos" className="hover:text-white">{t("Términos")}</Link>
            <Link href="/ayuda" className="hover:text-white">{t("Soporte")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
