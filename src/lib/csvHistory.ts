import "server-only";
import { readPublicData } from "./publicData";
import { FORM_MATCHES } from "./config";
import { CSV_LEAGUES, csvLeagueById } from "./csvLeagues";
import { canonicalTeamName, csvTeamId } from "./csvFixtures";
import type { Fixture, LeagueAvg, MatchStat, StoredStats, TeamProfile, TeamRow } from "./types";

export type HistoricalMatch = {
  leagueId: number; season: number;
  timestamp: number; homeId: number; awayId: number;
  homeName: string; awayName: string;
  goalsHome: number; goalsAway: number; htHome: number | null; htAway: number | null;
  yellowHome: number; redHome: number; yellowAway: number; redAway: number;
  home: MatchStat; away: MatchStat;
};

let matchesPromise: Promise<HistoricalMatch[]> | null = null;
const seasonMatchesPromises = new Map<string, Promise<HistoricalMatch[]>>();

function csvLine(line: string): string[] {
  const values: string[] = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

function number(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function localTimestamp(date: string, time: string, timeZone: string): number {
  const [a, b, c] = date.split(/[./-]/).map(Number);
  const year = String(a).length === 4 ? a : c < 100 ? 2000 + c : c;
  const month = String(a).length === 4 ? b : b;
  const day = String(a).length === 4 ? c : a;
  const [hour, minute] = (time || "12:00").split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
  let guess = wanted;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((p) => [p.type, Number(p.value)]));
    guess += wanted - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  }
  return Math.floor(guess / 1000);
}

async function readMatchesFrom(code: string, leagueId: number, season: number): Promise<HistoricalMatch[]> {
  const fileName = `${code}-${season}-${String(season + 1).slice(-2)}.csv`;
  const league = csvLeagueById(leagueId);
  if (!league) return [];
  const text = await readPublicData(`football-data/${fileName}`);
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = csvLine(lines.shift() ?? "");
  const index = (name: string) => headers.findIndex((header) => header.trim().toLowerCase() === name.toLowerCase());
  return lines.flatMap((line) => {
    const values = csvLine(line);
    const get = (name: string) => values[index(name)] ?? "";
    const goalsHome = number(get("FTHG")), goalsAway = number(get("FTAG"));
    if (goalsHome === null || goalsAway === null) return [];
    const cardsHome = number(get("HY")), redsHome = number(get("HR"));
    const cardsAway = number(get("AY")), redsAway = number(get("AR"));
    const stat = (shots: string, shotsOn: string, corners: string, yellow: number | null, red: number | null): MatchStat => ({
      shots: number(get(shots)), shotsOn: number(get(shotsOn)), corners: number(get(corners)),
      cards: yellow === null && red === null ? null : (yellow ?? 0) + (red ?? 0),
    });
    return [{
      leagueId, season,
      timestamp: localTimestamp(get("Date"), get("Time"), league.timeZone),
      homeId: csvTeamId(canonicalTeamName(get("HomeTeam"))),
      awayId: csvTeamId(canonicalTeamName(get("AwayTeam"))),
      homeName: get("HomeTeam"), awayName: get("AwayTeam"),
      goalsHome, goalsAway, htHome: number(get("HTHG")), htAway: number(get("HTAG")),
      yellowHome: number(get("HY")) ?? 0, redHome: number(get("HR")) ?? 0,
      yellowAway: number(get("AY")) ?? 0, redAway: number(get("AR")) ?? 0,
      home: stat("HS", "HST", "HC", cardsHome, redsHome),
      away: stat("AS", "AST", "AC", cardsAway, redsAway),
    }];
  }).sort((a, b) => a.timestamp - b.timestamp);
}

function readSeasonMatches(code: string, leagueId: number, season: number): Promise<HistoricalMatch[]> {
  const key = `${code}:${season}`;
  let promise = seasonMatchesPromises.get(key);
  if (!promise) {
    promise = readMatchesFrom(code, leagueId, season).catch((error: unknown) => {
      seasonMatchesPromises.delete(key);
      throw error;
    });
    seasonMatchesPromises.set(key, promise);
  }
  return promise;
}

async function readMatches(): Promise<HistoricalMatch[]> {
  const sources = CSV_LEAGUES.flatMap((league) => [2025, 2026].map((season) =>
    readMatchesFrom(league.code, league.id, season)));
  const seasons = await Promise.all(sources);
  return seasons.flat().sort((a, b) => a.timestamp - b.timestamp);
}

function readHistory(): Promise<HistoricalMatch[]> {
  matchesPromise ??= readMatches();
  return matchesPromise;
}

export async function getCsvTeamProfile(teamId: number, withStats: boolean, beforeTimestamp = Infinity, leagueId?: number, season?: number, limit = FORM_MATCHES): Promise<TeamProfile> {
  const matches = (await readHistory()).filter((match) => match.timestamp < beforeTimestamp && (!leagueId || match.leagueId === leagueId) && (!season || match.season === season) && (match.homeId === teamId || match.awayId === teamId));
  const rows: TeamRow[] = matches.slice(-limit).map((match) => {
    const isHome = match.homeId === teamId;
    const goalsFor = isHome ? match.goalsHome : match.goalsAway;
    const goalsAgainst = isHome ? match.goalsAway : match.goalsHome;
    return {
      fixtureId: -Math.abs(match.timestamp * (isHome ? 1 : -1)), ts: match.timestamp, isHome,
      goalsFor, goalsAgainst,
      htFor: isHome ? match.htHome : match.htAway, htAgainst: isHome ? match.htAway : match.htHome,
      result: goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L",
      sFor: withStats ? (isHome ? match.home : match.away) : null,
      sAgainst: withStats ? (isHome ? match.away : match.home) : null,
    };
  });
  return { teamId, rows };
}

export async function getCsvLeagueSeasons(leagueId: number): Promise<number[]> {
  return [...new Set((await readHistory()).filter((m) => m.leagueId === leagueId).map((m) => m.season))].sort((a, b) => b - a);
}

export async function getCsvLeagueTeams(leagueId: number, season?: number): Promise<Array<{ id: number; name: string }>> {
  const matches = (await readHistory()).filter((m) => m.leagueId === leagueId && (!season || m.season === season));
  const teams = new Map<number, string>();
  for (const match of matches) {
    teams.set(match.homeId, match.homeName);
    teams.set(match.awayId, match.awayName);
  }
  return [...teams].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getCsvLeagueFixtures(leagueId: number, season: number): Promise<Fixture[]> {
  const league = csvLeagueById(leagueId);
  if (!league) return [];
  const matches = (await readHistory()).filter((match) => match.leagueId === leagueId && match.season === season);
  const teamCount = new Set(matches.flatMap((match) => [match.homeId, match.awayId])).size;
  const gamesPerRound = Math.max(1, Math.floor(teamCount / 2));
  return matches.map((match, index) => ({
    id: -Math.abs(match.timestamp * 100 + index + 1),
    timestamp: match.timestamp,
    leagueId,
    leagueName: league.name,
    country: league.country,
    flag: league.flag,
    leagueLogo: null,
    season,
    round: `Jornada ${Math.floor(index / gamesPerRound) + 1}`,
    venue: null,
    statusShort: "FT",
    statusLong: "Finalizado",
    elapsed: null,
    home: { id: match.homeId, name: match.homeName, logo: null },
    away: { id: match.awayId, name: match.awayName, logo: null },
    goalsHome: match.goalsHome,
    goalsAway: match.goalsAway,
    htHome: match.htHome,
    htAway: match.htAway,
    redCardsHome: match.redHome,
    redCardsAway: match.redAway,
    events: [],
  }));
}

export async function getCsvTeamMatchSeries(teamId: number, leagueId: number, season: number) {
  return (await readHistory()).filter((match) => match.leagueId === leagueId && match.season === season && (match.homeId === teamId || match.awayId === teamId))
    .map((match) => {
      const isHome = match.homeId === teamId;
      const own = isHome ? match.home : match.away;
      const against = isHome ? match.away : match.home;
      return {
        timestamp: match.timestamp, isHome, opponent: isHome ? match.awayName : match.homeName,
        own: { goals: isHome ? match.goalsHome : match.goalsAway, shots: own.shots, shotsOn: own.shotsOn, corners: own.corners, cards: own.cards },
        against: { goals: isHome ? match.goalsAway : match.goalsHome, shots: against.shots, shotsOn: against.shotsOn, corners: against.corners, cards: against.cards },
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
}

export async function getCsvLeagueAverage(leagueId = 140, season = 2026): Promise<LeagueAvg | null> {
  const matches = (await readHistory()).filter((match) => match.leagueId === leagueId && match.season === season);
  if (!matches.length) return null;
  const avg = (values: Array<number | null>) => {
    const present = values.filter((value): value is number => value !== null);
    return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
  };
  const totals = (field: "shots" | "shotsOn" | "corners" | "cards") => matches.map((match) => {
    const a = match.home[field], b = match.away[field];
    return a === null || b === null ? null : a + b;
  });
  const over = (line: number) => matches.filter((match) => match.goalsHome + match.goalsAway > line).length / matches.length * 100;
  return {
    n: matches.length,
    goals: avg(matches.map((match) => match.goalsHome + match.goalsAway)),
    shots: avg(totals("shots")), shotsOn: avg(totals("shotsOn")),
    corners: avg(totals("corners")), cards: avg(totals("cards")),
    over15: over(1.5), over25: over(2.5),
    btts: matches.filter((match) => match.goalsHome > 0 && match.goalsAway > 0).length / matches.length * 100,
  };
}

export async function getCsvStatsForFixture(fixture: Fixture): Promise<(StoredStats & Pick<Fixture, "htHome" | "htAway"> & {
  yellowHome: number; redHome: number; yellowAway: number; redAway: number;
}) | null> {
  const league = csvLeagueById(fixture.leagueId);
  const timeZone = league?.timeZone ?? "Europe/Madrid";
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone });
  const date = dateFormatter.format(fixture.timestamp * 1000);
  const homeId = csvTeamId(canonicalTeamName(fixture.home.name));
  const awayId = csvTeamId(canonicalTeamName(fixture.away.name));
  if (!league) return null;
  const match = (await readSeasonMatches(league.code, fixture.leagueId, fixture.season)).find((item) =>
    dateFormatter.format(item.timestamp * 1000) === date &&
    item.homeId === homeId && item.awayId === awayId,
  );
  if (!match) return null;
  return {
    fixtureId: fixture.id, leagueId: fixture.leagueId, season: fixture.season,
    homeId: fixture.home.id, awayId: fixture.away.id, home: match.home, away: match.away,
    goalsHome: match.goalsHome, goalsAway: match.goalsAway,
    htHome: match.htHome, htAway: match.htAway,
    yellowHome: match.yellowHome, redHome: match.redHome,
    yellowAway: match.yellowAway, redAway: match.redAway,
    hasData: [match.home.shots, match.home.corners, match.away.shots, match.away.corners].some((value) => value !== null),
  };
}
