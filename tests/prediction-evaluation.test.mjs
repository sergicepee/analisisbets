import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePrediction } from "../src/lib/prediction-evaluation.ts";

test("scores a correct draw with multiclass log-loss and Brier", () => {
  const result = evaluatePrediction(
    { home: 0.2, draw: 0.6, away: 0.2 },
    { over15: 0.7, over25: 0.4, btts: 0.5 },
    { homeGoals: 1, awayGoals: 1 },
  );
  assert.ok(Math.abs(result.logLoss + Math.log(0.6)) < 1e-12);
  assert.ok(Math.abs(result.brierScore - 0.24) < 1e-12);
  assert.ok(Math.abs(result.markets.over15.brierScore - 0.09) < 1e-12);
  assert.ok(Math.abs(result.markets.over25.brierScore - 0.16) < 1e-12);
  assert.ok(Math.abs(result.markets.btts.brierScore - 0.25) < 1e-12);
});

test("clips impossible zero probabilities instead of producing infinite loss", () => {
  const result = evaluatePrediction(
    { home: 1, draw: 0, away: 0 },
    { over15: 0, over25: 0, btts: 0 },
    { homeGoals: 0, awayGoals: 0 },
  );
  assert.ok(Number.isFinite(result.logLoss));
  assert.ok(Number.isFinite(result.markets.over15.logLoss));
});
