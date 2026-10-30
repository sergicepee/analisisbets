"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { translate, type LangCode } from "@/lib/i18n-dict";

const Ctx = createContext<{
  lang: LangCode;
  setLang: (lang: LangCode) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}>({ lang: "es", setLang: () => {}, settingsOpen: false, setSettingsOpen: () => {}, searchOpen: false, setSearchOpen: () => {} });
export function I18nProvider({ lang, children }: { lang: LangCode; children: ReactNode }) {
  const [currentLang, setCurrentLang] = useState(lang);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => setCurrentLang(lang), [lang]);
  return <Ctx.Provider value={{ lang: currentLang, setLang: setCurrentLang, settingsOpen, setSettingsOpen, searchOpen, setSearchOpen }}>{children}</Ctx.Provider>;
}
export function I18nText({ text }: { text: string }) {
  const translateText = useT();
  return <>{translateText(text)}</>;
}
export const useLang = () => useContext(Ctx).lang;
export const useSetLang = () => useContext(Ctx).setLang;
export const useSettingsModal = () => {
  const { settingsOpen, setSettingsOpen } = useContext(Ctx);
  return [settingsOpen, setSettingsOpen] as const;
};
export const useSearchModal = () => {
  const { searchOpen, setSearchOpen } = useContext(Ctx);
  return [searchOpen, setSearchOpen] as const;
};
export function useT() {
  const lang = useLang();
  return useCallback((es: string) => translate(lang, es), [lang]);
}
