const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export const BRAND = { name: "PICKZONE", short: "PZ" };
export const TZ = process.env.APP_TIMEZONE || "Europe/Madrid";
export const hasApiKey = !!process.env.API_FOOTBALL_KEY;
export const FORM_MATCHES = clamp(Number(process.env.FORM_MATCHES || 20), 3, 20);
export const LEAGUE_IDS = (process.env.LEAGUE_IDS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter(Boolean);
// Ligas con prioridad en listados y análisis (Champions, Europa, PL, Liga, Serie A, Bundesliga, Ligue 1...)
export const PRIORITY_LEAGUES = LEAGUE_IDS.length
  ? LEAGUE_IDS
  : [2, 3, 39, 140, 135, 78, 61, 88, 94, 141, 40, 136, 79, 62];
export const MAX_ANALYSIS_FIXTURES = Number(process.env.MAX_ANALYSIS_FIXTURES || 12);
export const QUOTA_RESERVE = Number(process.env.QUOTA_RESERVE || 8);
export const MIN_LEAGUE_SAMPLE = Number(process.env.MIN_LEAGUE_SAMPLE || 20);
export const API_MIN_INTERVAL_MS = Number(process.env.API_MIN_INTERVAL_MS || 0);

export const SHOW_PREMIUM = process.env.SHOW_PREMIUM_BANNER !== "false";
