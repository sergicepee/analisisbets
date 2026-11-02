import test from "node:test";
import assert from "node:assert/strict";
import { expectedGoalsRelativeToLeague } from "../src/lib/league-relative-model.ts";

const row = (fixtureId, isHome, goalsFor, goalsAgainst) => ({
  fixtureId,
  ts: fixtureId,
  isHome,
  leagueId: 140,
  season: 2026,
  goalsFor,
  goalsAgainst,
  htFor: null,
  htAgainst: null,
  result: "D",
  sFor: null,
  sAgainst: null,
});

test("neutral relative strengths reproduce the target league's distinct home and away averages", () => {
  const homeRows = [row(1, true, 2, 1), row(2, true, 2, 1), row(3, true, 2, 1)];
  const awayRows = [row(4, false, 1, 2), row(5, false, 1, 2), row(6, false, 1, 2)];
  const contexts = new Map([["140:2026", { homeGoals: 2, awayGoals: 1, matches: 40 }]]);
  const result = expectedGoalsRelativeToLeague(
    { teamId: 1, rows: homeRows, competitionRows: homeRows },
    { teamId: 2, rows: awayRows, competitionRows: awayRows },
    140,
    2026,
    contexts,
  );
  assert.deepEqual(result, { home: 2, away: 1, total: 3 });
});

test("attack and defence use the correct home and away scoring baselines", () => {
  const homeRows = [row(1, true, 4, 0.5), row(2, true, 4, 0.5), row(3, true, 4, 0.5)];
  const awayRows = [row(4, false, 0.5, 4), row(5, false, 0.5, 4), row(6, false, 0.5, 4)];
  const contexts = new Map([["140:2026", { homeGoals: 2, awayGoals: 1, matches: 40 }]]);
  const result = expectedGoalsRelativeToLeague(
    { teamId: 1, rows: homeRows, competitionRows: homeRows },
    { teamId: 2, rows: awayRows, competitionRows: awayRows },
    140,
    2026,
    contexts,
  );
  assert.deepEqual(result, { home: 8, away: 0.25, total: 8.25 });
});

test("returns no prediction without a pre-match target-league context", () => {
  const rows = [row(1, true, 2, 1), row(2, true, 2, 1), row(3, true, 2, 1)];
  assert.equal(expectedGoalsRelativeToLeague(
    { teamId: 1, rows, competitionRows: rows },
    { teamId: 2, rows, competitionRows: rows },
    140,
    2026,
    new Map(),
  ), null);
});
