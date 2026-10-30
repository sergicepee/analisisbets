import type { Fixture } from "./types";

export type LeagueStandingTeam = { id: number; name: string; logo?: string | null; logoFallback?: string | null };
export type LeagueStandingRow = LeagueStandingTeam & {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};
export type LeagueStandingsZone = { teamId: number; description: string };
export type StandingsZoneStyle = { label: string; color: string };

export function makeLeagueStandings(fixtures: Fixture[], teams: LeagueStandingTeam[]): LeagueStandingRow[] {
  const rows = new Map<number, LeagueStandingRow>();
  const ensure = (id: number, name: string, logo?: string | null) => {
    let row = rows.get(id);
    if (!row) {
      row = { id, name, logo, logoFallback: null, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
      rows.set(id, row);
    } else if (!row.logo && logo) row.logo = logo;
    return row;
  };
  teams.forEach((team) => {
    const row = ensure(team.id, team.name, team.logo);
    row.logoFallback = team.logoFallback;
  });
  for (const fixture of fixtures) {
    if (fixture.goalsHome === null || fixture.goalsAway === null || !["FT", "AET", "PEN"].includes(fixture.statusShort)) continue;
    const home = ensure(fixture.home.id, fixture.home.name, fixture.home.logo);
    const away = ensure(fixture.away.id, fixture.away.name, fixture.away.logo);
    home.played++;
    away.played++;
    home.goalsFor += fixture.goalsHome;
    home.goalsAgainst += fixture.goalsAway;
    away.goalsFor += fixture.goalsAway;
    away.goalsAgainst += fixture.goalsHome;
    if (fixture.goalsHome > fixture.goalsAway) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (fixture.goalsAway > fixture.goalsHome) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }
  return [...rows.values()].sort((a, b) =>
    b.points - a.points ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    b.goalsFor - a.goalsFor ||
    a.name.localeCompare(b.name),
  );
}

export function getStandingsZoneStyle(description: string): StandingsZoneStyle {
  const normalized = description.toLowerCase();
  if (normalized.includes("champions league") || normalized.includes("championnat")) return { label: "Champions League", color: "bg-blue-500" };
  if (normalized.includes("europa league")) return { label: "Europa League", color: "bg-orange-500" };
  if (normalized.includes("conference league")) return { label: "Conference League", color: "bg-green-500" };
  if (normalized.includes("play-off") || normalized.includes("playoff")) return { label: "Play-off", color: "bg-amber-500" };
  if (normalized.includes("relegation")) return { label: "Descenso", color: "bg-red-500" };
  if (normalized.includes("promotion")) return { label: "Ascenso", color: "bg-green-500" };
  return { label: description, color: "bg-violet-500" };
}

export function getFallbackStandingsZones(leagueId: number, standings: LeagueStandingRow[]): LeagueStandingsZone[] {
  const total = standings.length;
  if (!total) return [];
  const rules: Record<number, Array<{ positions: number[]; description: string }>> = {
    39: [
      { positions: [1, 2, 3, 4], description: "Champions League" },
      { positions: [5], description: "Europa League" },
      { positions: [6], description: "Conference League" },
      { positions: [total - 2, total - 1, total], description: "Relegation" },
    ],
    140: [
      { positions: [1, 2, 3, 4], description: "Champions League" },
      { positions: [5], description: "Europa League" },
      { positions: [6], description: "Conference League" },
      { positions: [total - 2, total - 1, total], description: "Relegation" },
    ],
    135: [
      { positions: [1, 2, 3, 4], description: "Champions League" },
      { positions: [5], description: "Europa League" },
      { positions: [6], description: "Conference League" },
      { positions: [total - 2, total - 1, total], description: "Relegation" },
    ],
    61: [
      { positions: [1, 2, 3], description: "Champions League" },
      { positions: [4], description: "Champions League qualifying" },
      { positions: [5], description: "Europa League" },
      { positions: [6], description: "Conference League" },
      { positions: [total - 2], description: "Relegation play-off" },
      { positions: [total - 1, total], description: "Relegation" },
    ],
    78: [
      { positions: [1, 2, 3, 4], description: "Champions League" },
      { positions: [5], description: "Europa League" },
      { positions: [6], description: "Conference League" },
      { positions: [total - 2], description: "Relegation play-off" },
      { positions: [total - 1, total], description: "Relegation" },
    ],
  };
  return (rules[leagueId] ?? []).flatMap((rule) =>
    rule.positions
      .filter((position) => position >= 1 && position <= total)
      .map((position) => ({ teamId: standings[position - 1].id, description: rule.description })),
  );
}
