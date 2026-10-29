"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translate, type LangCode } from "@/lib/i18n-dict";

const Ctx = createContext<{ lang: LangCode; setLang: (lang: LangCode) => void }>({ lang: "es", setLang: () => {} });
export function I18nProvider({ lang, children }: { lang: LangCode; children: ReactNode }) {
  const [currentLang, setCurrentLang] = useState(lang);
  useEffect(() => setCurrentLang(lang), [lang]);
  return <Ctx.Provider value={{ lang: currentLang, setLang: setCurrentLang }}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx).lang;
export const useSetLang = () => useContext(Ctx).setLang;
export function useT() {
  const lang = useLang();
  return (es: string) => translate(lang, es);
}
