// Datos de DEMO (se usan solo si no hay API_FOOTBALL_KEY). Son ficticios y se marcan como tal en la UI.
import type { Fixture, LeagueInfo, StoredStats, TeamProfile, TeamRow, MatchStat } from "./types";
import { TZ } from "./config";

const TEAMS: Record<number, string> = {
  1: "AC Milan", 2: "Bologna", 3: "Parma", 4: "Udinese", 5: "Venezia", 6: "Inter", 7: "Genoa", 8: "Juventus",
  9: "Monza", 10: "Napoli", 11: "Real Madrid", 12: "Barcelona", 13: "Sevilla", 14: "Valencia", 15: "Arsenal",
  16: "Chelsea", 17: "Bayern", 18: "Dortmund", 19: "PSG", 20: "Marseille",
};
const LG = {
  135: { name: "Serie A", country: "Italy", cc: "it" }, 140: { name: "La Liga", country: "Spain", cc: "es" },
  39: { name: "Premier League", country: "England", cc: "gb" }, 78: { name: "Bundesliga", country: "Germany", cc: "de" },
  61: { name: "Ligue 1", country: "France", cc: "fr" },
} as const;
const flag = (cc: string) => `https://media.api-sports.io/flags/${cc}.svg`;

// [local, visitante, liga, hora]
const PLAN: [number, number, keyof typeof LG, number][] = [
  [1, 2, 135, 12], [3, 4, 135, 14], [5, 6, 135, 16], [7, 8, 135, 18], [9, 10, 135, 20],
  [11, 12, 140, 13], [13, 14, 140, 17], [15, 16, 39, 15], [17, 18, 78, 19], [19, 20, 61, 21],
];
const h = (n: number) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return (x ^ (x >>> 16)) >>> 0; };

const dateNum = (d: string) => Number(d.replace(/-/g, ""));
const idOf = (d: string, i: number) => dateNum(d) * 100 + i;
export const dateOfId = (id: number) => { const s = String(Math.floor(id / 100)); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };

function tsFor(date: string, hour: number) {
  // hora local de TZ -> timestamp (aprox. válida para demo)
  const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`).getTime();
  const local = new Date(guess).toLocaleString("en-US", { timeZone: TZ });
  const off = new Date(local).getTime() - guess;
  return Math.floor((guess - off) / 1000);
}

function build(date: string, i: number): Fixture {
  const [hm, aw, lg, hour] = PLAN[i];
  const ts = tsFor(date, hour);
  const nowS = Date.now() / 1000;
  const minsSince = (nowS - ts) / 60;
  const seed = idOf(date, i);
  let statusShort = "NS", statusLong = "Not Started", elapsed: number | null = null;
  let gh: number | null = null, ga: number | null = null, ht: [number, number] | null = null;
  const fh = h(seed) % 4, fa = h(seed + 1) % 3;
  if (minsSince >= 115) { statusShort = "FT"; statusLong = "Match Finished"; elapsed = 90; gh = fh; ga = fa; ht = [Math.min(fh, h(seed + 2) % 2), Math.min(fa, h(seed + 3) % 2)]; }
  else if (minsSince >= 0) {
    const el = minsSince < 47 ? Math.floor(minsSince) : minsSince < 62 ? 45 : Math.min(90, Math.floor(minsSince - 15));
    statusShort = minsSince >= 47 && minsSince < 62 ? "HT" : minsSince < 47 ? "1H" : "2H"; statusLong = "In Play"; elapsed = el;
    gh = Math.floor((fh * el) / 90); ga = Math.floor((fa * el) / 90);
  }
  const events = gh !== null && ga !== null
    ? [...Array(gh).fill(hm), ...Array(ga).fill(aw)].map((teamId, k) => ({
        minute: 8 + ((h(seed + k * 7) % 80)), extra: null, teamId, player: "Gol (demo)", type: "Goal", detail: "Normal Goal",
      })).sort((a, b) => a.minute - b.minute)
    : [];
  return {
    id: seed, timestamp: ts, leagueId: lg, leagueName: LG[lg].name, country: LG[lg].country, flag: flag(LG[lg].cc),
    leagueLogo: null, season: 2026, round: "Temporada regular", venue: "Estadio demo",
    statusShort, statusLong, elapsed,
    home: { id: hm, name: TEAMS[hm], logo: null }, away: { id: aw, name: TEAMS[aw], logo: null },
    goalsHome: gh, goalsAway: ga, htHome: ht ? ht[0] : null, htAway: ht ? ht[1] : null, events,
  };
}
export const mockFixtures = (date: string) => PLAN.map((_, i) => build(date, i));
export const mockFixture = (id: number) => build(dateOfId(id), id % 100);

export function mockLeagues(): LeagueInfo[] {
  return (Object.keys(LG) as unknown as (keyof typeof LG)[]).flatMap((id) => [
    { id: Number(id), name: LG[id].name, type: "League", country: LG[id].country, flag: flag(LG[id].cc), logo: null },
  ]);
}

function stat(seed: number, lo: number, span: number): number { return lo + (h(seed) % (span + 1)); }
export function mockProfile(teamId: number, n: number, withStats: boolean): TeamProfile {
  const rows: TeamRow[] = [];
  for (let i = 0; i < n; i++) {
    const s = teamId * 100 + i;
    const gf = h(s) % 4, ga = h(s + 50) % 3;
    const mk = (k: number): MatchStat => ({ shots: stat(s + k, 7, 9), shotsOn: stat(s + k + 1, 2, 5), corners: stat(s + k + 2, 2, 7), cards: stat(s + k + 3, 0, 4) });
    rows.push({
      fixtureId: s, ts: Date.now() / 1000 - (i + 1) * 7 * 86400, isHome: i % 2 === 0,
      goalsFor: gf, goalsAgainst: ga, htFor: Math.min(gf, h(s + 9) % 2), htAgainst: Math.min(ga, h(s + 10) % 2),
      result: gf > ga ? "W" : gf === ga ? "D" : "L",
      sFor: withStats ? mk(100) : null, sAgainst: withStats ? mk(200) : null,
    });
  }
  return { teamId, rows: rows.reverse() };
}

export function mockTeamSearch(q: string) {
  const n = q.toLowerCase();
  return Object.entries(TEAMS).filter(([, name]) => name.toLowerCase().includes(n))
    .map(([id, name]) => ({ id: Number(id), name, logo: null as string | null, country: "Demo" }));
}
