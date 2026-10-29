import "server-only";
import { cached, cacheGet, cacheSet } from "./cache";
import { API_MIN_INTERVAL_MS, FORM_MATCHES, QUOTA_RESERVE, hasApiKey } from "./config";
import { getTz } from "./prefs";
import { getStored, leagueAvgFromStore, saveStored } from "./statsStore";
import { mockFixture, mockFixtures, mockLeagues, mockProfile, mockTeamSearch } from "./mock";
import type {
  Fixture, LeagueAvg, LeagueInfo, MatchStat, Prediction, StoredStats, TeamProfile, TeamRow,
} from "./types";
import { statusGroup } from "./format";
import { canonicalTeamName, getCsvFixture, getCsvFixturesByDate, isCsvSeasonDate } from "./csvFixtures";
import { getCsvLeagueAverage, getCsvStatsForFixture, getCsvTeamProfile } from "./csvHistory";

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

function teamNameKey(name: string): string {
  return canonicalTeamName(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// API-Football publica las imágenes con esta URL y el ID permanente del equipo.
// Este mapa permite mostrar escudos a los partidos del CSV también en local,
// donde puede no estar configurada la clave para consultar /teams.
const knownTeamIds: Record<string, number> = {
  "alaves": 542, "athletic club": 531, "atletico madrid": 530, "barcelona": 529,
  "celta vigo": 538, "elche": 797, "espanyol": 540, "getafe": 546,
  "levante": 539, "osasuna": 727, "rayo vallecano": 728, "real betis": 543,
  "real madrid": 541, "real sociedad": 548, "sevilla": 536, "valencia": 532,
  "villarreal": 533,
};

function knownTeamLogo(name: string): string | null {
  const id = knownTeamIds[teamNameKey(name)];
  return id ? `https://media.api-sports.io/football/teams/${id}.png` : null;
}

async function addCsvTeamLogos(fixtures: Fixture[]): Promise<Fixture[]> {
  if (!fixtures.length) return fixtures;
  const withKnownLogos = fixtures.map((fixture) => ({
    ...fixture,
    home: { ...fixture.home, logo: fixture.home.logo ?? knownTeamLogo(fixture.home.name) },
    away: { ...fixture.away, logo: fixture.away.logo ?? knownTeamLogo(fixture.away.name) },
  }));
  if (!hasApiKey) return withKnownLogos;
  const { leagueId, season } = fixtures[0];
  try {
    const logos = await cached<Record<string, string>>(`team-logos:${leagueId}:${season}`, 30 * D, async () => {
      let response: any[];
      try {
        response = await call("/teams", { league: leagueId, season });
      } catch (error) {
        if (season < 1901) throw error;
        response = await call("/teams", { league: leagueId, season: season - 1 });
      }
      if (!response.length && season >= 1901) response = await call("/teams", { league: leagueId, season: season - 1 });
      const result: Record<string, string> = {};
      for (const row of response) {
        const name = row.team?.name, logo = row.team?.logo;
        if (name && logo) result[teamNameKey(name)] = logo;
      }
      return result;
    });
    const missingNames = [...new Set(withKnownLogos.flatMap((fixture) => [fixture.home, fixture.away])
      .filter((team) => !team.logo && !logos[teamNameKey(team.name)])
      .map((team) => team.name))];
    // Los ascendidos pueden no estar en la lista de la temporada anterior;
    // resolverlos por nombre evita depender de que el CSV tenga IDs de API.
    const searched = await Promise.all(missingNames.map(async (name) => {
      const key = teamNameKey(name);
      try {
        const result = await cached<{ logo: string | null }>(`team-logo-search:${key}`, 30 * D, async () => {
          const rows = await call("/teams", { search: name });
          const exact = rows.find((row) => teamNameKey(row.team?.name ?? "") === key);
          const match = exact ?? rows.find((row) => teamNameKey(row.team?.name ?? "").includes(key));
          return { logo: match?.team?.logo ?? null };
        });
        return [key, result.logo] as const;
      } catch {
        return [key, null] as const;
      }
    }));
    const allLogos = { ...logos, ...Object.fromEntries(searched.filter(([, logo]) => logo)) };
    return withKnownLogos.map((fixture) => ({
      ...fixture,
      home: { ...fixture.home, logo: allLogos[teamNameKey(fixture.home.name)] ?? fixture.home.logo },
      away: { ...fixture.away, logo: allLogos[teamNameKey(fixture.away.name)] ?? fixture.away.logo },
    }));
  } catch {
    return withKnownLogos;
  }
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
  const localFixtures = await getCsvFixturesByDate(date);
  // La lista diaria también usa el CSV; enriquecerlo con logos aunque no haya
  // clave evita que los escudos solo aparezcan en la vista de detalle.
  if (!hasApiKey) return (await isCsvSeasonDate(date)) ? addCsvTeamLogos(localFixtures) : mockFixtures(date);
  try {
    const apiFixtures = await cached(`fixtures:${date}:${getTz()}`, isToday ? 90 : 15 * 60, async () =>
      (await call("/fixtures", { date, timezone: getTz() }, true)).map(normFixture),
    );
    return [...apiFixtures.filter((fixture) => fixture.leagueId !== 140), ...(await addCsvTeamLogos(localFixtures))];
  } catch (error) {
    if (localFixtures.length) return localFixtures;
    throw error;
  }
}

export async function getFixture(id: number): Promise<Fixture | null> {
  const csvFixture = await getCsvFixture(id);
  if (csvFixture) return (await addCsvTeamLogos([csvFixture]))[0];
  if (!hasApiKey) return mockFixture(id);
  return cached<Fixture | null>(
    `fixture:${id}:${getTz()}`,
    (f) => {
      if (!f) return 60;
      const g = statusGroup(f);
      return g === "finished" ? 30 * D : g === "live" ? 45 : 10 * 60;
    },
    async () => {
      const r = await call("/fixtures", { id, timezone: getTz() }, true);
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
  if (f.id < 0) {
    const historical = await getCsvStatsForFixture(f);
    if (historical) return historical;
    return {
      fixtureId: f.id, leagueId: f.leagueId, season: f.season, homeId: f.home.id, awayId: f.away.id,
      home: { shots: null, shotsOn: null, corners: null, cards: null },
      away: { shots: null, shotsOn: null, corners: null, cards: null },
      goalsHome: f.goalsHome ?? 0, goalsAway: f.goalsAway ?? 0, hasData: false,
    };
  }
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

/** Estadísticas finales de un partido para liquidar mercados históricos. */
export async function getFixtureStatsFor(f: Fixture): Promise<StoredStats> {
  return getFixtureStats(f);
}

const planBlocked = async () => !!(await cacheGet("meta:planblock"));

/** Últimos N partidos terminados. Si el plan no permite `last`, usa la temporada completa y recorta. */
async function fetchLast(teamId: number, season?: number, leagueId?: number): Promise<Fixture[]> {
  if (await planBlocked()) throw new ApiError("Free plans do not have access to this season", "api");
  const league: Record<string, string | number> = leagueId ? { league: leagueId } : {};
  try {
    return (await call("/fixtures", { team: teamId, ...league, last: FORM_MATCHES, timezone: getTz() }, true)).map(normFixture);
  } catch (e) {
    if (!season || !(e instanceof ApiError) || e.kind !== "api") throw e;
    try {
      const all = (await call("/fixtures", { team: teamId, ...league, season, status: "FT-AET-PEN", timezone: getTz() }, true)).map(normFixture);
      return all.sort((a, b) => a.timestamp - b.timestamp).slice(-FORM_MATCHES);
    } catch (e2) {
      // El plan no permite esta temporada: lo recordamos 6 h para no gastar cuota repitiendo la llamada.
      if (e2 instanceof ApiError && /Free plans/i.test(e2.message)) await cacheSet("meta:planblock", true, 6 * H);
      throw e2;
    }
  }
}

// ── Perfil de un equipo: últimos N partidos (+ estadísticas reales opcionales) ──
export async function getTeamProfile(teamId: number, withStats = true, season?: number, beforeTimestamp = Infinity, leagueId?: number): Promise<TeamProfile> {
  if (teamId < 0) return getCsvTeamProfile(teamId, withStats, beforeTimestamp);
  if (!hasApiKey) return mockProfile(teamId, FORM_MATCHES, withStats);
  const cutoffKey = beforeTimestamp < Date.now() / 1000 ? Math.floor(beforeTimestamp / 86400) : "future";
  const key = `profile:${teamId}:${leagueId ?? "all"}:${cutoffKey}:${FORM_MATCHES}:${withStats ? "s" : "g"}`;
  return cached<TeamProfile>(
    key,
    (p) => (p.rows.some((r) => withStats && !r.sFor) ? 10 * 60 : 6 * H),
    async () => {
      const last = await cached<Fixture[]>(`last:${teamId}:${leagueId ?? "all"}:${FORM_MATCHES}:${getTz()}`, 6 * H, () => fetchLast(teamId, season, leagueId));
      const done = last.filter((f) => f.timestamp < beforeTimestamp && ["FT", "AET", "PEN"].includes(f.statusShort) && f.goalsHome !== null && f.goalsAway !== null);
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
  if (fixtureId < 0) return null;
  if (!hasApiKey) return null;
  return cached<Prediction | null>(`pred2:${fixtureId}`, 12 * H, async () => {
    const r = await call("/predictions", { fixture: fixtureId });
    const p = r[0]?.predictions;
    if (!p?.percent) return null;
    const n = (x: string) => parseFloat(String(x).replace("%", ""));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const l5 = (t: any) => {
      const g = t?.last_5?.goals;
      const gf = parseFloat(g?.for?.average), ga = parseFloat(g?.against?.average);
      return Number.isFinite(gf) && Number.isFinite(ga) ? { gf, ga, n: Number(t.last_5.played) || 5 } : null;
    };
    const h = l5(r[0]?.teams?.home), a = l5(r[0]?.teams?.away);
    return { home: n(p.percent.home), draw: n(p.percent.draw), away: n(p.percent.away), advice: p.advice ?? null, last5: h && a ? { home: h, away: a } : null };
  });
}

// ── Media de liga ──
export async function getLeagueAverages(leagueId: number, season: number): Promise<LeagueAvg | null> {
  if (leagueId === 140) return getCsvLeagueAverage();
  if (!hasApiKey) return null;
  const own = await leagueAvgFromStore(leagueId, season);
  // Goles por partido: de la clasificación (muestra grande, 1 llamada/día)
  const goals = (await planBlocked()) ? null : await cached<number | null>(`lgoals:${leagueId}:${season}`, D, async () => {
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
  return cached<Fixture[]>(`last:${teamId}:${FORM_MATCHES}:${getTz()}`, 6 * H, async () =>
    (await call("/fixtures", { team: teamId, last: FORM_MATCHES, timezone: getTz() }, true)).map(normFixture),
  );
}
export async function getNextFixtures(teamId: number, n = 5): Promise<Fixture[]> {
  if (!hasApiKey) return [];
  return cached<Fixture[]>(`next:${teamId}:${n}:${getTz()}`, 3 * H, async () =>
    (await call("/fixtures", { team: teamId, next: n, timezone: getTz() }, true)).map(normFixture),
  );
}
