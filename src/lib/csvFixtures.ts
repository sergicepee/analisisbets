import "server-only";
import { readPublicData } from "./publicData";
import { getTz } from "./prefs";
import { CSV_LEAGUES } from "./csvLeagues";
import type { Fixture } from "./types";

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
  "hull city": "Hull", "manchester city": "Man City", "manchester united": "Man United", "nottingham forest": "Nott'm Forest",
  "sheffield utd": "Sheff Utd", "stoke city": "Stoke",
  "1 fc heidenheim": "Heidenheim", "1 fc kaiserslautern": "Kaiserslautern", "1 fc magdeburg": "Magdeburg",
  "1 fc nurnberg": "Nurnberg", "arminia bielefeld": "Bielefeld", "dynamo dresden": "Dresden",
  "eintracht braunschweig": "Braunschweig", "energie cottbus": "Cottbus", "fc st pauli": "St Pauli",
  "hannover 96": "Hannover", "hertha bsc": "Hertha", "karlsruher sc": "Karlsruhe",
  "spvgg greuther furth": "Greuther Furth", "sv darmstadt 98": "Darmstadt", "vfl bochum": "Bochum",
  "vfl osnabruck": "Osnabruck", "vfl wolfsburg": "Wolfsburg",
  "1 fc koln": "FC Koln", "1899 hoffenheim": "Hoffenheim", "bayer leverkusen": "Leverkusen",
  "bayern munchen": "Bayern Munich", "borussia dortmund": "Dortmund", "borussia monchengladbach": "M'gladbach",
  "eintracht frankfurt": "Ein Frankfurt", "fc augsburg": "Augsburg", "fc schalke 04": "Schalke 04",
  "fsv mainz 05": "Mainz", "hamburger sv": "Hamburg", "sc freiburg": "Freiburg",
  "sc paderborn 07": "Paderborn", "sv elversberg": "Elversberg", "vfb stuttgart": "Stuttgart",
  "ac milan": "Milan", "as roma": "Roma", "hellas verona": "Verona", "vicenza virtus": "Vicenza",
  "estac troyes": "Troyes", "paris saint germain": "Paris SG", "stade brestois 29": "Brest",
  "clermont foot": "Clermont", "pau": "Pau FC", "red star fc 93": "Red Star",
  "ad ceuta fc": "Ceuta", "celta de vigo ii": "Celta B", "fc andorra": "Andorra",
  "granada cf": "Granada", "real sociedad ii": "Sociedad B", "sporting gijon": "Sp Gijon",
};

export function canonicalTeamName(name: string): string {
  const clean = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return TEAM_ALIASES[clean] ?? name.trim();
}

export function csvTeamId(name: string): number {
  return stableId(`team|${canonicalTeamName(name).toLowerCase()}`);
}

async function readFixtures(): Promise<Fixture[]> {
  const results = await Promise.allSettled(CSV_LEAGUES.map((league) =>
    readScheduleFile(league.code === "SP1" ? "la-liga-es-2026-27.csv" : `${league.code}-2026-27.csv`, league),
  ));
  results.forEach((r, i) => { if (r.status === "rejected") console.error(`CSV ${CSV_LEAGUES[i].code} no cargado:`, r.reason); });
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).sort((a, b) => a.timestamp - b.timestamp);
}

async function readScheduleFile(fileName: string, league: (typeof CSV_LEAGUES)[number]): Promise<Fixture[]> {
  const text = await readPublicData(fileName);
  const rows = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = parseCsvLine(rows.shift() ?? "");
  const col = (name: string) => headers.findIndex((header) => header.trim().toLowerCase() === name.toLowerCase());
  return rows.map((line) => {
    const values = parseCsvLine(line);
    const get = (name: string) => values[col(name)] ?? "";
    const date = get("date"), time = get("time") || "12:00";
    const home = get("home_team"), away = get("away_team"), status = get("status");
    const result = get("result").match(/^(\d+)\s*-\s*(\d+)/);
    const id = stableId(`${league.id}|${date}|${home}|${away}`);
    const team = (name: string) => ({ id: csvTeamId(name), name, logo: null });
    const matchday = get("matchday");
    return {
      id, timestamp: footballDataTimestamp(date, time, league.timeZone), leagueId: league.id,
      leagueName: league.name, country: league.country, flag: league.flag, leagueLogo: null,
      season: 2026, round: matchday ? `Jornada ${matchday}` : "", venue: get("stadium") || null,
      statusShort: status === "Jugado" || status === "Finalizado" ? "FT" : status === "Suspendido" ? "SUSP" : "NS",
      statusLong: status, elapsed: null, home: team(home), away: team(away),
      goalsHome: result ? Number(result[1]) : null, goalsAway: result ? Number(result[2]) : null,
      htHome: null, htAway: null, events: [],
    } satisfies Fixture;
  });
}

function footballDataTimestamp(date: string, time: string, timeZone: string): number {
  const [a, b, c] = date.split(/[./-]/).map(Number);
  const year = String(a).length === 4 ? a : c < 100 ? 2000 + c : c;
  const month = String(a).length === 4 ? b : b;
  const day = String(a).length === 4 ? c : a;
  const [hour, minute] = time.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, day, hour || 0, minute || 0);
  let guess = wanted;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, Number(part.value)]));
    guess += wanted - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  }
  return Math.floor(guess / 1000);
}

export function getCsvFixtures(): Promise<Fixture[]> {
  fixturesPromise ??= readFixtures().then((all) => {
    if (!all.length) fixturesPromise = null; // no cachear un fallo total
    return all;
  });
  return fixturesPromise;
}

export async function getCsvFixturesByDate(date: string): Promise<Fixture[]> {
  return (await getCsvFixtures()).filter((fixture) => {
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: getTz() }).format(fixture.timestamp * 1000);
    return localDate === date;
  });
}

export async function isCsvSeasonDate(date: string): Promise<boolean> {
  const fixtures = await getCsvFixtures();
  if (!fixtures.length) return false;
  return fixtures.some((fixture) => {
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: getTz() }).format(fixture.timestamp * 1000);
    return localDate === date;
  });
}

export async function getCsvFixture(id: number): Promise<Fixture | null> {
  return (await getCsvFixtures()).find((fixture) => fixture.id === id) ?? null;
}
