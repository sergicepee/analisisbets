"use client";
import { useRouter } from "next/navigation";
import { useLang } from "./I18nProvider";
import { setPref } from "./prefs-client";

export function LangToggle() {
  const lang = useLang();
  const router = useRouter();
  const set = (l: "es" | "en") => { setPref("gl_lang", l); router.refresh(); };
  const cls = (on: boolean) => `rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-brand text-black" : "text-muted"}`;
  return (
    <div className="flex rounded-full border border-line bg-card p-0.5">
      <button onClick={() => set("es")} className={cls(lang === "es")}>ES</button>
      <button onClick={() => set("en")} className={cls(lang === "en")}>EN</button>
    </div>
  );
}
