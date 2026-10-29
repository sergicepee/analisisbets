import "server-only";
import { cached, cacheGet, cacheSet } from "./cache";
import { API_MIN_INTERVAL_MS, FORM_MATCHES, QUOTA_RESERVE, TZ, hasApiKey } from "./config";
import { getStored, leagueAvgFromStore, saveStored } from "./statsStore";
import { mockFixture, mockFixtures, mockLeagues, mockProfile, mockTeamSearch } from "./mock";
import type {
  Fixture, LeagueAvg, LeagueInfo, MatchStat, Prediction, StoredStats, TeamProfile, TeamRow,
} from "./types";
import { statusGroup } from "./format";

const BASE = "https://v3.football.api-sports.io";
const H = 3600, D = 86400;

export class ApiError extends Error {
  constructor(msg: string, public kind: "quota" | "rate" | "config" | "api" = "api") { super(msg); }
}

// ── Cuota y throttling ──
export async function getQuota(): Promise<number | null> {
  const q = await cacheGet<{ remaining: number }>("meta:quota", true);
  return q ? q.remaining : null;
}
let chain: Promise<unknown> = Promise.resolve();
let lastCall = 0;
function throttle<T>(fn: () => Promise<T>): Promise<T> {
  if (!API_MIN_INTERVAL_MS) return fn();
  const run = chain.then(async () => {
    const wait = lastCall + API_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(path: string, params: Record<string, string | number>, core = false): Promise<any[]> {
  if (!hasApiKey) throw new ApiError("API_FOOTBALL_KEY no configurada", "config");
  if (!core) {
    const q = await getQuota();
    if (q !== null && q <= QUOTA_RESERVE) throw new ApiError(`Cuota diaria casi agotada (${q} restantes)`, "quota");
  }
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await throttle(() =>
    fetch(url, { headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY as string }, cache: "no-store" }),
  );
  const rem = res.headers.get("x-ratelimit-requests-remaining");
  if (rem !== null) await cacheSet("meta:quota", { remaining: Number(rem), at: Date.now() }, 2 * D);
  if (res.status === 429) throw new ApiError("Límite de solicitudes alcanzado", "rate");
  if (!res.ok) throw new ApiError(`API-Football respondió ${res.status}`);
  const j = await res.json();
  const errs = j.errors;
  if (errs && (Array.isArray(errs) ? errs.length : Object.keys(errs).length)) {
    const text = JSON.stringify(errs);
    throw new ApiError(text, /request|limit|quota/i.test(text) ? "quota" : "api");
  }
  return j.response ?? [];
}

// ── Normalización ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normFixture(r: any): Fixture {
  return {
    id: r.fixture.id, timestamp: r.fixture.timestamp,
    leagueId: r.league.id, leagueName: r.league.name, country: r.league.country,
    flag: r.league.flag ?? null, leagueLogo: r.league.logo ?? null, season: r.league.season, round: r.league.round ?? "",
    venue: r.fixture.venue?.name ?? null,
    statusShort: r.fixture.status.short, statusLong: r.fixture.status.long, elapsed: r.fixture.status.elapsed ?? null,
    home: { id: r.teams.home.id, name: r.teams.home.name, logo: r.teams.home.logo ?? null },
    away: { id: r.teams.away.id, name: r.teams.away.name, logo: r.teams.away.logo ?? null },
    goalsHome: r.goals?.home ?? null, goalsAway: r.goals?.away ?? null,
    htHome: r.score?.halftime?.home ?? null, htAway: r.score?.halftime?.away ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: (r.events ?? []).map((e: any) => ({
      minute: e.time?.elapsed ?? 0, extra: e.time?.extra ?? null, teamId: e.team?.id,
      player: e.player?.name ?? "", type: e.type, detail: e.detail,
    })),
  };
}

// ── Partidos ──
export async function getFixturesByDate(date: string, isToday: boolean): Promise<Fixture[]> {
  if (!hasApiKey) return mockFixtures(date);
  return cached(`fixtures:${date}:${TZ}`, isToday ? 90 : 15 * 60, async () =>
    (await call("/fixtures", { date, timezone: TZ }, true)).map(normFixture),
  );
}

export async function getFixture(id: number): Promise<Fixture | null> {
  if (!hasApiKey) return mockFixture(id);
  return cached<Fixture | null>(
    `fixture:${id}:${TZ}`,
    (f) => {
      if (!f) return 60;
      const g = statusGroup(f);
      return g === "finished" ? 30 * D : g === "live" ? 45 : 10 * 60;
    },
    async () => {
      const r = await call("/fixtures", { id, timezone: TZ }, true);
      return r[0] ? normFixture(r[0]) : null;
    },
  );
}

// ── Estadísticas reales por partido (se guardan para siempre) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseStat(arr: any[] | undefined): MatchStat {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const get = (t: string): number | null => {
    const v = arr?.find((x: any) => x.type === t)?.value;
    if (v === null || v === undefined) return null;
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : null;
  };
  const shots = get("Total Shots");
  const y = get("Yellow Cards"), r = get("Red Cards");
  const cards = y === null && r === null ? (shots !== null ? 0 : null) : (y ?? 0) + (r ?? 0);
  return { shots, shotsOn: get("Shots on Goal"), corners: get("Corner Kicks"), cards };
}

async function getFixtureStats(f: Fixture): Promise<StoredStats> {
  const hit = await getStored(f.id);
  if (hit) return hit;
  const resp = await call("/fixtures/statistics", { fixture: f.id });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const find = (id: number) => resp.find((x: any) => x.team?.id === id)?.statistics;
  const home = parseStat(find(f.home.id)), away = parseStat(find(f.away.id));
  const hasData = resp.length > 0 && (home.shots !== null || home.corners !== null);
  const s: StoredStats = {
    fixtureId: f.id, leagueId: f.leagueId, season: f.season, homeId: f.home.id, awayId: f.away.id,
    home, away, goalsHome: f.goalsHome ?? 0, goalsAway: f.goalsAway ?? 0, hasData,
  };
  await saveStored(s);
  return s;
}

/** Últimos N partidos terminados. Si el plan no permite `last`, usa la temporada completa y recorta. */
async function fetchLast(teamId: number, season?: number): Promise<Fixture[]> {
  try {
    return (await call("/fixtures", { team: teamId, last: FORM_MATCHES, timezone: TZ }, true)).map(normFixture);
  } catch (e) {
    if (!season || !(e instanceof ApiError) || e.kind !== "api") throw e;
    const all = (await call("/fixtures", { team: teamId, season, status: "FT-AET-PEN", timezone: TZ }, true)).map(normFixture);
    return all.sort((a, b) => a.timestamp - b.timestamp).slice(-FORM_MATCHES);
  }
}

// ── Perfil de un equipo: últimos N partidos (+ estadísticas reales opcionales) ──
export async function getTeamProfile(teamId: number, withStats = true, season?: number): Promise<TeamProfile> {
  if (!hasApiKey) return mockProfile(teamId, FORM_MATCHES, withStats);
  const key = `profile:${teamId}:${FORM_MATCHES}:${withStats ? "s" : "g"}`;
  return cached<TeamProfile>(
    key,
    (p) => (p.rows.some((r) => withStats && !r.sFor) ? 10 * 60 : 6 * H),
    async () => {
      const last = await cached<Fixture[]>(`last:${teamId}:${FORM_MATCHES}:${TZ}`, 6 * H, () => fetchLast(teamId, season));
      const done = last.filter((f) => ["FT", "AET", "PEN"].includes(f.statusShort) && f.goalsHome !== null && f.goalsAway !== null);
      const rows: TeamRow[] = await Promise.all(
        done.map(async (f) => {
          const isHome = f.home.id === teamId;
          const gf = (isHome ? f.goalsHome : f.goalsAway) as number;
          const ga = (isHome ? f.goalsAway : f.goalsHome) as number;
          let st: StoredStats | null = null;
          if (withStats) st = await getFixtureStats(f).catch(() => null);
          const ok = st?.hasData;
          return {
            fixtureId: f.id, ts: f.timestamp, isHome, goalsFor: gf, goalsAgainst: ga,
            htFor: isHome ? f.htHome : f.htAway, htAgainst: isHome ? f.htAway : f.htHome,
            result: gf > ga ? "W" : gf === ga ? "D" : "L",
            sFor: ok ? (isHome ? st!.home : st!.away) : null,
            sAgainst: ok ? (isHome ? st!.away : st!.home) : null,
          } as TeamRow;
        }),
      );
      return { teamId, rows: rows.sort((a, b) => a.ts - b.ts) };
    },
  );
}

// ── Predicciones de API-Football (1X2 y consejo) ──
export async function getPrediction(fixtureId: number): Promise<Prediction | null> {
  if (!hasApiKey) return null;
  return cached<Prediction | null>(`pred:${fixtureId}`, 12 * H, async () => {
    const r = await call("/predictions", { fixture: fixtureId });
    const p = r[0]?.predictions;
    if (!p?.percent) return null;
    const n = (s: string) => parseFloat(String(s).replace("%", ""));
    return { home: n(p.percent.home), draw: n(p.percent.draw), away: n(p.percent.away), advice: p.advice ?? null };
  });
}

// ── Media de liga ──
export async function getLeagueAverages(leagueId: number, season: number): Promise<LeagueAvg | null> {
  if (!hasApiKey) return null;
  const own = await leagueAvgFromStore(leagueId, season);
  // Goles por partido: de la clasificación (muestra grande, 1 llamada/día)
  const goals = await cached<number | null>(`lgoals:${leagueId}:${season}`, D, async () => {
    const r = await call("/standings", { league: leagueId, season });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teams: any[] = (r[0]?.league?.standings ?? []).flat();
    const played = teams.reduce((a, t) => a + (t.all?.played ?? 0), 0);
    const gf = teams.reduce((a, t) => a + (t.all?.goals?.for ?? 0), 0);
    return played >= 10 ? gf / (played / 2) : null;
  }).catch(() => null);
  if (!own && goals === null) return null;
  return {
    n: own?.n ?? 0, goals: goals ?? own?.goals ?? null,
    shots: own?.shots ?? null, shotsOn: own?.shotsOn ?? null, corners: own?.corners ?? null, cards: own?.cards ?? null,
    over15: own?.over15 ?? null, over25: own?.over25 ?? null, btts: own?.btts ?? null,
  };
}

// ── Ligas ──
export async function getLeagues(): Promise<LeagueInfo[]> {
  if (!hasApiKey) return mockLeagues();
  return cached<LeagueInfo[]>("leagues:current", D, async () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await call("/leagues", { current: "true" }, true)).map((r: any) => ({
      id: r.league.id, name: r.league.name, type: r.league.type, logo: r.league.logo ?? null,
      country: r.country?.name ?? "World", flag: r.country?.flag ?? null,
    })),
  );
}

// ── Equipos: búsqueda y partidos ──
export interface TeamHit { id: number; name: string; logo: string | null; country: string }
export async function searchTeams(q: string): Promise<TeamHit[]> {
  const term = q.trim();
  if (term.length < 3) return [];
  if (!hasApiKey) return mockTeamSearch(term);
  return cached<TeamHit[]>(`teams:q:${term.toLowerCase()}`, D, async () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await call("/teams", { search: term })).slice(0, 12).map((r: any) => ({
      id: r.team.id, name: r.team.name, logo: r.team.logo ?? null, country: r.team.country ?? "",
    })),
  );
}
export async function getLastFixtures(teamId: number): Promise<Fixture[]> {
  if (!hasApiKey) return [];
  return cached<Fixture[]>(`last:${teamId}:${FORM_MATCHES}:${TZ}`, 6 * H, async () =>
    (await call("/fixtures", { team: teamId, last: FORM_MATCHES, timezone: TZ }, true)).map(normFixture),
  );
}
export async function getNextFixtures(teamId: number, n = 5): Promise<Fixture[]> {
  if (!hasApiKey) return [];
  return cached<Fixture[]>(`next:${teamId}:${n}:${TZ}`, 3 * H, async () =>
    (await call("/fixtures", { team: teamId, next: n, timezone: TZ }, true)).map(normFixture),
  );
}
