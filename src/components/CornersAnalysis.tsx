"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { I18nText } from "@/components/I18nProvider";
import { Shield } from "@/components/Shield";
import { IconCorner } from "@/components/icons";
import { PeriodTabs } from "@/components/PeriodTabs";
import { expectedFor, MIN_SAMPLES, profileForPeriod } from "@/lib/metrics";
import type { Fixture, MatchPeriod, TeamProfile, TeamRow, TeamRef } from "@/lib/types";

type CornerRow = {
  key: string;
  label: ReactNode;
  home: number | null;
  away: number | null;
  mean: number | null;
  kind: "percent" | "number";
};
const MATCH_LINES = Array.from({ length: 8 }, (_, index) => index + 6);
const TEAM_LINES = [2.5, 3.5, 4.5];
const formatNumber = (value: number | null, locale: string) =>
  value === null ? "—" : value.toLocaleString(locale, { maximumFractionDigits: 1 });
const formatPercent = (value: number | null) => value === null ? "—" : `${Math.round(value)}%`;

function cornerValue(row: TeamRow, side: "for" | "against"): number | null {
  const value = (side === "for" ? row.sFor : row.sAgainst)?.corners;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(rows: TeamRow[], selector: (row: TeamRow) => number | null, sampleSize: number): number | null {
  const values = rows.slice(-sampleSize).map(selector).filter((value): value is number => value !== null);
  if (values.length < MIN_SAMPLES) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(
  rows: TeamRow[],
  selector: (row: TeamRow) => number | null,
  predicate: (value: number) => boolean,
  sampleSize: number,
): number | null {
  const values = rows.slice(-sampleSize).map(selector).filter((value): value is number => value !== null);
  if (values.length < MIN_SAMPLES) return null;
  return values.filter(predicate).length * 100 / values.length;
}

function matchCorners(row: TeamRow): number | null {
  const own = cornerValue(row, "for");
  const against = cornerValue(row, "against");
  return own === null || against === null ? null : own + against;
}

function matchRows(home: TeamProfile, away: TeamProfile, sampleSize: number): CornerRow[] {
  return MATCH_LINES.map((line) => {
    const homeRate = rate(home.rows, matchCorners, (value) => value > line, sampleSize);
    const awayRate = rate(away.rows, matchCorners, (value) => value > line, sampleSize);
    return {
      key: `match-over-${line}`,
      label: `Más de ${line}`,
      home: homeRate,
      away: awayRate,
      mean: homeRate === null || awayRate === null ? null : (homeRate + awayRate) / 2,
      kind: "percent",
    };
  });
}

function teamRows(home: TeamProfile, away: TeamProfile, sampleSize: number, locale: string): CornerRow[] {
  const rows: CornerRow[] = [
    {
      key: "corners-for-average",
      label: "Córners ganados/partido",
      home: average(home.rows, (row) => cornerValue(row, "for"), sampleSize),
      away: average(away.rows, (row) => cornerValue(row, "for"), sampleSize),
      mean: null,
      kind: "number",
    },
    {
      key: "corners-against-average",
      label: "Córners en contra/partido",
      home: average(home.rows, (row) => cornerValue(row, "against"), sampleSize),
      away: average(away.rows, (row) => cornerValue(row, "against"), sampleSize),
      mean: null,
      kind: "number",
    },
  ];
  for (const [side, label] of [["for", "Córners ganados"], ["against", "Córners en contra"]] as const) {
    for (const line of TEAM_LINES) {
      rows.push({
        key: `corners-${side}-over-${line}`,
        label: <><I18nText text="Más de" /> {formatNumber(line, locale)} · <I18nText text={label} /></>,
        home: rate(home.rows, (row) => cornerValue(row, side), (value) => value > line, sampleSize),
        away: rate(away.rows, (row) => cornerValue(row, side), (value) => value > line, sampleSize),
        mean: null,
        kind: "percent",
      });
    }
  }
  return rows.map((row) => ({
    ...row,
    mean: row.mean ?? (row.home === null || row.away === null ? null : (row.home + row.away) / 2),
  }));
}

function Table({
  firstColumn, home, away, rows, locale,
}: {
  firstColumn: string; home: TeamRef; away: TeamRef; rows: CornerRow[]; locale: string;
}) {
  return (
    <div className="min-w-0">
      <table className="w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-[3px] text-[9px] sm:text-xs">
          <colgroup><col style={{ width: "38%" }} /><col style={{ width: "21%" }} /><col style={{ width: "21%" }} /><col style={{ width: "20%" }} /></colgroup>
          <thead>
            <tr className="text-muted">
              <th scope="col" className="rounded-l-md bg-card2 px-2 py-2 text-left font-semibold"><I18nText text={firstColumn} /></th>
              <TeamHeader team={home} />
              <TeamHeader team={away} />
              <th scope="col" className="rounded-r-md bg-card2 px-1 py-2 text-center font-semibold"><I18nText text="Medio" /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="rounded-l-lg bg-card2 px-2 py-2 text-left font-medium leading-tight">
                  {typeof row.label === "string" ? <I18nText text={row.label} /> : row.label}
                </th>
                <ValueCell value={row.home} kind={row.kind} locale={locale} />
                <ValueCell value={row.away} kind={row.kind} locale={locale} />
                <ValueCell value={row.mean} kind={row.kind} locale={locale} last />
              </tr>
            ))}
          </tbody>
        </table>
    </div>
  );
}

function TeamHeader({ team }: { team: TeamRef }) {
  return (
    <th scope="col" className="bg-card2 px-1 py-2 text-center font-semibold">
      <span className="flex min-w-0 flex-col items-center gap-1">
        <Shield src={team.logo} alt="" size={18} />
        <span className="w-full truncate">{team.name}</span>
      </span>
    </th>
  );
}

function ValueCell({
  value, kind, locale, last = false,
}: { value: number | null; kind: CornerRow["kind"]; locale: string; last?: boolean }) {
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

function CornerSummary({
  home, away, homeProfile, awayProfile, sampleSize, locale,
}: {
  home: TeamRef; away: TeamRef; homeProfile: TeamProfile; awayProfile: TeamProfile; sampleSize: number; locale: string;
}) {
  const expected = expectedFor(homeProfile, awayProfile, "corners");
  const homeAvg = expected?.home ?? average(homeProfile.rows, (row) => cornerValue(row, "for"), sampleSize);
  const awayAvg = expected?.away ?? average(awayProfile.rows, (row) => cornerValue(row, "for"), sampleSize);
  const total = homeAvg === null || awayAvg === null ? null : homeAvg + awayAvg;
  const number = (value: number | null) => value === null ? "—" : value.toLocaleString(locale, { maximumFractionDigits: 1 });
  return (
    <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          <IconCorner className="h-4 w-4 text-brand" />
          <I18nText text="Estadísticas de Córners" />
        </h2>
        <span className="text-xs text-muted"><I18nText text="¿Cuántos córners habrá?" /></span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-card2 p-3">
        <TeamAverage team={home} value={homeAvg} label="Córners ganados/partido" format={number} className="col-start-1" />
        <div className="col-start-2 row-start-1 text-center">
          <span className="block text-[10px] text-muted"><I18nText text="Total esperado" /></span>
          <strong className="text-lg font-black tabular-nums text-brand">{number(total)}</strong>
        </div>
        <TeamAverage team={away} value={awayAvg} label="Córners ganados/partido" format={number} className="col-start-3" />
      </div>
    </section>
  );
}

function TeamAverage({
  team, value, label, format, className,
}: { team: TeamRef; value: number | null; label: string; format: (value: number | null) => string; className: string }) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-1 text-center ${className}`}>
      <Shield src={team.logo} alt="" size={25} />
      <span className="w-full truncate text-[10px] font-semibold sm:text-xs">{team.name}</span>
      <strong className="text-base font-extrabold tabular-nums">{format(value)}</strong>
      <span className="text-[9px] leading-tight text-muted"><I18nText text={label} /></span>
    </div>
  );
}

export function CornersAnalysis({
  fixture, homeProfile, awayProfile, sampleSize, leagueAverage, locale,
}: {
  fixture: Fixture; homeProfile: TeamProfile; awayProfile: TeamProfile;
  sampleSize: number; leagueAverage: number | null; locale: string;
}) {
  const [view, setView] = useState<"match" | "team">("match");
  const [period, setPeriod] = useState<MatchPeriod>("full");
  const activeHomeProfile = profileForPeriod(homeProfile, period);
  const activeAwayProfile = profileForPeriod(awayProfile, period);
  const firstTableRows = matchRows(activeHomeProfile, activeAwayProfile, sampleSize);
  const rows = view === "match" ? firstTableRows : teamRows(activeHomeProfile, activeAwayProfile, sampleSize, locale);
  return (
    <div className="min-w-0 space-y-3">
      <PeriodTabs value={period} onChange={setPeriod} label="Periodo de córners" />
      <CornerSummary home={fixture.home} away={fixture.away} homeProfile={activeHomeProfile} awayProfile={activeAwayProfile} sampleSize={sampleSize} locale={locale} />
      <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div role="group" aria-label="Desglose de córners" className="mb-3 flex gap-1 rounded-full border border-line bg-bg/70 p-1">
          {(["match", "team"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`min-w-0 flex-1 rounded-full px-2 py-2 text-[10px] font-bold transition sm:text-xs ${view === option ? "bg-brand text-slate-950" : "text-muted hover:bg-white/5 hover:text-fg"}`}
            >
              <I18nText text={option === "match" ? "Córners totales" : "Córners del equipo"} />
            </button>
          ))}
        </div>
        <Table firstColumn={view === "match" ? "Córners de partido" : "Córners del equipo"} home={fixture.home} away={fixture.away} rows={rows} locale={locale} />
        {view === "match" && leagueAverage !== null && (
          <p className="mt-2 text-[10px] leading-relaxed text-muted"><I18nText text="Media de liga" />: {leagueAverage.toLocaleString(locale, { maximumFractionDigits: 1 })}</p>
        )}
      </section>
    </div>
  );
}
