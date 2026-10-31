import "server-only";
import { cached } from "./cache";
import { FORM_MATCHES } from "./config";
import { statusGroup } from "./format";
import { getTz } from "./prefs";
import type { Fixture, FixtureLineup, FixtureLineupEvent, FixtureLineupPlayer, LeagueAvg, LeagueInfo, MatchPeriodStats, MatchStat, StoredStats, TeamProfile, TeamRow } from "./types";

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

type EspnStat = { name?: string; displayValue?: string | number; value?: string | number };
type EspnTeam = { id?: string | number; displayName?: string; name?: string; logo?: string; logos?: Array<{ href?: string }>; color?: string; alternateColor?: string };
type EspnCompetitor = {
  homeAway?: string;
  order?: number;
  score?: string | number | { value?: string | number; displayValue?: string };
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
type EspnKeyEvent = {
  type?: { text?: string };
  clock?: { value?: number; displayValue?: string };
  period?: { number?: number };
  team?: { id?: string | number; displayName?: string };
  scoringPlay?: boolean;
  ownGoal?: boolean;
  shootout?: boolean;
  participants?: Array<{ athlete?: { id?: string | number; displayName?: string } }>;
};
type EspnEvent = {
  id?: string | number;
  date?: string;
  season?: { year?: number; type?: number; slug?: string };
  week?: { number?: number };
  competitions?: Array<{
    id?: string | number;
    status?: { clock?: number; period?: number; type?: { name?: string; state?: string; completed?: boolean; description?: string; detail?: string; shortDetail?: string } };
    venue?: { fullName?: string };
    competitors?: EspnCompetitor[];
    details?: EspnDetail[];
  }>;
};
type EspnScoreboard = {
  events: EspnEvent[];
  leagues?: Array<{ name?: string; logos?: Array<{ href?: string; rel?: string[] }> }>;
};
type EspnTeamSchedule = { events?: EspnEvent[] };
type EspnRosterEntry = {
  starter?: boolean;
  jersey?: string | number | null;
  athlete?: {
    id?: string | number;
    displayName?: string;
    fullName?: string;
    jersey?: string | number | null;
    headshot?: string | { href?: string };
  };
  position?: { name?: string; displayName?: string; abbreviation?: string };
};
type EspnTeamList = { sports?: Array<{ leagues?: Array<{ teams?: Array<{ team?: EspnTeam }> }> }> };
type EspnSummary = {
  header?: { competitions?: Array<{ competitors?: EspnCompetitor[] }> };
  boxscore?: { teams?: Array<{ team?: EspnTeam; statistics?: EspnStat[] }> };
  keyEvents?: EspnKeyEvent[];
  commentary?: Array<{ play?: EspnKeyEvent }>;
  rosters?: Array<{
    homeAway?: string;
    team?: EspnTeam;
    formation?: string;
    roster?: EspnRosterEntry[];
  }>;
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

// Consulta ligera de un solo día (YYYYMMDD) para no descargar temporadas enteras.
function scoreboardDay(league: EspnLeague, day: string): Promise<EspnScoreboard> {
  const dayMs = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)));
  const recent = Math.abs(Date.now() - dayMs) < 3 * DAY * 1000;
  return cached(`espn:scoreboard-day:${league.slug}:${day}`, recent ? 45 : 6 * HOUR, async () => {
    const data = await requestJson<Partial<EspnScoreboard>>(`${SITE}/${league.slug}/scoreboard?dates=${day}&limit=100`);
    if (!Array.isArray(data.events)) throw new Error(`ESPN no devolvió eventos para ${league.slug} (${day})`);
    return data as EspnScoreboard;
  });
}

function shiftDay(date: string, offset: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function teamLogo(team: EspnTeam | undefined): string | null {
  return team?.logo ?? team?.logos?.find((logo) => logo.href)?.href ?? null;
}

function statValue(competitor: EspnCompetitor, name: string): number | null {
  const stat = competitor.statistics?.find((item) => item.name === name);
  return numeric(stat?.displayValue ?? stat?.value);
}

function statDetails(statistics: EspnStat[] | undefined): Record<string, number> | undefined {
  const details = Object.fromEntries((statistics ?? []).flatMap((stat) => {
    if (!stat.name) return [];
    const value = numeric(stat.displayValue ?? stat.value);
    return value === null ? [] : [[stat.name, value] as const];
  }));
  return Object.keys(details).length ? details : undefined;
}

function parseMinute(detail: { clock?: { value?: number; displayValue?: string } }): { minute: number; extra: number | null } {
  const display = detail.clock?.displayValue ?? "";
  const match = display.match(/(\d+)(?:['′]?\s*\+\s*(\d+))?/);
  if (match) return { minute: Number(match[1]), extra: match[2] ? Number(match[2]) : null };
  const seconds = numeric(detail.clock?.value);
  return { minute: seconds === null ? 0 : Math.floor(seconds / 60), extra: null };
}

function normalizeDetail(detail: EspnDetail): Fixture["events"][number] | null {
  const label = detail.type?.text ?? "";
  const lowerLabel = label.toLowerCase();
  const isCard = detail.redCard || detail.yellowCard || lowerLabel.includes("card");
  const isSubstitution = lowerLabel.includes("substitution");
  const isVar = lowerLabel.includes("var");
  const type = detail.scoringPlay || lowerLabel.includes("goal") ? "Goal"
    : isCard ? "Card"
      : isSubstitution ? "Substitution"
        : isVar ? "VAR" : "";
  const teamId = finiteId(detail.team?.id);
  if (!type || !teamId) return null;
  const athletes = detail.athletesInvolved ?? [];
  const athlete = athletes[0];
  const { minute, extra } = parseMinute(detail);
  return {
    minute, extra, teamId,
    player: athlete?.displayName ?? "",
    secondaryPlayer: athletes[1]?.displayName,
    playerId: finiteId(athlete?.id) ?? undefined,
    playerPhoto: athlete?.headshot ?? null,
    type,
    detail: detail.ownGoal ? "Own Goal" : label || (type === "Goal" ? "Goal" : "Card"),
    ownGoal: detail.ownGoal ?? false,
    yellowCard: Boolean(detail.yellowCard) || label.toLowerCase().includes("yellow"),
    redCard: Boolean(detail.redCard) || label.toLowerCase().includes("red"),
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
    yellowCards: yellows,
    redCards: reds,
    details: statDetails(competitor.statistics),
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
  const elapsedSeconds = numeric(status?.clock);
  const elapsedDisplay = statusType?.detail ?? statusType?.shortDetail ?? null;
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
  const score = (team: EspnCompetitor) => {
    const value = team.score;
    return typeof value === "object" && value !== null
      ? numeric(value.displayValue ?? value.value)
      : numeric(value);
  };
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
    elapsed: elapsedSeconds === null ? null : Math.floor(elapsedSeconds / 60),
    elapsedSeconds,
    elapsedDisplay,
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

export function getEspnLeagueInfo(leagueId: number): LeagueInfo | null {
  const league = leagueFor(leagueId);
  return league
    ? { id: league.id, name: league.name, type: league.type, country: league.country, flag: league.flag, logo: null }
    : null;
}

export function getEspnLeagueInfos(): LeagueInfo[] {
  return ESPN_LEAGUES.map((league) => ({
    id: league.id, name: league.name, type: league.type, country: league.country, flag: league.flag, logo: null,
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
  return fixturesFromEvents(data.events, league, leagueLogo);
}

function fixturesFromEvents(events: EspnEvent[], league: EspnLeague, leagueLogo: string | null): Fixture[] {
  return events.flatMap((event) => {
    const fixture = normalizeFixture(event, league, leagueLogo);
    return fixture ? [fixture] : [];
  });
}

async function getEspnTeamSchedule(league: EspnLeague, teamId: number, season: number): Promise<Fixture[]> {
  const ttl = season === new Date().getFullYear() ? 45 : 6 * HOUR;
  return cached(`espn:team-schedule:v3:${league.slug}:${teamId}:${season}`, ttl, async () => {
    const data = await requestJson<EspnTeamSchedule>(
      `${SITE}/${league.slug}/teams/${teamId}/schedule?season=${season}`,
    );
    if (!Array.isArray(data.events)) {
      throw new Error(`ESPN no devolvió el calendario del equipo ${teamId} (${league.slug}, ${season})`);
    }
    return fixturesFromEvents(data.events, league, null);
  });
}

export async function getEspnLeagueFixtures(leagueId: number, season: number): Promise<Fixture[]> {
  const league = leagueFor(leagueId);
  if (!league) throw new Error(`ESPN no tiene configurada la liga ${leagueId}`);
  const activeSeason = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return cached(`espn:league-fixtures:v3:${league.slug}:${season}`, season === activeSeason ? 45 : 6 * HOUR, async () => {
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
  const timeZone = getTz();
  const days = [shiftDay(date, -1), shiftDay(date, 0), shiftDay(date, 1)];
  const results = await Promise.allSettled(ESPN_LEAGUES.flatMap((league) =>
    days.map(async (day) => {
      const data = await scoreboardDay(league, day);
      const leagueLogo = data.leagues?.[0]?.logos?.find((item) => item.rel?.includes("default"))?.href
        ?? data.leagues?.[0]?.logos?.[0]?.href ?? null;
      return data.events.flatMap((event) => {
        const fixture = normalizeFixture(event, league, leagueLogo);
        return fixture ? [fixture] : [];
      });
    }),
  ));
  const fixtures = results.flatMap((result) => {
    if (result.status === "fulfilled") return result.value;
    console.error("No se pudo cargar un calendario ESPN para el día:", result.reason);
    return [];
  });
  if (!results.some((result) => result.status === "fulfilled")) throw new Error("No se pudieron cargar los partidos de ESPN");
  const unique = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  return [...unique.values()].filter((fixture) => localDate(fixture.timestamp, timeZone) === date)
    .sort((a, b) => a.timestamp - b.timestamp);
}

export async function getEspnFixture(id: number, leagueId?: number, date?: string): Promise<Fixture | null> {
  const leagues = leagueId ? [leagueFor(leagueId)].filter((league): league is EspnLeague => league !== null) : ESPN_LEAGUES;
  if (!leagues.length) return null;
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const year = validDate ? Number(date.slice(0, 4)) : new Date().getFullYear();
  if (validDate) {
    const days = [-1, 0, 1].map((offset) => shiftDay(date, offset));
    const results = await Promise.allSettled(leagues.flatMap((league) =>
      days.map(async (day) => {
        const data = await scoreboardDay(league, day);
        const logo = data.leagues?.[0]?.logos?.find((item) => item.rel?.includes("default"))?.href
          ?? data.leagues?.[0]?.logos?.[0]?.href
          ?? null;
        return fixturesFromEvents(data.events, league, logo);
      }),
    ));
    const fixtures = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const fixture = fixtures.find((item) => item.id === id);
    if (fixture) return fixture;
    if (results.every((result) => result.status === "rejected")) {
      throw new Error("No se pudo consultar el partido en ESPN");
    }
  }
  const years = validDate
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

function hasMatchStatData(team: MatchStat): boolean {
  return [team.shots, team.shotsOn, team.corners, team.cards, team.yellowCards, team.redCards]
    .some((value) => typeof value === "number")
    || Object.values(team.details ?? {}).some((value) => typeof value === "number");
}

function statsFromFixture(fixture: Fixture): StoredStats | null {
  const home = fixture.homeStats;
  const away = fixture.awayStats;
  if (!home || !away) return null;
  return {
    fixtureId: fixture.id, leagueId: fixture.leagueId, season: fixture.season,
    homeId: fixture.home.id, awayId: fixture.away.id, home, away,
    goalsHome: fixture.goalsHome ?? 0, goalsAway: fixture.goalsAway ?? 0,
    hasData: [home, away].some(hasMatchStatData),
  };
}

function periodStatsFromSummary(data: EspnSummary, fixture: Fixture) {
  const plays = (data.commentary ?? []).flatMap((item) => item.play ? [item.play] : []);
  const playSide = (play: EspnKeyEvent): "home" | "away" | null => {
    const teamId = finiteId(play.team?.id);
    if (teamId === fixture.home.id) return "home";
    if (teamId === fixture.away.id) return "away";
    const name = play.team?.displayName?.trim().toLocaleLowerCase();
    if (name && name === fixture.home.name.trim().toLocaleLowerCase()) return "home";
    if (name && name === fixture.away.name.trim().toLocaleLowerCase()) return "away";
    return null;
  };
  const teams = new Set(plays.map(playSide).filter((side): side is "home" | "away" => side !== null));
  if (!plays.length || !teams.has("home") || !teams.has("away")) return null;
  const createHalves = () => ({
    first: { shots: 0, shotsOn: 0, corners: 0, cards: 0, yellowCards: 0, redCards: 0 },
    second: { shots: 0, shotsOn: 0, corners: 0, cards: 0, yellowCards: 0, redCards: 0 },
  });
  const result: Record<"home" | "away", { first: MatchPeriodStats; second: MatchPeriodStats }> = {
    home: createHalves(),
    away: createHalves(),
  };
  for (const play of plays) {
    const period = play.period?.number;
    if (!period || period > 4 || play.shootout) continue;
    const side = playSide(play);
    if (!side) continue;
    const half = period === 1 ? result[side].first : result[side].second;
    const type = play.type?.text?.toLowerCase() ?? "";
    const isGoal = play.scoringPlay === true || type.startsWith("goal");
    if (type.startsWith("shot") || isGoal) {
      half.shots = (half.shots ?? 0) + 1;
      if (type === "shot on target" || type === "shot hit woodwork" || isGoal) half.shotsOn = (half.shotsOn ?? 0) + 1;
    }
    if (type === "corner" || type === "corner awarded") {
      half.corners = (half.corners ?? 0) + 1;
    }
    const isYellow = type.includes("yellow card");
    const isRed = type.includes("red card") || type === "second yellow card";
    if (isYellow || isRed) {
      half.cards = (half.cards ?? 0) + 1;
      if (isYellow) half.yellowCards = (half.yellowCards ?? 0) + 1;
      if (isRed) half.redCards = (half.redCards ?? 0) + 1;
    }
  }
  return result;
}

export async function getEspnFixtureStats(fixture: Fixture): Promise<StoredStats | null> {
  const direct = statsFromFixture(fixture);
  const live = statusGroup(fixture) === "live";
  if (!live && statusGroup(fixture) !== "finished") return direct;
  const league = leagueFor(fixture.leagueId);
  if (!league) return direct;
  try {
    const summary = await cached(`espn:fixture-stats:v4:${fixture.id}`, live ? 30 : 30 * DAY, async () => {
      const data = await requestJson<EspnSummary>(`${SITE}/${league.slug}/summary?event=${fixture.id}`);
      const teams = data.boxscore?.teams ?? [];
      const halves = periodStatsFromSummary(data, fixture);
      const getStats = (teamId: number): MatchStat => {
        const stats = teams.find((item) => finiteId(item.team?.id) === teamId)?.statistics ?? [];
        const get = (name: string) => {
          const stat = stats.find((item) => item.name === name);
          return numeric(stat?.displayValue ?? stat?.value);
        };
        const yellow = get("yellowCards"), red = get("redCards");
        return {
          shots: get("totalShots"), shotsOn: get("shotsOnTarget"), corners: get("wonCorners"),
          cards: yellow === null && red === null ? null : (yellow ?? 0) + (red ?? 0),
          yellowCards: yellow, redCards: red,
          details: statDetails(stats),
          halves: halves?.[teamId === fixture.home.id ? "home" : "away"],
        };
      };
      const home = getStats(fixture.home.id), away = getStats(fixture.away.id);
      return {
        fixtureId: fixture.id, leagueId: fixture.leagueId, season: fixture.season,
        homeId: fixture.home.id, awayId: fixture.away.id, home, away,
        goalsHome: fixture.goalsHome ?? 0, goalsAway: fixture.goalsAway ?? 0,
        hasData: [home, away].some(hasMatchStatData),
      };
    });
    const merge = (primary: MatchStat, fallback: MatchStat): MatchStat => ({
      shots: primary.shots ?? fallback.shots,
      shotsOn: primary.shotsOn ?? fallback.shotsOn,
      corners: primary.corners ?? fallback.corners,
      cards: primary.cards ?? fallback.cards,
      yellowCards: primary.yellowCards ?? fallback.yellowCards,
      redCards: primary.redCards ?? fallback.redCards,
      details: { ...fallback.details, ...primary.details },
      halves: primary.halves ?? fallback.halves,
    });
    const home = direct ? merge(direct.home, summary.home) : summary.home;
    const away = direct ? merge(direct.away, summary.away) : summary.away;
    return {
      ...(direct ?? summary), home, away,
      hasData: [home, away].some(hasMatchStatData),
    };
  } catch (error) {
    if (!direct?.hasData) throw error;
    console.error(`No se pudieron completar estadísticas ESPN del partido ${fixture.id}:`, error);
    return direct;
  }
}

export async function getEspnFixtureLineups(fixture: Fixture): Promise<FixtureLineup[]> {
  if (fixture.id < 0) return [];
  const league = leagueFor(fixture.leagueId);
  if (!league) return [];
  const now = Date.now() / 1000;
  const finished = fixture.statusShort.match(/^(FT|AET|PEN)$/) !== null;
  const untilKickoff = fixture.timestamp - now;
  return cached(`espn:fixture-lineups:v12:${fixture.id}`, (lineups) => {
    if (finished) return 30 * DAY;
    if (lineups.some((lineup) => lineup.starters.length > 0)) return 5 * 60;
    return untilKickoff <= HOUR ? 45 : untilKickoff <= DAY ? 5 * 60 : 30 * 60;
  }, async () => {
    const data = await requestJson<EspnSummary>(`${SITE}/${league.slug}/summary?event=${fixture.id}`);
    const playerEvents = new Map<number, FixtureLineupEvent[]>();
    const ownGoalKeys = new Set(fixture.events
      .filter((event) => event.ownGoal && event.playerId)
      .map((event) => `${event.playerId}:${event.minute}:${event.extra ?? ""}`));
    const addPlayerEvent = (athleteId: string | number | undefined, type: FixtureLineupEvent["type"], minute: number, extra: number | null, ownGoal = false) => {
      const id = finiteId(athleteId);
      if (!id) return;
      const events = playerEvents.get(id) ?? [];
      events.push({ type, minute, extra, ...(ownGoal ? { ownGoal: true } : {}) });
      playerEvents.set(id, events);
    };
    for (const event of data.keyEvents ?? []) {
      const label = event.type?.text?.toLowerCase() ?? "";
      const participants = event.participants ?? [];
      const { minute, extra } = parseMinute(event);
      if (label.includes("red card") || label.includes("second yellow")) {
        addPlayerEvent(participants[0]?.athlete?.id, "redCard", minute, extra);
      } else if (label.includes("yellow card")) {
        addPlayerEvent(participants[0]?.athlete?.id, "yellowCard", minute, extra);
      } else if (label === "substitution") {
        addPlayerEvent(participants[0]?.athlete?.id, "substitutionIn", minute, extra);
        addPlayerEvent(participants[1]?.athlete?.id, "substitutionOut", minute, extra);
      } else if (event.scoringPlay || label.includes("goal")) {
        const scorerId = participants[0]?.athlete?.id;
        const ownGoal = event.ownGoal === true || label.includes("own goal")
          || ownGoalKeys.has(`${finiteId(scorerId)}:${minute}:${extra ?? ""}`);
        addPlayerEvent(scorerId, "goal", minute, extra, ownGoal);
        if (!ownGoal) addPlayerEvent(participants[1]?.athlete?.id, "assist", minute, extra);
      }
    }
    return (data.rosters ?? []).flatMap((roster) => {
      const rosterTeamId = finiteId(roster.team?.id);
      const matchTeam = rosterTeamId === fixture.home.id || roster.homeAway === "home"
        ? fixture.home
        : rosterTeamId === fixture.away.id || roster.homeAway === "away"
          ? fixture.away
          : null;
      if (!matchTeam) return [];
      const players = (roster.roster ?? []).flatMap((entry): Array<{ starter: boolean; player: FixtureLineupPlayer }> => {
        const name = entry.athlete?.displayName ?? entry.athlete?.fullName;
        if (!name) return [];
        const headshot = entry.athlete?.headshot;
        const playerId = finiteId(entry.athlete?.id);
        const jersey = entry.jersey ?? entry.athlete?.jersey;
        return [{
          starter: entry.starter === true,
          player: {
            id: playerId,
            name,
            photo: typeof headshot === "string" ? headshot : headshot?.href ?? null,
            jersey: jersey == null ? null : String(jersey),
            position: entry.position?.displayName ?? entry.position?.name ?? entry.position?.abbreviation ?? "",
            matchEvents: playerId ? playerEvents.get(playerId) ?? [] : [],
          },
        }];
      });
      return [{
        teamId: matchTeam.id,
        teamName: matchTeam.name,
        teamLogo: teamLogo(roster.team) ?? matchTeam.logo,
        teamColor: roster.team?.color ?? null,
        teamAlternateColor: roster.team?.alternateColor ?? null,
        formation: roster.formation ?? null,
        starters: players.filter((item) => item.starter).map((item) => item.player),
        substitutes: players.filter((item) => !item.starter).map((item) => item.player),
      }];
    });
  });
}

function emptyStat(): MatchStat {
  return {
    shots: null, shotsOn: null, corners: null, cards: null,
    yellowCards: null, redCards: null,
  };
}

function toTeamRow(fixture: Fixture, teamId: number, stats: StoredStats | null): TeamRow {
  const isHome = fixture.home.id === teamId;
  const goalsFor = (isHome ? fixture.goalsHome : fixture.goalsAway) ?? 0;
  const goalsAgainst = (isHome ? fixture.goalsAway : fixture.goalsHome) ?? 0;
  const homeStats = stats?.hasData ? stats.home : null;
  const awayStats = stats?.hasData ? stats.away : null;
  return {
    fixtureId: fixture.id, ts: fixture.timestamp, isHome, goalsFor, goalsAgainst,
    htFor: isHome ? fixture.htHome : fixture.htAway,
    htAgainst: isHome ? fixture.htAway : fixture.htHome,
    result: goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L",
    sFor: homeStats ? (isHome ? homeStats : awayStats) : null,
    sAgainst: homeStats ? (isHome ? awayStats : homeStats) : null,
  };
}

async function getEspnFixtureHalfTime(fixture: Fixture): Promise<{ htHome: number | null; htAway: number | null }> {
  if (fixture.htHome !== null && fixture.htAway !== null) {
    return { htHome: fixture.htHome, htAway: fixture.htAway };
  }
  const league = leagueFor(fixture.leagueId);
  if (!league) return { htHome: fixture.htHome, htAway: fixture.htAway };
  return cached(`espn:fixture-halftime:v1:${fixture.id}`, 30 * DAY, async () => {
    const data = await requestJson<EspnSummary>(`${SITE}/${league.slug}/summary?event=${fixture.id}`);
    const competitors = data.header?.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((team) => finiteId(team.team?.id) === fixture.home.id);
    const away = competitors.find((team) => finiteId(team.team?.id) === fixture.away.id);
    return {
      htHome: numeric(home?.linescores?.[0]?.displayValue ?? home?.linescores?.[0]?.value),
      htAway: numeric(away?.linescores?.[0]?.displayValue ?? away?.linescores?.[0]?.value),
    };
  });
}

export async function getEspnTeamProfile(
  teamId: number,
  withStats: boolean,
  season: number | undefined,
  beforeTimestamp: number,
  leagueId: number | undefined,
  limit = FORM_MATCHES,
  venue?: "home" | "away",
  withHalfTime = false,
): Promise<TeamProfile> {
  const league = leagueId ? leagueFor(leagueId) : null;
  if (!league) return { teamId, rows: [] };
  const selectedSeason = season ?? (new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1);
  return cached(`espn:profile:v8:${leagueId}:${teamId}:${selectedSeason}:${Math.floor(beforeTimestamp / DAY)}:${withStats}:${limit}:${venue ?? "all"}:${withHalfTime}`, 30 * 60, async () => {
    const seasons = limit > FORM_MATCHES ? [selectedSeason] : [selectedSeason, selectedSeason - 1];
    const scheduleResults = await Promise.allSettled(seasons.map((item) =>
      getEspnTeamSchedule(league, teamId, item),
    ));
    const allFixtures = scheduleResults.flatMap((result) => {
      if (result.status === "fulfilled") return result.value;
      console.error(`No se pudo cargar el calendario ESPN del equipo ${teamId}:`, result.reason);
      return [];
    });
    if (!scheduleResults.some((result) => result.status === "fulfilled")) {
      throw new Error(`No se pudo cargar el calendario ESPN del equipo ${teamId}`);
    }
    const fixtures = allFixtures
      .filter((fixture) =>
        fixture.timestamp < beforeTimestamp &&
        ["FT", "AET", "PEN"].includes(fixture.statusShort) &&
        fixture.goalsHome !== null && fixture.goalsAway !== null &&
        (venue === "home" ? fixture.home.id === teamId : venue === "away" ? fixture.away.id === teamId : fixture.home.id === teamId || fixture.away.id === teamId),
      ).sort((a, b) => a.timestamp - b.timestamp).slice(-limit);
    const rows = await Promise.all(fixtures.map(async (fixture) => {
      const [stats, halftime] = await Promise.all([
        withStats ? getEspnFixtureStats(fixture).catch((error: unknown) => {
          console.error(`No se pudieron cargar estadísticas ESPN del partido ${fixture.id}:`, error);
          return null;
        }) : Promise.resolve(null),
        withHalfTime
          ? getEspnFixtureHalfTime(fixture).catch((error: unknown) => {
            console.error(`No se pudieron cargar los goles al descanso ESPN del partido ${fixture.id}:`, error);
            return { htHome: fixture.htHome, htAway: fixture.htAway };
          })
          : Promise.resolve({ htHome: fixture.htHome, htAway: fixture.htAway }),
      ]);
      return toTeamRow({ ...fixture, ...halftime }, teamId, stats);
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
  const totalStat = (key: Exclude<keyof MatchStat, "details" | "halves">) => fixtures.map((fixture) => {
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

export type EspnCardLeader = {
  id: number;
  name: string;
  teamId: number;
  yellowCards: number;
  redCards: number;
};

export async function getEspnLeagueCardLeaders(leagueId: number, season: number): Promise<EspnCardLeader[]> {
  const fixtures = (await getEspnLeagueFixtures(leagueId, season)).filter(fixtureIsFinished);
  const players = new Map<string, EspnCardLeader>();
  for (const fixture of fixtures) {
    for (const event of fixture.events) {
      if (event.type !== "Card" || !event.playerId || !event.player) continue;
      if (!["Yellow Card", "Red Card", "Second Yellow Card"].includes(event.detail)) continue;
      const key = `${event.teamId}:${event.playerId}`;
      const player = players.get(key) ?? {
        id: event.playerId,
        name: event.player,
        teamId: event.teamId,
        yellowCards: 0,
        redCards: 0,
      };
      if (event.detail === "Yellow Card") player.yellowCards++;
      else player.redCards++;
      players.set(key, player);
    }
  }
  return [...players.values()]
    .sort((a, b) => b.yellowCards + b.redCards - a.yellowCards - a.redCards || a.name.localeCompare(b.name))
    .slice(0, 100);
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
