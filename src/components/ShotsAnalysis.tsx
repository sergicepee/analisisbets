"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { I18nText } from "@/components/I18nProvider";
import { Shield } from "@/components/Shield";
import { IconTarget } from "@/components/icons";
import { PeriodTabs } from "@/components/PeriodTabs";
import { expectedFor, MIN_SAMPLES, profileForPeriod } from "@/lib/metrics";
import type { Fixture, LeagueAvg, MatchPeriod, TeamProfile, TeamRef, TeamRow } from "@/lib/types";

type ShotMetric = "shots" | "shotsOn";
type Scope = "match" | "team";
type ShotRow = { key: string; label: ReactNode; home: number | null; away: number | null; mean: number | null; kind: "number" | "percent" };

const METRICS: Array<{ key: ShotMetric; matchTitle: string; teamTitle: string }> = [
  { key: "shots", matchTitle: "Tiros totales del partido", teamTitle: "Tiros totales por equipo" },
  { key: "shotsOn", matchTitle: "Tiros a puerta del partido", teamTitle: "Tiros a puerta por equipo" },
];
const LINES: Record<Scope, Record<ShotMetric, number[]>> = {
  match: {
    shots: [18.5, 20.5, 22.5, 24.5, 26.5, 28.5, 30.5, 32.5],
    shotsOn: [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5],
  },
  team: {
    shots: [8.5, 10.5, 12.5, 14.5, 16.5, 18.5],
    shotsOn: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5],
  },
};

const formatNumber = (value: number | null, locale: string) =>
  value === null || !Number.isFinite(value) ? "—" : value.toLocaleString(locale, { maximumFractionDigits: 1 });
const formatPercent = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "—" : `${Math.round(value)}%`;

function shotValue(row: TeamRow, metric: ShotMetric, side: "for" | "against"): number | null {
  const stat = side === "for" ? row.sFor : row.sAgainst;
  if (!stat || typeof stat.shots !== "number" || !Number.isFinite(stat.shots)) return null;
  if (metric === "shots") return stat.shots;
  if (typeof stat.shotsOn !== "number" || !Number.isFinite(stat.shotsOn) || stat.shotsOn > stat.shots) return null;
  return stat.shotsOn;
}

function valueFor(row: TeamRow, metric: ShotMetric, scope: Scope): number | null {
  const own = shotValue(row, metric, "for");
  if (scope === "team") return own;
  const against = shotValue(row, metric, "against");
  return own === null || against === null ? null : own + against;
}

function average(rows: TeamRow[], selector: (row: TeamRow) => number | null, sampleSize: number): number | null {
  const values = rows.slice(-sampleSize).map(selector).filter((value): value is number => value !== null);
  if (values.length < MIN_SAMPLES) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(rows: TeamRow[], selector: (row: TeamRow) => number | null, line: number, sampleSize: number): number | null {
  const values = rows.slice(-sampleSize).map(selector).filter((value): value is number => value !== null);
  if (values.length < MIN_SAMPLES) return null;
  return values.filter((value) => value > line).length * 100 / values.length;
}

function ProjectedTeam({ team, value, label, locale }: {
  team: TeamRef; value: number | null; label: string; locale: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <Shield src={team.logo} alt="" size={24} />
      <span className="w-full truncate text-[10px] font-semibold sm:text-xs">{team.name}</span>
      <strong className="text-lg font-extrabold tabular-nums">{formatNumber(value, locale)}</strong>
      <span className="text-[9px] leading-tight text-muted"><I18nText text={label} /></span>
    </div>
  );
}

function ProjectedMetric({
  fixture, metric, expected, locale,
}: {
  fixture: Fixture; metric: ShotMetric; expected: ReturnType<typeof expectedFor> | null; locale: string;
}) {
  const title = metric === "shots" ? "Tiros totales" : "Tiros a puerta";
  const teamLabel = metric === "shots" ? "Tiros totales/partido" : "Tiros a puerta/partido";
  return (
    <section className="rounded-xl bg-card2 p-3">
      <h3 className="mb-2 text-xs font-bold"><I18nText text={title} /></h3>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <ProjectedTeam team={fixture.home} value={expected?.home ?? null} label={teamLabel} locale={locale} />
        <div className="text-center">
          <span className="block text-[9px] text-muted"><I18nText text="Total esperado" /></span>
          <strong className="block text-lg font-black tabular-nums text-brand">{formatNumber(expected?.total ?? null, locale)}</strong>
        </div>
        <ProjectedTeam team={fixture.away} value={expected?.away ?? null} label={teamLabel} locale={locale} />
      </div>
    </section>
  );
}

function ShotSummary({ fixture, homeProfile, awayProfile, locale }: {
  fixture: Fixture; homeProfile: TeamProfile; awayProfile: TeamProfile; locale: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          <IconTarget className="h-4 w-4 text-brand" />
          <I18nText text="Estadísticas de Tiros" />
        </h2>
        <p className="mt-1 text-xs text-muted"><I18nText text="Proyección por equipo y total del partido" /></p>
      </div>
      <div className="space-y-2">
        <ProjectedMetric fixture={fixture} metric="shots" expected={expectedFor(homeProfile, awayProfile, "shots")} locale={locale} />
        <ProjectedMetric fixture={fixture} metric="shotsOn" expected={expectedFor(homeProfile, awayProfile, "shotsOn")} locale={locale} />
      </div>
    </section>
  );
}

function ShotHeader({ team }: { team: TeamRef }) {
  return (
    <th scope="col" className="bg-card2 px-1 py-2 text-center font-semibold">
      <span className="flex min-w-0 flex-col items-center gap-1">
        <Shield src={team.logo} alt="" size={18} />
        <span className="w-full truncate">{team.name}</span>
      </span>
    </th>
  );
}

function ShotCell({ value, kind, locale, last = false }: {
  value: number | null; kind: ShotRow["kind"]; locale: string; last?: boolean;
}) {
  const tone = value === null ? "bg-bg text-muted"
    : kind === "number" ? "bg-bg text-fg"
      : value >= 65 ? "bg-statGreen/20 text-statGreen"
        : value >= 40 ? "bg-statOrange/20 text-statOrange" : "bg-statRed/15 text-statRed";
  return (
    <td className={`bg-card2 px-1 py-1 text-center ${last ? "rounded-r-lg" : ""}`}>
      <span className={`flex min-h-9 w-full items-center justify-center rounded-lg px-1 text-xs font-bold tabular-nums sm:text-sm ${tone}`}>
        {kind === "percent" ? formatPercent(value) : formatNumber(value, locale)}
      </span>
    </td>
  );
}

function ShotTable({ rows, home, away, locale }: {
  rows: ShotRow[]; home: TeamRef; away: TeamRef; locale: string;
}) {
  return (
    <div className="min-w-0">
      <table className="w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-[3px] text-[9px] sm:text-xs">
        <colgroup><col style={{ width: "38%" }} /><col style={{ width: "21%" }} /><col style={{ width: "21%" }} /><col style={{ width: "20%" }} /></colgroup>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="rounded-l-md bg-card2 px-2 py-2 text-left font-semibold"><I18nText text="Métrica" /></th>
            <ShotHeader team={home} />
            <ShotHeader team={away} />
            <th scope="col" className="rounded-r-md bg-card2 px-1 py-2 text-center font-semibold"><I18nText text="Media" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="rounded-l-lg bg-card2 px-2 py-2 text-left font-medium leading-tight">{row.label}</th>
              <ShotCell value={row.home} kind={row.kind} locale={locale} />
              <ShotCell value={row.away} kind={row.kind} locale={locale} />
              <ShotCell value={row.mean} kind={row.kind} locale={locale} last />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function metricRows(
  metric: ShotMetric,
  scope: Scope,
  home: TeamProfile,
  away: TeamProfile,
  sampleSize: number,
  locale: string,
): ShotRow[] {
  const selector = (row: TeamRow) => valueFor(row, metric, scope);
  const homeAverage = average(home.rows, selector, sampleSize);
  const awayAverage = average(away.rows, selector, sampleSize);
  const rows: ShotRow[] = [{
    key: `${metric}-${scope}-average`,
    label: <I18nText text="Promedio por partido" />,
    home: homeAverage,
    away: awayAverage,
    mean: homeAverage === null || awayAverage === null ? null : (homeAverage + awayAverage) / 2,
    kind: "number",
  }];
  for (const line of LINES[scope][metric]) {
    const homeRate = rate(home.rows, selector, line, sampleSize);
    const awayRate = rate(away.rows, selector, line, sampleSize);
    rows.push({
      key: `${metric}-${scope}-over-${line}`,
      label: <><I18nText text="Más de" /> {line.toLocaleString(locale, { maximumFractionDigits: 1 })}</>,
      home: homeRate,
      away: awayRate,
      mean: homeRate === null || awayRate === null ? null : (homeRate + awayRate) / 2,
      kind: "percent",
    });
  }
  return rows;
}

function LeagueAverage({ leagueAverage, locale }: { leagueAverage: LeagueAvg | null; locale: string }) {
  if (!leagueAverage || (leagueAverage.shots === null && leagueAverage.shotsOn === null)) return null;
  return (
    <p className="mt-3 border-t border-line pt-2 text-[10px] leading-relaxed text-muted">
      <I18nText text="Media de liga" />: {formatNumber(leagueAverage.shots, locale)} <I18nText text="tiros totales" /> · {formatNumber(leagueAverage.shotsOn, locale)} <I18nText text="tiros a puerta" />
    </p>
  );
}

export function ShotsAnalysis({
  fixture, homeProfile, awayProfile, sampleSize, leagueAverage, locale,
}: {
  fixture: Fixture;
  homeProfile: TeamProfile;
  awayProfile: TeamProfile;
  sampleSize: number;
  leagueAverage: LeagueAvg | null;
  locale: string;
}) {
  const [scope, setScope] = useState<Scope>("match");
  const [period, setPeriod] = useState<MatchPeriod>("full");
  const activeHomeProfile = profileForPeriod(homeProfile, period);
  const activeAwayProfile = profileForPeriod(awayProfile, period);
  return (
    <div className="min-w-0 space-y-3">
      <PeriodTabs value={period} onChange={setPeriod} label="Periodo de tiros" />
      <ShotSummary fixture={fixture} homeProfile={activeHomeProfile} awayProfile={activeAwayProfile} locale={locale} />
      <section className="min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-sm font-extrabold"><I18nText text="Tendencias de tiros" /></h2>
          <span className="text-xs text-muted"><I18nText text="Últimos partidos con estadísticas disponibles" /></span>
        </div>
        <div role="group" aria-label="Ámbito de las tendencias de tiros" className="flex gap-1 rounded-full border border-line bg-bg/70 p-1">
          {(["match", "team"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={scope === option}
              onClick={() => setScope(option)}
              className={`min-w-0 flex-1 rounded-full px-3 py-2 text-[10px] font-bold transition sm:text-xs ${scope === option ? "bg-brand text-slate-950" : "text-muted hover:bg-white/5 hover:text-fg"}`}
            >
              <I18nText text={option === "match" ? "Partido" : "Por equipo"} />
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-4">
          {METRICS.map((metric) => (
            <div key={metric.key} className="space-y-2">
              <h3 className="text-xs font-bold sm:text-sm"><I18nText text={scope === "match" ? metric.matchTitle : metric.teamTitle} /></h3>
              <ShotTable
                rows={metricRows(metric.key, scope, activeHomeProfile, activeAwayProfile, sampleSize, locale)}
                home={fixture.home}
                away={fixture.away}
                locale={locale}
              />
            </div>
          ))}
        </div>
        {scope === "match" && period === "full" && <LeagueAverage leagueAverage={leagueAverage} locale={locale} />}
        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          <I18nText text="Las tasas se calculan sobre los últimos" /> {sampleSize} <I18nText text="partidos con estadísticas disponibles y requieren al menos" /> {MIN_SAMPLES}.
        </p>
      </section>
    </div>
  );
}
