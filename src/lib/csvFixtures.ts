import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Fixture } from "./types";

const LEAGUE_ID = 140;
let fixturesPromise: Promise<Fixture[]> | null = null;

function parseCsvLine(line: string): string[] {
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

function stableId(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return -((hash >>> 0) || 1);
}

const TEAM_ALIASES: Record<string, string> = {
  "ath madrid": "Atletico Madrid", "ath bilbao": "Athletic Club", "vallecano": "Rayo Vallecano",
  "espanol": "Espanyol", "sociedad": "Real Sociedad", "celta": "Celta Vigo",
  "la coruna": "Deportivo La Coruna", "santander": "Racing Santander", "betis": "Real Betis",
  "deportivo alaves": "Alaves", "atletico de madrid": "Atletico Madrid", "club atletico de madrid": "Atletico Madrid",
  "villarreal cf": "Villarreal", "rcd espanyol": "Espanyol", "espanyol barcelona": "Espanyol",
  "real sociedad de futbol": "Real Sociedad", "rc celta de vigo": "Celta Vigo", "ca osasuna": "Osasuna",
  "fc barcelona": "Barcelona", "real betis balompie": "Real Betis", "levante ud": "Levante",
  "elche cf": "Elche", "getafe cf": "Getafe", "sevilla fc": "Sevilla", "real madrid cf": "Real Madrid",
  "valencia cf": "Valencia", "real oviedo": "Oviedo", "malaga cf": "Malaga",
};

export function canonicalTeamName(name: string): string {
  const clean = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return TEAM_ALIASES[clean] ?? name.trim();
}

export function csvTeamId(name: string): number {
  return stableId(`team|${canonicalTeamName(name).toLowerCase()}`);
}

// The CSV kickoff is local Spanish time. Convert it to a timestamp while
// accounting for Madrid's daylight saving time on each match date.
function madridTimestamp(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour, minute);
  let guess = wanted;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((p) => [p.type, Number(p.value)]));
    const shown = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess += wanted - shown;
  }
  return Math.floor(guess / 1000);
}

async function readFixtures(): Promise<Fixture[]> {
  const file = path.join(process.cwd(), "public", "data", "la-liga-es-2026-27.csv");
  const text = await readFile(file, "utf8");
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  const index = (name: string) => headers.indexOf(name);
  return lines.map((line) => {
    const row = parseCsvLine(line);
    const get = (name: string) => row[index(name)] ?? "";
    const date = get("date"), time = get("time"), home = get("home_team"), away = get("away_team");
    const status = get("status");
    const result = get("result").match(/^(\d+)\s*-\s*(\d+)/);
    const id = stableId(`${date}|${home}|${away}`);
    const team = (name: string) => ({ id: csvTeamId(name), name, logo: null });
    return {
      id, timestamp: madridTimestamp(date, time), leagueId: LEAGUE_ID,
      leagueName: "La Liga", country: "Spain", flag: "https://flagcdn.com/es.svg", leagueLogo: null,
      season: 2026, round: `Jornada ${get("matchday")}`, venue: get("stadium") || null,
      statusShort: status === "Jugado" ? "FT" : status === "Suspendido" ? "SUSP" : "NS",
      statusLong: status, elapsed: null, home: team(home), away: team(away),
      goalsHome: result ? Number(result[1]) : null, goalsAway: result ? Number(result[2]) : null,
      htHome: null, htAway: null, events: [],
    } satisfies Fixture;
  });
}

export function getCsvFixtures(): Promise<Fixture[]> {
  fixturesPromise ??= readFixtures();
  return fixturesPromise;
}

export async function getCsvFixturesByDate(date: string): Promise<Fixture[]> {
  return (await getCsvFixtures()).filter((fixture) => {
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(fixture.timestamp * 1000);
    return localDate === date;
  });
}

export async function isCsvSeasonDate(date: string): Promise<boolean> {
  const fixtures = await getCsvFixtures();
  if (!fixtures.length) return false;
  const dates = fixtures.map((fixture) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(fixture.timestamp * 1000)).sort();
  return date >= dates[0] && date <= dates[dates.length - 1];
}

export async function getCsvFixture(id: number): Promise<Fixture | null> {
  return (await getCsvFixtures()).find((fixture) => fixture.id === id) ?? null;
}
