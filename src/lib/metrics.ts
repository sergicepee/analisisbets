import type { Metric, TeamProfile, TeamRow } from "./types";

export const MIN_SAMPLES = 3;
export const METRIC_LABEL: Record<Metric, string> = {
  goals: "Goles", shots: "Tiros", shotsOn: "Tiros a puerta", corners: "Córners", cards: "Tarjetas",
};
/** Líneas (más de X) para las tablas de tendencias, sobre el TOTAL del partido. */
export const LINES: Record<Metric, number[]> = {
  goals: [1.5, 2.5],
  shots: [],
  shotsOn: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5],
  corners: [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5],
  cards: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function rowVal(r: TeamRow, m: Metric, side: "for" | "against"): number | null {
  if (m === "goals") return side === "for" ? r.goalsFor : r.goalsAgainst;
  const s = side === "for" ? r.sFor : r.sAgainst;
  return s ? s[m] : null;
}

/** Media de un equipo (a favor o en contra) en sus últimos partidos. null si hay pocos datos. */
export function teamAvg(p: TeamProfile, m: Metric, side: "for" | "against"): number | null {
  const v = p.rows.map((r) => rowVal(r, m, side)).filter((x): x is number => x !== null);
  return v.length >= MIN_SAMPLES ? mean(v) : null;
}

/**
 * Valor esperado: para cada equipo = media(lo que él produce, lo que el rival concede).
 * Total = suma de ambos equipos.
 */
export function expectedFor(a: TeamProfile, b: TeamProfile, m: Metric) {
  const af = teamAvg(a, m, "for"), aa = teamAvg(a, m, "against");
  const bf = teamAvg(b, m, "for"), ba = teamAvg(b, m, "against");
  if (af === null || aa === null || bf === null || ba === null) return null;
  const home = (af + ba) / 2, away = (bf + aa) / 2;
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
  const t = totals(p, m);
  return t.length >= MIN_SAMPLES ? mean(t) : null;
};
/** % de los últimos partidos del equipo cuyo total superó la línea. */
export function trendPct(p: TeamProfile, m: Metric, line: number): number | null {
  const t = totals(p, m);
  return t.length >= MIN_SAMPLES ? (t.filter((x) => x > line).length / t.length) * 100 : null;
}
export function bttsPct(p: TeamProfile): number | null {
  return p.rows.length >= MIN_SAMPLES
    ? (p.rows.filter((r) => r.goalsFor > 0 && r.goalsAgainst > 0).length / p.rows.length) * 100
    : null;
}
/** % de los partidos propios del equipo en que SU valor (no el total) superó la línea. */
export function ownPct(p: TeamProfile, m: Metric, line: number): number | null {
  const v = p.rows.map((r) => rowVal(r, m, "for")).filter((x): x is number => x !== null);
  return v.length >= MIN_SAMPLES ? (v.filter((x) => x > line).length / v.length) * 100 : null;
}
/** % de los partidos de AMBOS equipos (muestra conjunta) cuyo total superó la línea. */
export function pooledPct(a: TeamProfile, b: TeamProfile, m: Metric, line: number): number | null {
  const t = [...totals(a, m), ...totals(b, m)];
  return t.length >= MIN_SAMPLES * 2 ? (t.filter((x) => x > line).length / t.length) * 100 : null;
}
export function pooledBtts(a: TeamProfile, b: TeamProfile): number | null {
  const rows = [...a.rows, ...b.rows];
  return rows.length >= MIN_SAMPLES * 2 ? (rows.filter((r) => r.goalsFor > 0 && r.goalsAgainst > 0).length / rows.length) * 100 : null;
}
export const avg2 = (a: number | null, b: number | null) => (a === null || b === null ? null : (a + b) / 2);

// ── Goles por mitad ──
function half(r: TeamRow, side: "for" | "against", h: 1 | 2): number | null {
  const ht = side === "for" ? r.htFor : r.htAgainst;
  const ft = side === "for" ? r.goalsFor : r.goalsAgainst;
  if (ht === null) return null;
  return h === 1 ? ht : ft - ht;
}
function halfAvg(p: TeamProfile, side: "for" | "against", h: 1 | 2): number | null {
  const v = p.rows.map((r) => half(r, side, h)).filter((x): x is number => x !== null);
  return v.length >= MIN_SAMPLES ? mean(v) : null;
}
export function halfExpected(a: TeamProfile, b: TeamProfile, h: 1 | 2) {
  const af = halfAvg(a, "for", h), aa = halfAvg(a, "against", h);
  const bf = halfAvg(b, "for", h), ba = halfAvg(b, "against", h);
  if (af === null || aa === null || bf === null || ba === null) return null;
  const home = (af + ba) / 2, away = (bf + aa) / 2;
  return { home, away, total: home + away };
}
/** % de partidos (de ambos equipos) con al menos un gol en esa mitad. */
export function halfGoalPct(a: TeamProfile, b: TeamProfile, h: 1 | 2): number | null {
  const vals: number[] = [];
  for (const p of [a, b])
    for (const r of p.rows) {
      const f = half(r, "for", h), g = half(r, "against", h);
      if (f !== null && g !== null) vals.push(f + g > 0 ? 1 : 0);
    }
  return vals.length >= MIN_SAMPLES * 2 ? (mean(vals) * 100) : null;
}

// ── Modelo de Poisson (estimación, no garantía) ──
function pmf(l: number, n = 11): number[] {
  const out = [Math.exp(-l)];
  for (let k = 1; k < n; k++) out.push((out[k - 1] * l) / k);
  return out;
}
export function poissonModel(lh: number, la: number) {
  const ph = pmf(lh), pa = pmf(la);
  let h = 0, d = 0, a = 0, o15 = 0, o25 = 0, btts = 0, tot = 0;
  for (let i = 0; i < ph.length; i++)
    for (let j = 0; j < pa.length; j++) {
      const p = ph[i] * pa[j];
      tot += p;
      if (i > j) h += p; else if (i === j) d += p; else a += p;
      if (i + j > 1.5) o15 += p;
      if (i + j > 2.5) o25 += p;
      if (i > 0 && j > 0) btts += p;
    }
  const f = (x: number) => (x / tot) * 100;
  return { home: f(h), draw: f(d), away: f(a), over15: f(o15), over25: f(o25), btts: f(btts) };
}

// ── Comparación con la media de la liga (±10%) ──
export type Tone = "up" | "flat" | "down" | "none";
export function tone(v: number | null, ref: number | null): Tone {
  if (v === null || ref === null || ref === 0) return "none";
  const r = v / ref;
  return r >= 1.1 ? "up" : r <= 0.9 ? "down" : "flat";
}
export const pctTone = (v: number | null): Tone => (v === null ? "none" : v >= 65 ? "up" : v <= 35 ? "down" : "flat");
