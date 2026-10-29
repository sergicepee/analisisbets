import "server-only";
import { cookies } from "next/headers";
import { TZ as DEFAULT_TZ } from "./config";

export type Lang = "es" | "en";
export type Theme = "dark" | "light";

const read = (name: string) => { try { return cookies().get(name)?.value; } catch { return undefined; } };

export const getLang = (): Lang => (read("gl_lang") === "en" ? "en" : "es");
export const getTheme = (): Theme => (read("gl_theme") === "light" ? "light" : "dark");
export const getLocale = () => (getLang() === "en" ? "en-GB" : "es-ES");
export function getTz(): string {
  const v = read("gl_tz");
  if (v) { try { new Intl.DateTimeFormat("es-ES", { timeZone: v }); return v; } catch { /* inválida */ } }
  return DEFAULT_TZ;
}
