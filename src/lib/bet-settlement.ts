import type { Fixture, StoredStats } from "./types";
import type { BetLeg, BetStatus } from "./bet-tracker";

export type SettledOutcome = Exclude<BetStatus, "pending"> | null;
type StatMarket = "shots" | "shotsOn" | "corners" | "cards";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function marketKind(leg: BetLeg): "result" | "goals" | StatMarket | null {
  const market = normalize(leg.market);
  const selection = normalize(leg.selection);
  if (market.includes("1x2")) return "result";
  if (market.includes("gol") || market.includes("goal") || selection.includes("gol") || selection.includes("goal")) return "goals";
  if (market.includes("tarjet") || market.includes("card") || selection.includes("tarjet") || selection.includes("card")) return "cards";
  if (market.includes("corner") || market.includes("corn") || selection.includes("corner") || selection.includes("corn")) return "corners";
  if (market.includes("tiro") || market.includes("shot") || selection.includes("tiro") || selection.includes("shot")) {
    return selection.includes("puerta") || selection.includes("target") ? "shotsOn" : "shots";
  }
  if (/^(gana el local|home win|gana el visitante|away win|empate|draw)$/.test(selection)) return "result";
  return null;
}

export function requiresFixtureStats(leg: BetLeg) {
  const kind = marketKind(leg);
  return kind === "shots" || kind === "shotsOn" || kind === "corners" || kind === "cards";
}

function overUnder(leg: BetLeg): { direction: "over" | "under"; line: number } | null {
  const selection = normalize(leg.selection);
  const match = selection.match(/(mas de|menos de|over|under)\s*(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const line = Number(match[2].replace(",", "."));
  if (!Number.isFinite(line)) return null;
  return { direction: match[1] === "mas de" || match[1] === "over" ? "over" : "under", line };
}

function compare(actual: number, direction: "over" | "under", line: number): SettledOutcome {
  if (actual === line) return "void";
  const won = direction === "over" ? actual > line : actual < line;
  return won ? "won" : "lost";
}

function isTeamOrPlayerSpecific(leg: BetLeg, fixture: Fixture) {
  const selection = ` ${normalize(leg.selection)} `;
  const market = normalize(leg.market);
  if (/\b(home|away|local|visitante|team|equipo|player|jugador)\b/.test(`${market} ${selection}`)) return true;
  return [fixture.home.name, fixture.away.name]
    .map(normalize)
    .some((name) => name.length >= 3 && selection.includes(` ${name} `));
}

export function resolveBetLeg(leg: BetLeg, fixture: Fixture, stats: StoredStats | null): SettledOutcome {
  if (fixture.statusShort !== "FT" || fixture.goalsHome === null || fixture.goalsAway === null) return null;
  const kind = marketKind(leg);
  const selection = normalize(leg.selection);

  if (kind === "result") {
    const outcome = fixture.goalsHome > fixture.goalsAway ? "home"
      : fixture.goalsHome < fixture.goalsAway ? "away" : "draw";
    const selectionOutcome = /gana el local|home win/.test(selection) ? "home"
      : /gana el visitante|away win/.test(selection) ? "away"
        : /empate|draw/.test(selection) ? "draw" : null;
    return selectionOutcome ? selectionOutcome === outcome ? "won" : "lost" : null;
  }

  if (kind === "goals") {
    if (/ambos marcan|both teams to score/.test(selection)) {
      const bothScored = fixture.goalsHome > 0 && fixture.goalsAway > 0;
      const expectsYes = !/no|ninguno|ninguna/.test(selection);
      return bothScored === expectsYes ? "won" : "lost";
    }
    if (isTeamOrPlayerSpecific(leg, fixture)) return null;
    const line = overUnder(leg);
    return line ? compare(fixture.goalsHome + fixture.goalsAway, line.direction, line.line) : null;
  }

  if (kind === "shots" || kind === "shotsOn" || kind === "corners" || kind === "cards") {
    if (isTeamOrPlayerSpecific(leg, fixture)) return null;
    const line = overUnder(leg);
    if (!line || !stats) return null;
    const home = stats.home[kind];
    const away = stats.away[kind];
    if (typeof home !== "number" || typeof away !== "number") return null;
    return compare(home + away, line.direction, line.line);
  }

  return null;
}
