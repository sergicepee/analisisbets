import "server-only";
import { cached } from "./cache";
import { FORM_MATCHES } from "./config";
import { getTz } from "./prefs";
import type { Fixture, LeagueAvg, LeagueInfo, MatchStat, StoredStats, TeamProfile, TeamRow } from "./types";

type EspnLeague = {
  id: number;
  slug: string;
  name: string;
  type: string;
  country: string;
  flag: string | null;
  timeZone: string;
};

const ESPN_LEAGUES: EspnLeague[] = [
  { id: 140, slug: "esp.1", name: "La Liga", type: "League", country: "Spain", flag: "https://flagcdn.com/es.svg", timeZone: "Europe/Madrid" },
  { id: 39, slug: "eng.1", name: "Premier League", type: "League", country: "England", flag: "https://flagcdn.com/gb-eng.svg", timeZone: "Europe/London" },
  { id: 135, slug: "ita.1", name: "Serie A", type: "League", country: "Italy", flag: "https://flagcdn.com/it.svg", timeZone: "Europe/Rome" },
  { id: 78, slug: "ger.1", name: "Bundesliga", type: "League", country: "Germany", flag: "https://flagcdn.com/de.svg", timeZone: "Europe/Berlin" },
  { id: 61, slug: "fra.1", name: "Ligue 1", type: "League", country: "France", flag: "https://flagcdn.com/fr.svg", timeZone: "Europe/Paris" },
  { id: 2, slug: "uefa.champions", name: "UEFA Champions League", type: "Cup", country: "Europe", flag: "https://flagcdn.com/eu.svg", timeZone: "Europe/Zurich" },
  { id: 3, slug: "uefa.europa", name: "UEFA Europa League", type: "Cup", country: "Europe", flag: "https://flagcdn.com/eu.svg", timeZone: "Europe/Zurich" },
  { id: 848, slug: "uefa.europa.conf", name: "UEFA Conference League", type: "Cup", country: "Europe", flag: "https://flagcdn.com/eu.svg", timeZone: "Europe/Zurich" },
  { id: 531, slug: "uefa.super_cup", name: "UEFA Super Cup", type: "Cup", country: "Europe", flag: "https://flagcdn.com/eu.svg", timeZone: "Europe/Zurich" },
];

type EspnStat = { name?: string; displayValue?: string | number };
type EspnTeam = { id?: string | number; displayName?: string; name?: string; logo?: string; logos?: Array<{ href?: string }> };
type EspnCompetitor = {
  homeAway?: string;
  order?: number;
  score?: string | number;
  winner?: boolean;
  team?: EspnTeam;
  statistics?: EspnStat[];
  linescores?: Array<{ value?: number; displayValue?: string }>;
};
type EspnDetail = {
  type?: { text?: string };
  clock?: { value?: number; displayValue?: string };
  team?: { id?: string | number };
  scoringPlay?: boolean;
  redCard?: boolean;
  yellowCard?: boolean;
  ownGoal?: boolean;
  athletesInvolved?: Array<{ id?: string | number; displayName?: string; headshot?: string }>;
};
type EspnEvent = {
  id?: string | number;
  date?: string;
  season?: { year?: number; type?: number; slug?: string };
  week?: { number?: number };
  competitions?: Array<{
    id?: string | number;
    status?: { clock?: number; period?: number; type?: { name?: string; state?: string; completed?: boolean; description?: string; detail?: string } };
    venue?: { fullName?: string };
    competitors?: EspnCompetitor[];
    details?: EspnDetail[];
  }>;
};
type EspnScoreboard = {
  events: EspnEvent[];
  leagues?: Array<{ name?: string; logos?: Array<{ href?: string; rel?: string[] }> }>;
};
type EspnTeamList = { sports?: Array<{ leagues?: Array<{ teams?: Array<{ team?: EspnTeam }> }> }> };
type EspnSummary = {
  boxscore?: { teams?: Array<{ team?: EspnTeam; statistics?: EspnStat[] }> };
};

const SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const HOUR = 3600;
const DAY = 86400;
const leagueFor = (id: number) => ESPN_LEAGUES.find((league) => league.id === id) ?? null;
const UEFA_LEAGUE_IDS = new Set([2, 3, 848, 531]);
const STAGE_BY_SLUG: Record<string, string> = {
  "league-phase": "league",
  "knockout-round-playoffs": "playoffs",
  "round-of-16": "round-of-16",
  quarterfinals: "quarterfinals",
  semifinals: "semifinals",
  final: "final",
};
const finiteId = (value: string | number | undefined) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const numeric = (value: string | number | undefined): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
};

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`ESPN respondió ${response.status} en ${new URL(url).pathname}`);
  return response.json() as Promise<T>;
}

function scoreboard(league: EspnLeague, year: number, limit = 1000): Promise<EspnScoreboard> {
  const ttl = year === new Date().getFullYear() ? 45 : 7 * DAY;
  return cached(`espn:scoreboard:${league.slug}:${year}:${limit}`, ttl, async () => {
    const url = `${SITE}/${league.slug}/scoreboard?dates=${year}&limit=${limit}`;
    const data = await requestJson<Partial<EspnScoreboard>>(url);
    if (!Array.isArray(data.events)) throw new Error(`ESPN no devolvió eventos para ${league.slug} (${year})`);
    return data as EspnScoreboard;
  });
}

function teamLogo(team: EspnTeam | undefined): string | null {
  return team?.logo ?? team?.logos?.find((logo) => logo.href)?.href ?? null;
}

function statValue(competitor: EspnCompetitor, name: string): number | null {
  return numeric(competitor.statistics?.find((stat) => stat.name === name)?.displayValue);
}

function parseMinute(detail: EspnDetail): { minute: number; extra: number | null } {
  const display = detail.clock?.displayValue ?? "";
  const match = display.match(/(\d+)(?:\+(\d+))?/);
  if (match) return { minute: Number(match[1]), extra: match[2] ? Number(match[2]) : null };
  const seconds = numeric(detail.clock?.value);
  return { minute: seconds === null ? 0 : Math.floor(seconds / 60), extra: null };
}

function normalizeDetail(detail: EspnDetail): Fixture["events"][number] | null {
  const label = detail.type?.text ?? "";
  const type = detail.scoringPlay || label.toLowerCase().includes("goal") ? "Goal" : label.toLowerCase().includes("card") ? "Card" : "";
  const teamId = finiteId(detail.team?.id);
  if (!type || !teamId) return null;
  const athlete = detail.athletesInvolved?.[0];
  const { minute, extra } = parseMinute(detail);
  return {
    minute, extra, teamId,
    player: athlete?.displayName ?? "",
    playerId: finiteId(athlete?.id) ?? undefined,
    playerPhoto: athlete?.headshot ?? null,
    type,
    detail: detail.ownGoal ? "Own Goal" : label || (type === "Goal" ? "Goal" : "Card"),
    ownGoal: detail.ownGoal ?? false,
  };
}

function matchStat(competitor: EspnCompetitor, events: Fixture["events"], teamId: number): MatchStat {
  const eventCards = events.filter((event) =>
    event.teamId === teamId && event.type === "Card" &&
    (event.detail === "Yellow Card" || event.detail === "Red Card" || event.detail === "Second Yellow Card"),
  ).length;
  const hasCardEvents = events.some((event) => event.teamId === teamId && event.type === "Card");
  const yellows = statValue(competitor, "yellowCards"), reds = statValue(competitor, "redCards");
  return {
    shots: statValue(competitor, "totalShots"),
    shotsOn: statValue(competitor, "shotsOnTarget"),
    corners: statValue(competitor, "wonCorners"),
    cards: yellows !== null || reds !== null ? (yellows ?? 0) + (reds ?? 0) : hasCardEvents ? eventCards : null,
  };
}

function normalizeFixture(event: EspnEvent, league: EspnLeague, leagueLogo: string | null): Fixture | null {
  const id = finiteId(event.id);
  const timestamp = event.date ? Date.parse(event.date) : NaN;
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((team) => team.homeAway === "home") ?? competitors.find((team) => team.order === 0);
  const away = competitors.find((team) => team.homeAway === "away") ?? competitors.find((team) => team.order === 1);
  const homeId = finiteId(home?.team?.id);
  const awayId = finiteId(away?.team?.id);
  if (!id || !Number.isFinite(timestamp) || !competition || !home || !away || !homeId || !awayId) return null;

  const status = competition.status;
  const statusType = status?.type;
  const state = statusType?.state;
  const statusText = `${statusType?.name ?? ""} ${statusType?.description ?? ""} ${statusType?.detail ?? ""}`.toLowerCase();
  const events = (competition.details ?? []).flatMap((detail) => {
    const normalized = normalizeDetail(detail);
    return normalized ? [normalized] : [];
  });
  let statusShort = "NS";
  if (statusText.includes("postpon")) statusShort = "PST";
  else if (statusText.includes("cancel")) statusShort = "CANC";
  else if (statusText.includes("suspend")) statusShort = "SUSP";
  else if (state === "post" && statusType?.completed) {
    statusShort = statusText.includes("pen") ? "PEN" : statusText.includes("aet") || statusText.includes("extra time") ? "AET" : "FT";
  } else if (state === "in") {
    statusShort = statusText.includes("half-time") || statusText.includes("halftime") ? "HT"
      : status?.period === 1 ? "1H" : status?.period === 2 ? "2H" : "LIVE";
  }
  const hasStarted = state === "in" || statusType?.completed === true;
  const score = (team: EspnCompetitor) => numeric(team.score);
  const homeScore = hasStarted ? score(home) : null, awayScore = hasStarted ? score(away) : null;
  const firstHalf = (team: EspnCompetitor) => hasStarted
    ? numeric(team.linescores?.[0]?.displayValue ?? team.linescores?.[0]?.value)
    : null;
  const homeStats = matchStat(home, events, homeId);
  const awayStats = matchStat(away, events, awayId);
  const redCards = (teamId: number) => events.filter((event) =>
    event.teamId === teamId && event.type === "Card" &&
    (event.detail === "Red Card" || event.detail === "Second Yellow Card"),
  ).length;
  const season = Number(event.season?.year) || new Date(timestamp).getUTCFullYear();
  const stage = UEFA_LEAGUE_IDS.has(league.id) && event.season?.slug
    ? STAGE_BY_SLUG[event.season.slug] ?? "other"
    : undefined;

  return {
    id, timestamp: Math.floor(timestamp / 1000),
    leagueId: league.id, leagueName: league.name, country: league.country,
    flag: league.flag, leagueLogo, season,
    round: event.week?.number && (!stage || stage === "league") ? `Jornada ${event.week.number}` : "",
    stage,
    venue: competition.venue?.fullName ?? null,
    statusShort, statusLong: statusType?.detail ?? statusType?.description ?? statusType?.name ?? statusShort,
    elapsed: numeric(status?.clock) === null ? null : Math.floor((numeric(status?.clock) ?? 0) / 60),
    home: { id: homeId, name: home.team?.displayName ?? home.team?.name ?? "Local", logo: teamLogo(home.team) },
    away: { id: awayId, name: away.team?.displayName ?? away.team?.name ?? "Visitante", logo: teamLogo(away.team) },
    goalsHome: homeScore, goalsAway: awayScore,
    htHome: firstHalf(home), htAway: firstHalf(away),
    redCardsHome: redCards(homeId), redCardsAway: redCards(awayId),
    homeStats, awayStats, events,
  };
}

function normalizeTeam(team: EspnTeam): { id: number; name: string; logo: string | null } | null {
  const id = finiteId(team.id);
  const name = team.displayName ?? team.name;
  return id && name ? { id, name, logo: teamLogo(team) } : null;
}

export async function getEspnLeagues(): Promise<LeagueInfo[]> {
  const currentYear = new Date().getFullYear();
  return Promise.all(ESPN_LEAGUES.map(async (league) => {
    try {
      const response = await scoreboard(league, currentYear, 1);
      const data = response.leagues?.[0];
      const logo = data?.logos?.find((item) => item.rel?.includes("default"))?.href ?? data?.logos?.[0]?.href ?? null;
      return { id: league.id, name: league.name, type: league.type, country: league.country, flag: league.flag, logo };
    } catch (error) {
      console.error(`No se pudo cargar la competición ESPN ${league.slug}:`, error);
      return { id: league.id, name: league.name, type: league.type, country: league.country, flag: league.flag, logo: null };
    }
  }));
}

export async function getEspnTeams(leagueId: number, season: number): Promise<Array<{ id: number; name: string; logo: string | null }>> {
  const league = leagueFor(leagueId);
  if (!league) throw new Error(`ESPN no tiene configurada la liga ${leagueId}`);
  return cached(`espn:teams:${league.slug}:${season}`, DAY, async () => {
    const data = await requestJson<EspnTeamList>(`${SITE}/${league.slug}/teams?season=${season}`);
    const teams = data.sports?.flatMap((sport) => sport.leagues ?? []).flatMap((item) => item.teams ?? [])
      .flatMap((item) => item.team ? [normalizeTeam(item.team)] : [])
      .filter((team): team is { id: number; name: string; logo: string | null } => team !== null);
    if (!teams?.length) throw new Error(`ESPN no devolvió equipos para ${league.name} (${season})`);
    return teams;
  });
}

export async function getEspnLeagueSeasons(leagueId: number): Promise<number[]> {
  if (!leagueFor(leagueId)) return [];
  const year = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return Array.from({ length: 6 }, (_, index) => year - index);
}

async function getCalendarEvents(league: EspnLeague, year: number): Promise<Fixture[]> {
  const data = await scoreboard(league, year);
  const leagueLogo = data.leagues?.[0]?.logos?.find((item) => item.rel?.includes("default"))?.href
    ?? data.leagues?.[0]?.logos?.[0]?.href
    ?? null;
  return data.events.flatMap((event) => {
    const fixture = normalizeFixture(event, league, leagueLogo);
    return fixture ? [fixture] : [];
  });
}

export async function getEspnLeagueFixtures(leagueId: number, season: number): Promise<Fixture[]> {
  const league = leagueFor(leagueId);
  if (!league) throw new Error(`ESPN no tiene configurada la liga ${leagueId}`);
  const activeSeason = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return cached(`espn:league-fixtures:v2:${league.slug}:${season}`, season === activeSeason ? 45 : 6 * HOUR, async () => {
    const years = await Promise.allSettled([getCalendarEvents(league, season), getCalendarEvents(league, season + 1)]);
    const available = years.flatMap((result) => {
      if (result.status === "fulfilled") return result.value;
      console.error(`No se pudo cargar el calendario ESPN ${league.slug}:`, result.reason);
      return [];
    });
    if (!years.some((result) => result.status === "fulfilled")) throw new Error(`No se pudo cargar el calendario ESPN de ${league.name}`);
    const fixtures = new Map<number, Fixture>();
    for (const fixture of available) {
      if (fixture.season === season) fixtures.set(fixture.id, fixture);
    }
    return [...fixtures.values()].sort((a, b) => a.timestamp - b.timestamp);
  });
}

function localDate(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(timestamp * 1000);
}

export async function getEspnFixturesByDate(date: string): Promise<Fixture[]> {
  const year = Number(date.slice(0, 4));
  const timeZone = getTz();
  const years = new Set([year]);
  if (date.endsWith("-01-01")) years.add(year - 1);
  if (date.endsWith("-12-31")) years.add(year + 1);
  const results = await Promise.allSettled(ESPN_LEAGUES.flatMap((league) =>
    [...years].map((calendarYear) => getCalendarEvents(league, calendarYear)),
  ));
  const fixtures = results.flatMap((result) => {
    if (result.status === "fulfilled") return result.value;
    console.error("No se pudo cargar un calendario ESPN para el día:", result.reason);
    return [];
  });
  if (!results.some((result) => result.status === "fulfilled")) throw new Error("No se pudieron cargar los partidos de ESPN");
  return fixtures.filter((fixture) => localDate(fixture.timestamp, timeZone) === date)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function getEspnFixture(id: number, leagueId?: number, date?: string): Promise<Fixture | null> {
  const year = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? Number(date.slice(0, 4)) : new Date().getFullYear();
  const leagues = leagueId ? [leagueFor(leagueId)].filter((league): league is EspnLeague => league !== null) : ESPN_LEAGUES;
  if (!leagues.length) return null;
  const years = date
    ? [...new Set([year, ...(date.endsWith("-01-01") ? [year - 1] : []), ...(date.endsWith("-12-31") ? [year + 1] : [])])]
    : [year, year - 1];
  for (const calendarYear of years) {
    const results = await Promise.allSettled(leagues.map((league) => getCalendarEvents(league, calendarYear)));
    const fixtures = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const fixture = fixtures.find((item) => item.id === id);
    if (fixture) return fixture;
    if (results.every((result) => result.status === "rejected")) throw new Error("No se pudo consultar el partido en ESPN");
  }
  return null;
}

function statsFromFixture(fixture: Fixture): StoredStats | null {
  const home = fixture.homeStats;
  const away = fixture.awayStats;
  if (!home || !away) return null;
  return {
    fixtureId: fixture.id, leagueId: fixture.leagueId, season: fixture.season,
    homeId: fixture.home.id, awayId: fixture.away.id, home, away,
    goalsHome: fixture.goalsHome ?? 0, goalsAway: fixture.goalsAway ?? 0,
    hasData: [home, away].some((team) => Object.values(team).some((value) => value !== null)),
  };
}

export async function getEspnFixtureStats(fixture: Fixture): Promise<StoredStats | null> {
  const direct = statsFromFixture(fixture);
  if (direct?.hasData || !fixture.statusShort.match(/^(FT|AET|PEN)$/)) return direct;
  const league = leagueFor(fixture.leagueId);
  if (!league) return direct;
  return cached(`espn:fixture-stats:${fixture.id}`, 30 * DAY, async () => {
    const data = await requestJson<EspnSummary>(`${SITE}/${league.slug}/summary?event=${fixture.id}`);
    const teams = data.boxscore?.teams ?? [];
    const getStats = (teamId: number): MatchStat => {
      const stats = teams.find((item) => finiteId(item.team?.id) === teamId)?.statistics ?? [];
      const get = (name: string) => numeric(stats.find((stat) => stat.name === name)?.displayValue);
      const yellow = get("yellowCards"), red = get("redCards");
      return {
        shots: get("totalShots"), shotsOn: get("shotsOnTarget"), corners: get("wonCorners"),
        cards: yellow === null && red === null ? null : (yellow ?? 0) + (red ?? 0),
      };
    };
    const home = getStats(fixture.home.id), away = getStats(fixture.away.id);
    return {
      fixtureId: fixture.id, leagueId: fixture.leagueId, season: fixture.season,
      homeId: fixture.home.id, awayId: fixture.away.id, home, away,
      goalsHome: fixture.goalsHome ?? 0, goalsAway: fixture.goalsAway ?? 0,
      hasData: [home, away].some((team) => Object.values(team).some((value) => value !== null)),
    };
  });
}

function emptyStat(): MatchStat {
  return { shots: null, shotsOn: null, corners: null, cards: null };
}

function toTeamRow(fixture: Fixture, teamId: number, stats: StoredStats | null): TeamRow {
  const isHome = fixture.home.id === teamId;
  const goalsFor = (isHome ? fixture.goalsHome : fixture.goalsAway) ?? 0;
  const goalsAgainst = (isHome ? fixture.goalsAway : fixture.goalsHome) ?? 0;
  return {
    fixtureId: fixture.id, ts: fixture.timestamp, isHome, goalsFor, goalsAgainst,
    htFor: isHome ? fixture.htHome : fixture.htAway,
    htAgainst: isHome ? fixture.htAway : fixture.htHome,
    result: goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L",
    sFor: stats?.hasData ? (isHome ? stats.home : stats.away) : null,
    sAgainst: stats?.hasData ? (isHome ? stats.away : stats.home) : null,
  };
}

export async function getEspnTeamProfile(
  teamId: number,
  withStats: boolean,
  season: number | undefined,
  beforeTimestamp: number,
  leagueId: number | undefined,
  limit = FORM_MATCHES,
): Promise<TeamProfile> {
  if (!leagueId || !leagueFor(leagueId)) return { teamId, rows: [] };
  const selectedSeason = season ?? (new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1);
  return cached(`espn:profile:${leagueId}:${teamId}:${selectedSeason}:${Math.floor(beforeTimestamp / DAY)}:${withStats}:${limit}`, 30 * 60, async () => {
    const seasons = limit > FORM_MATCHES ? [selectedSeason] : [selectedSeason, selectedSeason - 1];
    const allFixtures = (await Promise.all(seasons.map((item) => getEspnLeagueFixtures(leagueId, item)))).flat();
    const fixtures = allFixtures
      .filter((fixture) =>
        fixture.timestamp < beforeTimestamp &&
        ["FT", "AET", "PEN"].includes(fixture.statusShort) &&
        fixture.goalsHome !== null && fixture.goalsAway !== null &&
        (fixture.home.id === teamId || fixture.away.id === teamId),
      ).sort((a, b) => a.timestamp - b.timestamp).slice(-limit);
    const rows = await Promise.all(fixtures.map(async (fixture) => {
      const stats = withStats ? await getEspnFixtureStats(fixture).catch((error: unknown) => {
        console.error(`No se pudieron cargar estadísticas ESPN del partido ${fixture.id}:`, error);
        return null;
      }) : null;
      return toTeamRow(fixture, teamId, stats);
    }));
    return { teamId, rows };
  });
}

export async function getEspnSeasonMatchSeries(teamId: number, leagueId: number, season: number) {
  const fixtures = (await getEspnLeagueFixtures(leagueId, season))
    .filter((fixture) => fixture.statusShort === "FT" || fixture.statusShort === "AET" || fixture.statusShort === "PEN")
    .filter((fixture) => fixture.home.id === teamId || fixture.away.id === teamId);
  return Promise.all(fixtures.map(async (fixture) => {
    const isHome = fixture.home.id === teamId;
    const stats = await getEspnFixtureStats(fixture);
    const own = stats ? (isHome ? stats.home : stats.away) : emptyStat();
    const against = stats ? (isHome ? stats.away : stats.home) : emptyStat();
    return {
      timestamp: fixture.timestamp, isHome,
      opponent: isHome ? fixture.away.name : fixture.home.name,
      own: { goals: isHome ? fixture.goalsHome ?? 0 : fixture.goalsAway ?? 0, ...own },
      against: { goals: isHome ? fixture.goalsAway ?? 0 : fixture.goalsHome ?? 0, ...against },
    };
  }));
}

function fixtureIsFinished(fixture: Fixture) {
  return ["FT", "AET", "PEN"].includes(fixture.statusShort) &&
    fixture.goalsHome !== null && fixture.goalsAway !== null;
}

export async function getEspnLeagueAverage(leagueId: number, season: number): Promise<LeagueAvg | null> {
  const fixtures = (await getEspnLeagueFixtures(leagueId, season)).filter(fixtureIsFinished);
  if (!fixtures.length) return null;
  const mean = (values: Array<number | null>) => {
    const known = values.filter((value): value is number => value !== null);
    return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
  };
  const totalStat = (key: keyof MatchStat) => fixtures.map((fixture) => {
    const home = fixture.homeStats?.[key], away = fixture.awayStats?.[key];
    return home === null || home === undefined || away === null || away === undefined ? null : home + away;
  });
  const count = (predicate: (fixture: Fixture) => boolean) =>
    fixtures.filter(predicate).length * 100 / fixtures.length;
  return {
    n: fixtures.length,
    goals: mean(fixtures.map((fixture) => (fixture.goalsHome ?? 0) + (fixture.goalsAway ?? 0))),
    shots: mean(totalStat("shots")), shotsOn: mean(totalStat("shotsOn")),
    corners: mean(totalStat("corners")), cards: mean(totalStat("cards")),
    over15: count((fixture) => (fixture.goalsHome ?? 0) + (fixture.goalsAway ?? 0) > 1.5),
    over25: count((fixture) => (fixture.goalsHome ?? 0) + (fixture.goalsAway ?? 0) > 2.5),
    btts: count((fixture) => (fixture.goalsHome ?? 0) > 0 && (fixture.goalsAway ?? 0) > 0),
  };
}

export type EspnTopScorer = {
  id: number;
  name: string;
  photo: string | null;
  teamName: string;
  teamLogo: string | null;
  goals: number;
  assists: number;
  appearances: number;
};

export async function getEspnLeagueTopScorers(leagueId: number, season: number): Promise<EspnTopScorer[]> {
  const fixtures = (await getEspnLeagueFixtures(leagueId, season)).filter(fixtureIsFinished);
  const players = new Map<number, EspnTopScorer & { games: Set<number> }>();
  for (const fixture of fixtures) {
    for (const event of fixture.events) {
      if (event.type !== "Goal" || event.ownGoal || !event.playerId || !event.player) continue;
      const team = event.teamId === fixture.home.id ? fixture.home : fixture.away;
      const player = players.get(event.playerId) ?? {
        id: event.playerId, name: event.player, photo: event.playerPhoto ?? null,
        teamName: team.name, teamLogo: team.logo, goals: 0, assists: 0, appearances: 0, games: new Set<number>(),
      };
      player.goals++;
      player.games.add(fixture.id);
      players.set(event.playerId, player);
    }
  }
  return [...players.values()]
    .map(({ games, ...player }) => ({ ...player, appearances: games.size }))
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name))
    .slice(0, 50);
}

export async function searchEspnTeams(query: string, season: number): Promise<Array<{ id: number; name: string; logo: string | null; country: string; leagueId: number }>> {
  const term = query.trim().toLocaleLowerCase();
  if (term.length < 2) return [];
  const teams = await Promise.allSettled(ESPN_LEAGUES.map(async (league) => ({
    league,
    teams: await getEspnTeams(league.id, season),
  })));
  return teams.flatMap((result) => {
    if (result.status === "rejected") {
      console.error("No se pudieron buscar equipos en ESPN:", result.reason);
      return [];
    }
    return result.value.teams
      .filter((team) => team.name.toLocaleLowerCase().includes(term))
      .map((team) => ({ ...team, country: result.value.league.country, leagueId: result.value.league.id }));
  }).slice(0, 30);
}

export async function getEspnTeamFixtures(teamId: number, leagueId: number | undefined, count: number, upcoming: boolean): Promise<Fixture[]> {
  const currentSeason = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  let selectedLeagueId = leagueId;
  if (!selectedLeagueId) {
    for (const season of [currentSeason, currentSeason - 1]) {
      const lookups = await Promise.allSettled(ESPN_LEAGUES.map(async (league) => ({
        id: league.id,
        teams: await getEspnTeams(league.id, season),
      })));
      const failed = lookups.filter((result) => result.status === "rejected");
      failed.forEach((result) => {
        if (result.status === "rejected") console.error("No se pudo localizar un equipo en ESPN:", result.reason);
      });
      const found = lookups.find((result) =>
        result.status === "fulfilled" && result.value.teams.some((team) => team.id === teamId),
      );
      if (found?.status === "fulfilled") {
        selectedLeagueId = found.value.id;
        break;
      }
      if (lookups.every((result) => result.status === "rejected")) throw new Error("No se pudieron consultar los equipos de ESPN");
    }
  }
  if (!selectedLeagueId) return [];
  const seasons = upcoming ? [currentSeason, currentSeason + 1] : [currentSeason, currentSeason - 1];
  const fixtures = (await Promise.all(seasons.map((season) => getEspnLeagueFixtures(selectedLeagueId!, season))))
    .flat()
    .filter((fixture) => fixture.home.id === teamId || fixture.away.id === teamId);
  const now = Date.now() / 1000;
  return fixtures.filter((fixture) => upcoming ? fixture.timestamp >= now : fixtureIsFinished(fixture))
    .sort((a, b) => upcoming ? a.timestamp - b.timestamp : b.timestamp - a.timestamp)
    .slice(0, count);
}

export async function getEspnFixtureByIdFromDate(id: number, leagueId: number, date: string): Promise<Fixture | null> {
  const year = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Number(date.slice(0, 4)) : new Date().getFullYear();
  const league = leagueFor(leagueId);
  if (!league) return null;
  const years = new Set([year]);
  if (date.endsWith("-01-01")) years.add(year - 1);
  if (date.endsWith("-12-31")) years.add(year + 1);
  const events = await Promise.all([...years].map((calendarYear) => getCalendarEvents(league, calendarYear)));
  return events.flat().find((fixture) => fixture.id === id) ?? null;
}

export function getEspnLeagueIds(): number[] {
  return ESPN_LEAGUES.map((league) => league.id);
}

export function getEspnLeagueCountry(leagueId: number): string {
  return leagueFor(leagueId)?.country ?? "";
}
