import "server-only";
import { cached, cacheGet, cacheSet } from "./cache";
import { API_MIN_INTERVAL_MS, FORM_MATCHES, QUOTA_RESERVE, apiEnabled } from "./config";
import { getTz } from "./prefs";
import { getStored, leagueAvgFromStore, saveStored } from "./statsStore";
import type {
  Fixture, LeagueAvg, LeagueInfo, MatchStat, Prediction, StoredStats, TeamProfile, TeamRow,
} from "./types";
import { statusGroup } from "./format";
import { canonicalTeamName, csvTeamId, getCsvFixture, getCsvFixturesByDate } from "./csvFixtures";
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
  if (!apiEnabled) throw new ApiError("API-Football está desactivada o falta API_FOOTBALL_KEY", "config");
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
  "villarreal": 533, "malaga": 535, "racing santander": 4665, "deportivo la coruna": 544,
};

function knownTeamLogo(name: string): string | null {
  const id = knownTeamIds[teamNameKey(name)];
  return id ? `https://media.api-sports.io/football/teams/${id}.png` : null;
}

const logoCountrySlugs: Record<string, string> = {
  england: "england", spain: "spain", germany: "germany", italy: "italy", france: "france",
};

const logoNameAliases: Record<string, string> = {
  coventry: "Coventry_City", leeds: "Leeds_United", liverpool: "Liverpool_FC",
  wolves: "Wolverhampton_Wanderers", blackburn: "Blackburn_Rovers", bolton: "Bolton_Wanderers",
  preston: "Preston_North_End", lincoln: "Lincoln_City", norwich: "Norwich_City",
  "west brom": "West_Bromwich_Albion", swansea: "Swansea_City", charlton: "Charlton_Athletic",
  derby: "Derby_County", qpr: "Queens_Park_Rangers", "sheffield utd": "Sheffield_United",
  birmingham: "Birmingham_City", cardiff: "Cardiff_City", wrexham: "Wrexham_AFC",
  "sc paderborn 07": "SC_Paderborn", "1899 hoffenheim": "Hoffenheim", "fc schalke 04": "Schalke_04",
  "fsv mainz 05": "Mainz_05", "1 fc koln": "Cologne", "sc freiburg": "Freiburg", "fc augsburg": "Augsburg",
  "1 fc heidenheim": "FC_Heidenheim", "vfl osnabruck": "Osnabrück", "vfl wolfsburg": "Wolfsburg",
  "1 fc kaiserslautern": "FC_Kaiserslautern", "1 fc nurnberg": "FC_Nürnberg", "fc st pauli": "St_Pauli",
  "ac milan": "Milan", como: "Como_1907", frosinone: "Frosinone_Calcio", "vicenza virtus": "Vicenza",
  sudtirol: "Suditrol", carrarese: "Carrarese_Calcio", mantova: "Mantova_1911",
  avellino: "US_Avellino_1912", cesena: "Cesena_FC", lorient: "Lorient_FC",
  lyon: "Olympique_Lyonnais", "estac troyes": "Troyes", "le mans": "Le_Mans_FC",
  "stade brestois 29": "Brest", "paris saint germain": "Paris_Saint-Germain_(PSG)",
  strasbourg: "RC_Strasbourg_Alsace", lens: "RC_Lens", "le havre": "Le_Havre_AC",
  monaco: "AS_Monaco", metz: "FC_Metz", "saint etienne": "AS_Saint-Étienne",
  dijon: "Dijon_FCO", "red star fc 93": "Red_Star_FC", reims: "Stade_de_Reims",
  guingamp: "EA_Guingamp", sochaux: "FC_Sochaux-Montbéliard", pau: "Pau_FC",
  nancy: "Nancy_Lorraine", rodez: "Rodez_AF", laval: "Stade_Lavallois", grenoble: "Grenoble_Foot_38",
  "real sociedad ii": "Real_Sociedad", "ad ceuta fc": "Ceuta", "granada cf": "Granada",
  leganes: "Leganés", cordoba: "Córdoba", "sporting gijon": "Sporting_Gijón", almeria: "Almería",
  "deportivo la coruna": "Deportivo_La_Coruña", malaga: "Málaga",
  cadiz: "Cádiz_CF", "celta de vigo ii": "Celta", valladolid: "Real_Valladolid",
  burgos: "Burgos_CF", eldense: "CD_Eldense", alaves: "Deportivo_Alavés",
  "athletic club": "Athletic_Club_Bilbao", "celta vigo": "Celta",
};

function logoTeamKey(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function repositoryTeamLogo(name: string, country: string): string | null {
  const countrySlug = logoCountrySlugs[country.toLowerCase()];
  if (!countrySlug) return null;
  // Logos are served from the repository's country/team SVG folders; this does
  // not call the API-Football data endpoints or use its request quota.
  const label = logoNameAliases[logoTeamKey(name)] ?? name.trim().replace(/\s+/g, "_");
  const file = `${label}.svg`;
  return `https://raw.githubusercontent.com/JoseArroyave/football-logos/main/logos/${countrySlug}/${encodeURIComponent(file)}`;
}

async function addCsvTeamLogos(fixtures: Fixture[]): Promise<Fixture[]> {
  if (!fixtures.length) return fixtures;
  return fixtures.map((fixture) => ({
    ...fixture,
    home: { ...fixture.home, logo: fixture.home.logo ?? knownTeamLogo(fixture.home.name) ?? repositoryTeamLogo(fixture.home.name, fixture.country) },
    away: { ...fixture.away, logo: fixture.away.logo ?? knownTeamLogo(fixture.away.name) ?? repositoryTeamLogo(fixture.away.name, fixture.country) },
  }));
}

// In CSV mode, a kickoff time alone is not enough to call a fixture finished.
// Keep it pending until both the result and match statistics are in the CSVs.
async function updateCsvFixtureStates(fixtures: Fixture[]): Promise<Fixture[]> {
  const now = Date.now() / 1000;
  return Promise.all(fixtures.map(async (fixture) => {
    if (fixture.timestamp > now || fixture.statusShort === "SUSP") return fixture;
    const stats = await getCsvStatsForFixture(fixture);
    const hasResult = fixture.goalsHome !== null && fixture.goalsAway !== null;
    if (hasResult && stats?.hasData) {
      return { ...fixture, statusShort: "FT", statusLong: "Match Finished" };
    }
    return { ...fixture, statusShort: "NS", statusLong: "Pendiente de actualizar", elapsed: null };
  }));
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
  if (!apiEnabled) return updateCsvFixtureStates(await addCsvTeamLogos(localFixtures));
  try {
    const apiFixtures = await cached(`fixtures:${date}:${getTz()}`, isToday ? 90 : 15 * 60, async () =>
      (await call("/fixtures", { date, timezone: getTz() }, true)).map(normFixture),
    );
    return [...apiFixtures.filter((fixture) => fixture.leagueId !== 140), ...(await addCsvTeamLogos(localFixtures.filter((fixture) => fixture.leagueId === 140)))];
  } catch (error) {
    if (localFixtures.length) return localFixtures;
    throw error;
  }
}

export async function getFixture(id: number): Promise<Fixture | null> {
  const csvFixture = await getCsvFixture(id);
  if (csvFixture) return (await updateCsvFixtureStates(await addCsvTeamLogos([csvFixture])))[0];
  if (!apiEnabled) return null;
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
export async function getTeamProfile(teamId: number, withStats = true, season?: number, beforeTimestamp = Infinity, leagueId?: number, teamName?: string): Promise<TeamProfile> {
  if (teamId < 0) return getCsvTeamProfile(teamId, withStats, beforeTimestamp, leagueId);
  const localProfile = teamName && leagueId
    ? await getCsvTeamProfile(csvTeamId(teamName), withStats, beforeTimestamp, leagueId)
    : null;
  if (localProfile && localProfile.rows.length >= 3) return { ...localProfile, teamId };
  if (!apiEnabled) return localProfile ? { ...localProfile, teamId } : { teamId, rows: [] };
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
  if (!apiEnabled) return null;
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
  const csvAverage = await getCsvLeagueAverage(leagueId, season);
  if (csvAverage) return csvAverage;
  if (!apiEnabled) return null;
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
  if (!apiEnabled) return [];
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
  if (!apiEnabled) return [];
  return cached<TeamHit[]>(`teams:q:${term.toLowerCase()}`, D, async () =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (await call("/teams", { search: term })).slice(0, 12).map((r: any) => ({
      id: r.team.id, name: r.team.name, logo: r.team.logo ?? null, country: r.team.country ?? "",
    })),
  );
}
export async function getLastFixtures(teamId: number): Promise<Fixture[]> {
  if (!apiEnabled) return [];
  return cached<Fixture[]>(`last:${teamId}:${FORM_MATCHES}:${getTz()}`, 6 * H, async () =>
    (await call("/fixtures", { team: teamId, last: FORM_MATCHES, timezone: getTz() }, true)).map(normFixture),
  );
}
export async function getNextFixtures(teamId: number, n = 5): Promise<Fixture[]> {
  if (!apiEnabled) return [];
  return cached<Fixture[]>(`next:${teamId}:${n}:${getTz()}`, 3 * H, async () =>
    (await call("/fixtures", { team: teamId, next: n, timezone: getTz() }, true)).map(normFixture),
  );
}
