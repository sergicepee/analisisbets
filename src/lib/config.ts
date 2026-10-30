const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export const BRAND = { name: "PICKZONE", short: "PZ" };
export const TZ = process.env.APP_TIMEZONE || "Europe/Madrid";
export const ESPN_ENABLED = process.env.USE_ESPN !== "false";
export const apiEnabled = ESPN_ENABLED;
export const FORM_MATCHES = clamp(Number(process.env.FORM_MATCHES || 20), 3, 20);
const SUPPORTED_LEAGUE_IDS = [140, 39, 135, 78, 61, 2, 3, 848, 531];
export const LEAGUE_IDS = (process.env.LEAGUE_IDS || "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((id) => SUPPORTED_LEAGUE_IDS.includes(id));
export const PRIORITY_LEAGUES = LEAGUE_IDS.length
  ? LEAGUE_IDS
  : SUPPORTED_LEAGUE_IDS;
export const MAX_ANALYSIS_FIXTURES = Number(process.env.MAX_ANALYSIS_FIXTURES || 12);
export const MIN_LEAGUE_SAMPLE = Number(process.env.MIN_LEAGUE_SAMPLE || 20);

export const SHOW_PREMIUM = process.env.SHOW_PREMIUM_BANNER !== "false";
