import { getCsvCalibrationMatches, getCsvTeamProfile, type HistoricalMatch } from "./csvHistory";
import { LINES, expectedFor, matchOverPct, poissonModel } from "./metrics";
import type { Fixture, Metric, TeamProfile } from "./types";

type Observation = { p: number; y: number };
type CalibrationBlock = { center: number; value: number; weight: number };
type CalibrationModel = { n: number; blocks: CalibrationBlock[]; min: number; max: number };
type Candidate = { f: Fixture; market: "1x2" | "goals" | "btts" | Metric; selection: string; p: number; teamSide?: "home" | "away" };

const calibrationCache = new Map<string, Promise<Map<string, CalibrationModel>>>();
const EMPTY = (id: number): TeamProfile => ({ teamId: id, rows: [] });

function fitCalibration(data: Observation[]): CalibrationModel | null {
  if (data.length < 100) return null;
  const sorted = [...data].sort((a, b) => a.p - b.p);
  const baseRate = sorted.reduce((sum, item) => sum + item.y, 0) / sorted.length;
  const chunkSize = Math.max(15, Math.ceil(sorted.length / 15));
  const blocks: Array<{ min: number; max: number; value: number; weight: number }> = [];
  for (let start = 0; start < sorted.length; start += chunkSize) {
    const chunk = sorted.slice(start, start + chunkSize);
    const hits = chunk.reduce((sum, item) => sum + item.y, 0);
    const prior = 8;
    blocks.push({
      min: chunk[0].p, max: chunk.at(-1)!.p,
      value: (hits + prior * baseRate) / (chunk.length + prior), weight: chunk.length + prior,
    });
    while (blocks.length > 1 && blocks.at(-2)!.value > blocks.at(-1)!.value) {
      const right = blocks.pop()!, left = blocks.pop()!;
      const weight = left.weight + right.weight;
      blocks.push({ min: left.min, max: right.max, value: (left.value * left.weight + right.value * right.weight) / weight, weight });
    }
  }
  return {
    n: sorted.length,
    min: sorted[0].p, max: sorted.at(-1)!.p,
    blocks: blocks.map((block) => ({ center: (block.min + block.max) / 2, value: block.value, weight: block.weight })),
  };
}

function applyCalibration(model: CalibrationModel, probabilityPercent: number): number {
  const p = probabilityPercent / 100;
  // Avoid extrapolating beyond the probabilities that the historical sample tested.
  if (p < model.min || p > model.max) return probabilityPercent;
  const blocks = model.blocks;
  if (p <= blocks[0].center) return blocks[0].value * 100;
  if (p >= blocks.at(-1)!.center) return blocks.at(-1)!.value * 100;
  for (let i = 1; i < blocks.length; i++) {
    const right = blocks[i];
    if (p <= right.center) {
      const left = blocks[i - 1];
      const span = right.center - left.center;
      const mix = span > 0 ? (p - left.center) / span : 0;
      return (left.value + (right.value - left.value) * mix) * 100;
    }
  }
  return probabilityPercent;
}

function add(data: Map<string, Observation[]>, key: string, p: number, outcome: boolean) {
  if (!Number.isFinite(p) || p < 0 || p > 100) return;
  const rows = data.get(key) ?? [];
  rows.push({ p: p / 100, y: outcome ? 1 : 0 });
  data.set(key, rows);
}

function historicalCalibrationKey(market: Candidate["market"], line?: number) {
  return market === "1x2" || market === "btts" ? market : `${market}:${line}`;
}

async function makeCalibration(leagueId: number, cutoff: number): Promise<Map<string, CalibrationModel>> {
  const observations = new Map<string, Observation[]>();
  const matches = await getCsvCalibrationMatches(leagueId, cutoff);
  for (const match of matches) {
    const [home, away] = await Promise.all([
      getCsvTeamProfile(match.homeId, true, match.timestamp, leagueId).catch(() => EMPTY(match.homeId)),
      getCsvTeamProfile(match.awayId, true, match.timestamp, leagueId).catch(() => EMPTY(match.awayId)),
    ]);
    const expectedGoals = expectedFor(home, away, "goals");
    const model = expectedGoals ? poissonModel(expectedGoals.home, expectedGoals.away) : null;
    if (model) {
      add(observations, "1x2:home", model.home, match.goalsHome > match.goalsAway);
      add(observations, "1x2:draw", model.draw, match.goalsHome === match.goalsAway);
      add(observations, "1x2:away", model.away, match.goalsHome < match.goalsAway);
      add(observations, "goals:1.5", model.over15, match.goalsHome + match.goalsAway > 1.5);
      add(observations, "goals:2.5", model.over25, match.goalsHome + match.goalsAway > 2.5);
      add(observations, "btts", model.btts, match.goalsHome > 0 && match.goalsAway > 0);
    }
    for (const metric of ["shotsOn", "corners", "cards"] as const) {
      const homeValue = match.home[metric], awayValue = match.away[metric];
      if (homeValue === null || awayValue === null) continue;
      const total = homeValue + awayValue;
      for (const line of LINES[metric]) {
        const pOver = matchOverPct(home, away, metric, line);
        if (pOver !== null) add(observations, `${metric}:${line}`, pOver, total > line);
      }
    }
  }
  const models = new Map<string, CalibrationModel>();
  for (const [key, rows] of observations) {
    const model = fitCalibration(rows);
    if (model) models.set(key, model);
  }
  return models;
}

function modelFor(leagueId: number, cutoff: number): Promise<Map<string, CalibrationModel>> {
  const key = `${leagueId}:${Math.floor(cutoff / 86400)}`;
  let model = calibrationCache.get(key);
  if (!model) {
    model = makeCalibration(leagueId, cutoff);
    calibrationCache.set(key, model);
  }
  return model;
}

function selectionDirection(selection: string): "over" | "under" {
  return selection.startsWith("Más") ? "over" : "under";
}

export async function calibrateCsvPicks<T extends Candidate>(picks: T[], cutoff: number): Promise<Array<T & { rawP: number; calibrationN: number }>> {
  const byLeague = new Map<number, T[]>();
  for (const pick of picks) byLeague.set(pick.f.leagueId, [...(byLeague.get(pick.f.leagueId) ?? []), pick]);
  const calibrated: Array<T & { rawP: number; calibrationN: number }> = [];
  for (const [leagueId, leaguePicks] of byLeague) {
    const models = await modelFor(leagueId, cutoff);
    for (const pick of leaguePicks) {
      const rawP = pick.p;
      // Team-only picks need their own historical calibration; applying the
      // match-total model here would silently calibrate the wrong event.
      if (pick.teamSide) {
        calibrated.push({ ...pick, rawP, calibrationN: 0 });
        continue;
      }
      if (pick.market === "1x2") {
        const key = pick.selection === "Empate" ? "1x2:draw" : pick.selection === `${pick.f.home.name} gana` ? "1x2:home" : "1x2:away";
        const model = models.get(key);
        calibrated.push({ ...pick, rawP, p: model ? applyCalibration(model, rawP) : rawP, calibrationN: model?.n ?? 0 });
        continue;
      }
      if (pick.market === "btts") {
        const model = models.get("btts");
        const pOver = pick.selection.endsWith("Sí") ? rawP : 100 - rawP;
        const adjusted = model ? applyCalibration(model, pOver) : pOver;
        calibrated.push({ ...pick, rawP, p: pick.selection.endsWith("Sí") ? adjusted : 100 - adjusted, calibrationN: model?.n ?? 0 });
        continue;
      }
      const match = pick.selection.match(/de ([\d.]+)/);
      const line = match ? Number(match[1]) : null;
      const key = historicalCalibrationKey(pick.market, line ?? undefined);
      const model = models.get(key);
      const pOver = selectionDirection(pick.selection) === "over" ? rawP : 100 - rawP;
      const adjusted = model ? applyCalibration(model, pOver) : pOver;
      calibrated.push({ ...pick, rawP, p: selectionDirection(pick.selection) === "over" ? adjusted : 100 - adjusted, calibrationN: model?.n ?? 0 });
    }
  }
  // Keep the calibrated 1X2 probabilities coherent after independent calibration.
  const byFixture = new Map<number, Array<T & { rawP: number; calibrationN: number }>>();
  for (const pick of calibrated.filter((item) => item.market === "1x2")) {
    byFixture.set(pick.f.id, [...(byFixture.get(pick.f.id) ?? []), pick]);
  }
  for (const group of byFixture.values()) {
    const total = group.reduce((sum, item) => sum + item.p, 0);
    if (total > 0) for (const item of group) item.p = item.p / total * 100;
  }
  return calibrated;
}
