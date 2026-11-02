export type OutcomeProbabilities = {
  home: number;
  draw: number;
  away: number;
};

export type MarketProbabilities = {
  over15: number;
  over25: number;
  btts: number;
};

export type ActualPredictionResult = {
  homeGoals: number;
  awayGoals: number;
};

export type PredictionEvaluation = {
  logLoss: number;
  brierScore: number;
  markets: Record<keyof MarketProbabilities, { logLoss: number; brierScore: number }>;
};

const EPSILON = 1e-15;

function binaryEvaluation(probability: number, event: boolean) {
  const p = Math.min(1 - EPSILON, Math.max(EPSILON, probability));
  const actual = event ? 1 : 0;
  return {
    logLoss: -(actual * Math.log(p) + (1 - actual) * Math.log(1 - p)),
    brierScore: (p - actual) ** 2,
  };
}

export function evaluatePrediction(
  outcomes: OutcomeProbabilities,
  markets: MarketProbabilities,
  actual: ActualPredictionResult,
): PredictionEvaluation {
  const outcome = actual.homeGoals > actual.awayGoals
    ? "home"
    : actual.homeGoals === actual.awayGoals ? "draw" : "away";
  const actualOutcomes: OutcomeProbabilities = {
    home: outcome === "home" ? 1 : 0,
    draw: outcome === "draw" ? 1 : 0,
    away: outcome === "away" ? 1 : 0,
  };
  const p = Math.min(1 - EPSILON, Math.max(EPSILON, outcomes[outcome]));
  const brierScore = (["home", "draw", "away"] as const)
    .reduce((sum, key) => sum + (outcomes[key] - actualOutcomes[key]) ** 2, 0);

  return {
    logLoss: -Math.log(p),
    brierScore,
    markets: {
      over15: binaryEvaluation(markets.over15, actual.homeGoals + actual.awayGoals > 1.5),
      over25: binaryEvaluation(markets.over25, actual.homeGoals + actual.awayGoals > 2.5),
      btts: binaryEvaluation(markets.btts, actual.homeGoals > 0 && actual.awayGoals > 0),
    },
  };
}
