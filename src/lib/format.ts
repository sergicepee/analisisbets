import { getLang, getLocale, getTz } from "./prefs";
import { isWithinCsvLiveWindow } from "./fixtureStatus";
import type { Fixture, StatusGroup } from "./types";

export const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: getTz() }).format(new Date());
export function addDays(d: string, n: number) {
  const t = new Date(d + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export const dmy = (d: string) => d.split("-").reverse().join(".");
export const timeStr = (ts: number) =>
  new Intl.DateTimeFormat(getLocale(), { timeZone: getTz(), hour: "2-digit", minute: "2-digit", hour12: false }).format(ts * 1000);
export const dayMonthTime = (ts: number) =>
  new Intl.DateTimeFormat(getLocale(), { timeZone: getTz(), day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(ts * 1000);
export const fullDateTime = (ts: number) =>
  new Intl.DateTimeFormat(getLocale(), { timeZone: getTz(), day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(ts * 1000).replace(",", " ·");

const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
const FIN = ["FT", "AET", "PEN"];
export function statusGroup(f: Fixture): StatusGroup {
  if (LIVE.includes(f.statusShort)) return "live";
  if (FIN.includes(f.statusShort)) return "finished";
  if (["NS", "TBD"].includes(f.statusShort)) {
    const now = Date.now() / 1000;
    if (now < f.timestamp) return "upcoming";
    return f.id < 0 && isWithinCsvLiveWindow(f, now) ? "live" : "pending";
  }
  return "other";
}

/** Formatea un número con coma decimal; null => "—". */
export const num = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined || Number.isNaN(v)
    ? "—"
    : v.toLocaleString(getLocale(), { minimumFractionDigits: 0, maximumFractionDigits: d });
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);

export function countryEs(name: string, flag: string | null): string {
  if (name === "World") return getLang() === "en" ? "World" : "Mundo";
  if (name === "Europe") return getLang() === "en" ? "Europe" : "Europa";
  const code = flag?.match(/\/flags\/([a-z]{2})\.svg/i)?.[1];
  if (code) {
    try {
      return new Intl.DisplayNames([getLang()], { type: "region" }).of(code.toUpperCase()) ?? name;
    } catch { /* noop */ }
  }
  return name;
}
export const leagueType = (type: string) => (type === "Cup" ? (getLang() === "en" ? "Cup" : "Copa") : getLang() === "en" ? "League" : "Liga");
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Traduce errores conocidos de fuentes de datos a un texto comprensible. */
export function friendlyApiError(msg: string): string {
  if (/limit|quota|request/i.test(msg)) return "Se alcanzó el límite de solicitudes de la API. Se reinicia solo; mientras tanto se muestran los datos guardados.";
  return msg;
}
