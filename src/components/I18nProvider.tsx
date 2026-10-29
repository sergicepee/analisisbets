"use client";
import { createContext, useContext, type ReactNode } from "react";
import { translate, type LangCode } from "@/lib/i18n-dict";

const Ctx = createContext<LangCode>("es");
export function I18nProvider({ lang, children }: { lang: LangCode; children: ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx);
export function useT() {
  const lang = useContext(Ctx);
  return (es: string) => translate(lang, es);
}
