"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translate, type LangCode } from "@/lib/i18n-dict";

const Ctx = createContext<{
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}>({ lang: "es", setLang: () => {}, settingsOpen: false, setSettingsOpen: () => {} });
export function I18nProvider({ lang, children }: { lang: LangCode; children: ReactNode }) {
  const [currentLang, setCurrentLang] = useState(lang);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => setCurrentLang(lang), [lang]);
  return <Ctx.Provider value={{ lang: currentLang, setLang: setCurrentLang, settingsOpen, setSettingsOpen }}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx).lang;
export const useSetLang = () => useContext(Ctx).setLang;
export const useSettingsModal = () => {
  const { settingsOpen, setSettingsOpen } = useContext(Ctx);
  return [settingsOpen, setSettingsOpen] as const;
};
export function useT() {
  const lang = useLang();
  return (es: string) => translate(lang, es);
}
