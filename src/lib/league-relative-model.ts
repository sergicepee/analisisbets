import type { TeamProfile, TeamRow } from "./types";

export type LeagueGoalContext = {
  homeGoals: number;
  awayGoals: number;
  matches: number;
};

export type LeagueGoalContexts = ReadonlyMap<string, LeagueGoalContext>;

export function leagueContextKey(leagueId: number, season: number): string {
  return `${leagueId}:${season}`;
}

function weightedMean(rows: Array<{ row: TeamRow; value: number }>): number | null {
  const latest = rows.at(-1)?.row.ts;
  if (latest === undefined) return null;
  const halfLife = 60 * 24 * 60 * 60;
  let weightedTotal = 0;
  let totalWeight = 0;
  for (const { row, value } of rows) {
    const weight = Math.pow(0.5, Math.max(0, latest - row.ts) / halfLife);
    weightedTotal += value * weight;
    totalWeight += weight;
  }
  return totalWeight ? weightedTotal / totalWeight : null;
}

function relativeStrength(
  profile: TeamProfile,
  side: "attack" | "defense",
  contexts: LeagueGoalContexts,
): number | null {
  const competitionRows = profile.competitionRows ?? [];
  const competitionIds = new Set(competitionRows.map((row) => row.fixtureId));
  const overallRows = profile.rows.filter((row) => !competitionIds.has(row.fixtureId)).slice(-10);
  const getValues = (rows: TeamRow[]) => rows.flatMap((row) => {
    if (row.leagueId === undefined || row.season === undefined) return [];
    const context = contexts.get(leagueContextKey(row.leagueId, row.season));
    if (!context || context.matches < 3) return [];
    const value = side === "attack" ? row.goalsFor : row.goalsAgainst;
    const baseline = side === "attack"
      ? row.isHome ? context.homeGoals : context.awayGoals
      : row.isHome ? context.awayGoals : context.homeGoals;
    if (!Number.isFinite(value) || baseline <= 0) return [];
    return [{ row, value: value / baseline }];
  });
  const overallValues = getValues(overallRows);
  const competitionValues = getValues(competitionRows);
  const overall = overallValues.length >= 3 ? weightedMean(overallValues) : null;
  const competition = competitionValues.length ? weightedMean(competitionValues) : null;
  if (overall === null) return competitionValues.length >= 3 ? competition : null;
  if (competition === null) return overall;
  const weight = competitionValues.length / (competitionValues.length + 5);
  return overall * (1 - weight) + competition * weight;
}

export function expectedGoalsRelativeToLeague(
  home: TeamProfile,
  away: TeamProfile,
  leagueId: number,
  season: number,
  contexts: LeagueGoalContexts,
): { home: number; away: number; total: number } | null {
  const context = contexts.get(leagueContextKey(leagueId, season));
  if (!context || context.matches < 3 || context.homeGoals <= 0 || context.awayGoals <= 0) return null;

  const homeAttack = relativeStrength(home, "attack", contexts);
  const awayDefense = relativeStrength(away, "defense", contexts);
  const awayAttack = relativeStrength(away, "attack", contexts);
  const homeDefense = relativeStrength(home, "defense", contexts);
  if (homeAttack === null || awayDefense === null || awayAttack === null || homeDefense === null) return null;

  const expectedHome = homeAttack * awayDefense * context.homeGoals;
  const expectedAway = awayAttack * homeDefense * context.awayGoals;
  if (!Number.isFinite(expectedHome) || !Number.isFinite(expectedAway)) return null;
  return { home: expectedHome, away: expectedAway, total: expectedHome + expectedAway };
}
