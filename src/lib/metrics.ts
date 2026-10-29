import type { Metric, TeamProfile, TeamRow } from "./types";

export const MIN_SAMPLES = 3;
export const METRIC_LABEL: Record<Metric, string> = {
  goals: "Goles", shots: "Tiros", shotsOn: "Tiros a puerta", corners: "Córners", cards: "Tarjetas",
};
/** Líneas (más de X) para las tablas de tendencias, sobre el TOTAL del partido. */
export const LINES: Record<Metric, number[]> = {
  goals: [1.5, 2.5],
  shots: [],
  shotsOn: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5],
  corners: [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5],
  cards: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
// Walk-forward checks on the supplied La Liga data favored a shorter memory
// for goals/results and a longer one for noisier count statistics.
const GOAL_HALF_LIFE_SECONDS = 60 * 24 * 60 * 60;
const COUNT_HALF_LIFE_SECONDS = 180 * 24 * 60 * 60;
const TREND_HALF_LIFE_SECONDS = 60 * 24 * 60 * 60;

function weightedMean(rows: TeamRow[], value: (row: TeamRow) => number | null, halfLife = TREND_HALF_LIFE_SECONDS): number | null {
  const latest = rows.at(-1)?.ts;
  if (latest === undefined) return null;
  let total = 0, weights = 0;
  for (const row of rows) {
    const v = value(row);
    if (v === null || !Number.isFinite(v)) continue;
    const w = Math.pow(0.5, Math.max(0, latest - row.ts) / halfLife);
    total += v * w;
    weights += w;
  }
  return weights ? total / weights : null;
}

export function rowVal(r: TeamRow, m: Metric, side: "for" | "against"): number | null {
  if (m === "goals") return side === "for" ? r.goalsFor : r.goalsAgainst;
  const s = side === "for" ? r.sFor : r.sAgainst;
  return s ? s[m] : null;
}

/** Media de un equipo (a favor o en contra) en sus últimos partidos. null si hay pocos datos. */
export function teamAvg(p: TeamProfile, m: Metric, side: "for" | "against"): number | null {
  const rows = p.rows.filter((r) => rowVal(r, m, side) !== null);
  const halfLife = m === "goals" ? GOAL_HALF_LIFE_SECONDS : COUNT_HALF_LIFE_SECONDS;
  return rows.length >= MIN_SAMPLES ? weightedMean(rows, (r) => rowVal(r, m, side), halfLife) : null;
}

function venueAvg(p: TeamProfile, m: Metric, side: "for" | "against", homeVenue: boolean): number | null {
  const all = p.rows.filter((r) => rowVal(r, m, side) !== null);
  const venue = all.filter((r) => r.isHome === homeVenue);
  const sample = venue.length >= MIN_SAMPLES ? venue : all;
  const halfLife = m === "goals" ? GOAL_HALF_LIFE_SECONDS : COUNT_HALF_LIFE_SECONDS;
  return sample.length >= MIN_SAMPLES ? weightedMean(sample, (r) => rowVal(r, m, side), halfLife) : null;
}

/**
 * Valor esperado: para cada equipo = media(lo que él produce, lo que el rival concede).
 * Total = suma de ambos equipos.
 */
export function expectedFor(a: TeamProfile, b: TeamProfile, m: Metric) {
  const af = venueAvg(a, m, "for", true), aa = venueAvg(a, m, "against", true);
  const bf = venueAvg(b, m, "for", false), ba = venueAvg(b, m, "against", false);
  if (af === null || aa === null || bf === null || ba === null) return null;
  const home = (af + ba) / 2;
  const away = (bf + aa) / 2;
  return { home, away, total: home + away };
}

function totals(p: TeamProfile, m: Metric): number[] {
  const out: number[] = [];
  for (const r of p.rows) {
    const f = rowVal(r, m, "for"), a = rowVal(r, m, "against");
    if (f !== null && a !== null) out.push(f + a);
  }
  return out;
}
/** Media del TOTAL del partido en los últimos partidos de ese equipo. */
export const trendAvg = (p: TeamProfile, m: Metric) => {
  const rows = p.rows.filter((r) => rowVal(r, m, "for") !== null && rowVal(r, m, "against") !== null);
  const halfLife = m === "goals" ? GOAL_HALF_LIFE_SECONDS : COUNT_HALF_LIFE_SECONDS;
  return rows.length >= MIN_SAMPLES ? weightedMean(rows, (r) => rowVal(r, m, "for")! + rowVal(r, m, "against")!, halfLife) : null;
};
/** % de los últimos partidos del equipo cuyo total superó la línea. */
export function trendPct(p: TeamProfile, m: Metric, line: number): number | null {
  const rows = p.rows.filter((r) => rowVal(r, m, "for") !== null && rowVal(r, m, "against") !== null);
  if (rows.length < MIN_SAMPLES) return null;
  const latest = rows.at(-1)!.ts;
  let hits = 0, weights = 0;
  for (const row of rows) {
    const value = rowVal(row, m, "for")! + rowVal(row, m, "against")!;
    const w = Math.pow(0.5, Math.max(0, latest - row.ts) / TREND_HALF_LIFE_SECONDS);
    if (value > line) hits += w;
    weights += w;
  }
  return weights ? hits / weights * 100 : null;
}
export function bttsPct(p: TeamProfile): number | null {
  if (p.rows.length < MIN_SAMPLES) return null;
  const latest = p.rows.at(-1)!.ts;
  let hits = 0, weights = 0;
  for (const row of p.rows) {
    const w = Math.pow(0.5, Math.max(0, latest - row.ts) / TREND_HALF_LIFE_SECONDS);
    if (row.goalsFor > 0 && row.goalsAgainst > 0) hits += w;
    weights += w;
  }
  return weights ? hits / weights * 100 : null;
}
/** % de los partidos propios del equipo en que SU valor (no el total) superó la línea. */
export function ownPct(p: TeamProfile, m: Metric, line: number): number | null {
  const rows = p.rows.filter((r) => rowVal(r, m, "for") !== null);
  if (rows.length < MIN_SAMPLES) return null;
  const latest = rows.at(-1)!.ts;
  let hits = 0, weights = 0;
  for (const row of rows) {
    const w = Math.pow(0.5, Math.max(0, latest - row.ts) / TREND_HALF_LIFE_SECONDS);
    if (rowVal(row, m, "for")! > line) hits += w;
    weights += w;
  }
  return weights ? hits / weights * 100 : null;
}
/** % de los partidos de AMBOS equipos (muestra conjunta) cuyo total superó la línea. */
export function pooledPct(a: TeamProfile, b: TeamProfile, m: Metric, line: number): number | null {
  const rows = [...a.rows, ...b.rows].filter((r) => rowVal(r, m, "for") !== null && rowVal(r, m, "against") !== null);
  if (rows.length < MIN_SAMPLES * 2) return null;
  const latest = Math.max(...rows.map((r) => r.ts));
  let hits = 0, weights = 0;
  for (const row of rows) {
    const w = Math.pow(0.5, Math.max(0, latest - row.ts) / TREND_HALF_LIFE_SECONDS);
    if (rowVal(row, m, "for")! + rowVal(row, m, "against")! > line) hits += w;
    weights += w;
  }
  return weights ? hits / weights * 100 : null;
}
export function pooledBtts(a: TeamProfile, b: TeamProfile): number | null {
  const rows = [...a.rows, ...b.rows];
  if (rows.length < MIN_SAMPLES * 2) return null;
  const latest = Math.max(...rows.map((r) => r.ts));
  let hits = 0, weights = 0;
  for (const row of rows) {
    const w = Math.pow(0.5, Math.max(0, latest - row.ts) / TREND_HALF_LIFE_SECONDS);
    if (row.goalsFor > 0 && row.goalsAgainst > 0) hits += w;
    weights += w;
  }
  return weights ? hits / weights * 100 : null;
}
export const avg2 = (a: number | null, b: number | null) => (a === null || b === null ? null : (a + b) / 2);

// ── Goles por mitad ──
function half(r: TeamRow, side: "for" | "against", h: 1 | 2): number | null {
  const ht = side === "for" ? r.htFor : r.htAgainst;
  const ft = side === "for" ? r.goalsFor : r.goalsAgainst;
  if (ht === null) return null;
  return h === 1 ? ht : ft - ht;
}
export function halfExpected(a: TeamProfile, b: TeamProfile, h: 1 | 2) {
  const atVenue = (p: TeamProfile, side: "for" | "against", homeVenue: boolean) => {
    const valid = p.rows.filter((r) => half(r, side, h) !== null);
    const venue = valid.filter((r) => r.isHome === homeVenue);
    const sample = venue.length >= MIN_SAMPLES ? venue : valid;
    return sample.length >= MIN_SAMPLES ? weightedMean(sample, (r) => half(r, side, h), GOAL_HALF_LIFE_SECONDS) : null;
  };
  const af = atVenue(a, "for", true), aa = atVenue(a, "against", true);
  const bf = atVenue(b, "for", false), ba = atVenue(b, "against", false);
  if (af === null || aa === null || bf === null || ba === null) return null;
  const home = (af + ba) / 2;
  const away = (bf + aa) / 2;
  return { home, away, total: home + away };
}
/** % de partidos (de ambos equipos) con al menos un gol en esa mitad. */
export function halfGoalPct(a: TeamProfile, b: TeamProfile, h: 1 | 2): number | null {
  const rows = [a, b].flatMap((p) => p.rows.map((r) => ({ r, f: half(r, "for", h), g: half(r, "against", h) })))
    .filter((x) => x.f !== null && x.g !== null);
  if (rows.length < MIN_SAMPLES * 2) return null;
  const latest = Math.max(...rows.map((x) => x.r.ts));
  let hits = 0, weights = 0;
  for (const item of rows) {
    const w = Math.pow(0.5, Math.max(0, latest - item.r.ts) / TREND_HALF_LIFE_SECONDS);
    if (item.f! + item.g! > 0) hits += w;
    weights += w;
  }
  return weights ? hits / weights * 100 : null;
}

// ── Dixon-Coles: Poisson con ajuste de marcadores bajos ──
function pmf(l: number, n = 11): number[] {
  const out = [Math.exp(-l)];
  for (let k = 1; k < n; k++) out.push((out[k - 1] * l) / k);
  return out;
}
export function poissonModel(lh: number, la: number, rho = -0.1) {
  lh = Math.max(0.05, Math.min(8, lh));
  la = Math.max(0.05, Math.min(8, la));
  const ph = pmf(lh, 16), pa = pmf(la, 16);
  let h = 0, d = 0, a = 0, o15 = 0, o25 = 0, btts = 0, tot = 0;
  for (let i = 0; i < ph.length; i++)
    for (let j = 0; j < pa.length; j++) {
      let correction = 1;
      if (i === 0 && j === 0) correction = 1 - lh * la * rho;
      else if (i === 0 && j === 1) correction = 1 + lh * rho;
      else if (i === 1 && j === 0) correction = 1 + la * rho;
      else if (i === 1 && j === 1) correction = 1 - rho;
      const p = ph[i] * pa[j] * Math.max(0, correction);
      tot += p;
      if (i > j) h += p; else if (i === j) d += p; else a += p;
      if (i + j > 1.5) o15 += p;
      if (i + j > 2.5) o25 += p;
      if (i > 0 && j > 0) btts += p;
    }
  const f = (x: number) => (x / tot) * 100;
  return { home: f(h), draw: f(d), away: f(a), over15: f(o15), over25: f(o25), btts: f(btts) };
}

/** Probability for count markets: recent matchup expectation with a Poisson/NB variance fit. */
export function matchOverPct(a: TeamProfile, b: TeamProfile, m: Metric, line: number): number | null {
  const expected = expectedFor(a, b, m)?.total;
  if (expected === null || expected === undefined || !Number.isFinite(expected)) return null;
  const samples = [...a.rows, ...b.rows].flatMap((row) => {
    const f = rowVal(row, m, "for"), against = rowVal(row, m, "against");
    return f === null || against === null ? [] : [{ ts: row.ts, value: f + against }];
  });
  if (samples.length < MIN_SAMPLES * 2) return null;
  const latest = Math.max(...samples.map((x) => x.ts));
  const halfLife = m === "goals" ? GOAL_HALF_LIFE_SECONDS : COUNT_HALF_LIFE_SECONDS;
  const weight = (ts: number) => Math.pow(0.5, Math.max(0, latest - ts) / halfLife);
  const totalWeight = samples.reduce((sum, x) => sum + weight(x.ts), 0);
  const sampleMean = samples.reduce((sum, x) => sum + x.value * weight(x.ts), 0) / totalWeight;
  const variance = samples.reduce((sum, x) => sum + (x.value - sampleMean) ** 2 * weight(x.ts), 0) / totalWeight;
  const mu = Math.max(0.01, Math.min(80, expected));
  const dispersion = variance > sampleMean + 0.05
    ? Math.max(0.2, Math.min(100, sampleMean ** 2 / (variance - sampleMean)))
    : Infinity;
  let p = dispersion === Infinity ? Math.exp(-mu) : Math.pow(dispersion / (dispersion + mu), dispersion);
  let below = 0, mass = 0;
  for (let count = 0; count <= 100; count++) {
    if (count <= line) below += p;
    mass += p;
    p *= dispersion === Infinity
      ? mu / (count + 1)
      : ((count + dispersion) / (count + 1)) * (mu / (mu + dispersion));
  }
  return mass ? Math.max(0, Math.min(100, (1 - below / mass) * 100)) : null;
}

// ── Comparación con la media de la liga (±10%) ──
export type Tone = "up" | "flat" | "down" | "none";
export function tone(v: number | null, ref: number | null): Tone {
  if (v === null || ref === null || ref === 0) return "none";
  const r = v / ref;
  return r >= 1.1 ? "up" : r <= 0.9 ? "down" : "flat";
}
export const pctTone = (v: number | null): Tone => (v === null ? "none" : v >= 65 ? "up" : v <= 35 ? "down" : "flat");
