import "server-only";
import { createHash } from "node:crypto";
import type { Fixture, Metric, TeamProfile } from "./types";
import { getSupabase } from "./supabase";
import {
  evaluatePrediction,
  type MarketProbabilities,
  type OutcomeProbabilities,
} from "./prediction-evaluation";
import { PREDICTION_MODEL_VERSION, PREDICTION_SNAPSHOT_VERSION } from "./prediction-config";

export type ExpectedMetrics = Record<Metric, { home: number; away: number; total: number } | null>;

export type PredictionOutputs = {
  outcomes: OutcomeProbabilities;
  markets: MarketProbabilities;
  expected: ExpectedMetrics;
};

function dataVersion(snapshot: object): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export async function savePreMatchPrediction(
  fixture: Fixture,
  homeProfile: TeamProfile,
  awayProfile: TeamProfile,
  outputs: PredictionOutputs,
): Promise<void> {
  if (fixture.id <= 0 || fixture.timestamp <= Date.now() / 1000) return;
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase no está configurado; no se puede guardar la predicción.");

  const snapshot = {
    source: "ESPN",
    capturedAt: new Date().toISOString(),
    homeProfile,
    awayProfile,
  };
  const { error } = await sb.from("model_predictions").insert({
    fixture_id: fixture.id,
    fixture_date: new Date(fixture.timestamp * 1000).toISOString(),
    league_id: fixture.leagueId,
    league_name: fixture.leagueName,
    home_team_id: fixture.home.id,
    home_team_name: fixture.home.name,
    away_team_id: fixture.away.id,
    away_team_name: fixture.away.name,
    model_version: PREDICTION_MODEL_VERSION,
    data_version: dataVersion(snapshot),
    data_snapshot_version: PREDICTION_SNAPSHOT_VERSION,
    data_snapshot: snapshot,
    prediction: outputs,
  });
  if (error && error.code !== "23505") throw error;
}

function isPredictionOutputs(value: unknown): value is PredictionOutputs {
  if (typeof value !== "object" || value === null) return false;
  const output = value as Partial<PredictionOutputs>;
  const isProbability = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  return !!output.outcomes && !!output.markets &&
    isProbability(output.outcomes.home) && isProbability(output.outcomes.draw) &&
    isProbability(output.outcomes.away) && isProbability(output.markets.over15) &&
    isProbability(output.markets.over25) && isProbability(output.markets.btts);
}

export async function settleSavedPrediction(fixture: Fixture): Promise<void> {
  if (!["FT", "AET", "PEN"].includes(fixture.statusShort) ||
      fixture.goalsHome === null || fixture.goalsAway === null || fixture.id <= 0) return;
  const sb = getSupabase();
  if (!sb) return;

  const { data, error } = await sb.from("model_predictions")
    .select("id,prediction")
    .eq("fixture_id", fixture.id)
    .eq("model_version", PREDICTION_MODEL_VERSION)
    .is("actual_result", null)
    .maybeSingle();
  if (error) throw error;
  if (!data || !isPredictionOutputs(data.prediction)) return;

  const evaluation = evaluatePrediction(data.prediction.outcomes, data.prediction.markets, {
    homeGoals: fixture.goalsHome,
    awayGoals: fixture.goalsAway,
  });
  const { error: updateError } = await sb.from("model_predictions")
    .update({
      actual_result: {
        homeGoals: fixture.goalsHome,
        awayGoals: fixture.goalsAway,
        outcome: fixture.goalsHome > fixture.goalsAway ? "home" : fixture.goalsHome === fixture.goalsAway ? "draw" : "away",
        over15: fixture.goalsHome + fixture.goalsAway > 1.5,
        over25: fixture.goalsHome + fixture.goalsAway > 2.5,
        btts: fixture.goalsHome > 0 && fixture.goalsAway > 0,
      },
      log_loss: evaluation.logLoss,
      brier_score: evaluation.brierScore,
      market_metrics: evaluation.markets,
      evaluated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .is("actual_result", null);
  if (updateError) throw updateError;
}
