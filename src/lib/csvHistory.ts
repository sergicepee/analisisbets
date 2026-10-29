import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FORM_MATCHES } from "./config";
import { CSV_LEAGUES, csvLeagueById } from "./csvLeagues";
import { canonicalTeamName, csvTeamId } from "./csvFixtures";
import type { Fixture, LeagueAvg, MatchStat, StoredStats, TeamProfile, TeamRow } from "./types";

export type HistoricalMatch = {
  leagueId: number; season: number;
  timestamp: number; homeId: number; awayId: number;
  goalsHome: number; goalsAway: number; htHome: number | null; htAway: number | null;
  home: MatchStat; away: MatchStat;
};

let matchesPromise: Promise<HistoricalMatch[]> | null = null;

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
  const file = path.join(process.cwd(), "public", "data", "football-data", fileName);
  const text = await readFile(file, "utf8");
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
      goalsHome, goalsAway, htHome: number(get("HTHG")), htAway: number(get("HTAG")),
      home: stat("HS", "HST", "HC", cardsHome, redsHome),
      away: stat("AS", "AST", "AC", cardsAway, redsAway),
    }];
  }).sort((a, b) => a.timestamp - b.timestamp);
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

export async function getCsvCalibrationMatches(leagueId: number, beforeTimestamp: number): Promise<HistoricalMatch[]> {
  return (await readHistory()).filter((match) => match.leagueId === leagueId && match.timestamp < beforeTimestamp);
}

export async function getCsvTeamProfile(teamId: number, withStats: boolean, beforeTimestamp = Infinity, leagueId?: number): Promise<TeamProfile> {
  const matches = (await readHistory()).filter((match) => match.timestamp < beforeTimestamp && (!leagueId || match.leagueId === leagueId) && (match.homeId === teamId || match.awayId === teamId));
  const rows: TeamRow[] = matches.slice(-FORM_MATCHES).map((match) => {
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

export async function getCsvStatsForFixture(fixture: Fixture): Promise<StoredStats | null> {
  const timeZone = csvLeagueById(fixture.leagueId)?.timeZone ?? "Europe/Madrid";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone }).format(fixture.timestamp * 1000);
  const homeId = csvTeamId(canonicalTeamName(fixture.home.name));
  const awayId = csvTeamId(canonicalTeamName(fixture.away.name));
  const match = (await readHistory()).find((item) => {
    const matchDate = new Intl.DateTimeFormat("en-CA", { timeZone }).format(item.timestamp * 1000);
    return item.leagueId === fixture.leagueId && matchDate === date && item.homeId === homeId && item.awayId === awayId;
  });
  if (!match) return null;
  return {
    fixtureId: fixture.id, leagueId: fixture.leagueId, season: fixture.season,
    homeId: fixture.home.id, awayId: fixture.away.id, home: match.home, away: match.away,
    goalsHome: match.goalsHome, goalsAway: match.goalsAway,
    hasData: [match.home.shots, match.home.corners, match.away.shots, match.away.corners].some((value) => value !== null),
  };
}
