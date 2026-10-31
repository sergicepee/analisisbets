"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { I18nText } from "@/components/I18nProvider";
import { Shield } from "@/components/Shield";
import { IconLock, IconNet } from "@/components/icons";
import { MIN_SAMPLES } from "@/lib/metrics";
import type { TeamRef, TeamRow } from "@/lib/types";

type History = { team: TeamRef; rows: TeamRow[] };
type GoalRow = { key: string; label: ReactNode; home: number | null; away: number | null; mean?: number | null };
type GoalTab = { key: string; label: string };
type ValueSelector = (row: TeamRow) => number | null;
type Direction = "over" | "under";

const TEAM_LINES = [0.5, 1.5, 2.5, 3.5];
const MATCH_LINES = [0.5, 1.5, 2.5, 3.5, 4.5];
const displayNumber = (value: number, locale: string) => value.toLocaleString(locale, { maximumFractionDigits: 1 });
const displayPercent = (value: number | null) => value === null ? "—" : `${Math.round(value)}%`;

function recentValues(history: History, selector: ValueSelector, sampleSize: number) {
  return history.rows.slice(-sampleSize).map(selector).filter((value): value is number =>
    value !== null && Number.isFinite(value),
  );
}

function percentage(
  history: History,
  selector: ValueSelector,
  predicate: (value: number) => boolean,
  sampleSize: number,
): { value: number; hits: number; total: number } | null {
  const values = recentValues(history, selector, sampleSize);
  if (values.length < MIN_SAMPLES) return null;
  const hits = values.filter(predicate).length;
  return { value: hits * 100 / values.length, hits, total: values.length };
}

function scoredValue(row: TeamRow, period: 0 | 1 | 2): number | null {
  if (period === 0) return row.goalsFor;
  if (row.htFor === null || row.htFor > row.goalsFor) return null;
  return period === 1 ? row.htFor : row.goalsFor - row.htFor;
}

function concededValue(row: TeamRow, period: 0 | 1 | 2): number | null {
  if (period === 0) return row.goalsAgainst;
  if (row.htAgainst === null || row.htAgainst > row.goalsAgainst) return null;
  return period === 1 ? row.htAgainst : row.goalsAgainst - row.htAgainst;
}

function totalGoals(row: TeamRow): number {
  return row.goalsFor + row.goalsAgainst;
}

function halfTotalGoals(row: TeamRow, period: 1 | 2): number | null {
  const forGoals = scoredValue(row, period);
  const againstGoals = concededValue(row, period);
  return forGoals === null || againstGoals === null ? null : forGoals + againstGoals;
}

function thresholdRows(
  home: History,
  away: History,
  selector: ValueSelector,
  lines: number[],
  sampleSize: number,
  locale: string,
  direction: Direction = "over",
  qualifier?: string,
  includeMean = false,
): GoalRow[] {
  return lines.map((line) => {
    const predicate = (value: number) => direction === "over" ? value > line : value < line;
    const homeRate = percentage(home, selector, predicate, sampleSize)?.value ?? null;
    const awayRate = percentage(away, selector, predicate, sampleSize)?.value ?? null;
    return {
      key: `${direction}-${line}-${qualifier ?? ""}`,
      label: <><I18nText text={direction === "over" ? "Más de" : "Menos de"} /> {displayNumber(line, locale)}{qualifier ? <> · <I18nText text={qualifier} /></> : null}</>,
      home: homeRate,
      away: awayRate,
      mean: includeMean && homeRate !== null && awayRate !== null ? (homeRate + awayRate) / 2 : null,
    };
  });
}

function rowPercentage(
  history: History,
  predicate: (row: TeamRow) => boolean,
  sampleSize: number,
): { value: number; hits: number; total: number } | null {
  const rows = history.rows.slice(-sampleSize);
  const available = rows.filter((row) => row.goalsFor !== null && row.goalsAgainst !== null);
  if (available.length < MIN_SAMPLES) return null;
  const hits = available.filter(predicate).length;
  return { value: hits * 100 / available.length, hits, total: available.length };
}

function marketRows(home: History, away: History, sampleSize: number, locale: string, view: "over" | "under"): GoalRow[] {
  if (view === "under") {
    return thresholdRows(home, away, totalGoals, MATCH_LINES, sampleSize, locale, "under", undefined, true);
  }
  const rows = thresholdRows(home, away, totalGoals, MATCH_LINES, sampleSize, locale, "over", undefined, true);
  const predicates: Array<{ key: string; label: string; test: (row: TeamRow) => boolean }> = [
    { key: "btts", label: "AEM", test: (row) => row.goalsFor > 0 && row.goalsAgainst > 0 },
    { key: "btts-win", label: "AEM y gana", test: (row) => row.result === "W" && row.goalsFor > 0 && row.goalsAgainst > 0 },
    { key: "btts-draw", label: "AEM y empate", test: (row) => row.result === "D" && row.goalsFor > 0 && row.goalsAgainst > 0 },
    { key: "btts-over25", label: "AEM y más de 2,5", test: (row) => row.goalsFor > 0 && row.goalsAgainst > 0 && totalGoals(row) > 2.5 },
    { key: "no-btts-over25", label: "AEM no y más de 2,5", test: (row) => !(row.goalsFor > 0 && row.goalsAgainst > 0) && totalGoals(row) > 2.5 },
  ];
  return [...rows, ...predicates.map((item) => {
    const homeRate = rowPercentage(home, item.test, sampleSize)?.value ?? null;
    const awayRate = rowPercentage(away, item.test, sampleSize)?.value ?? null;
    return {
      key: item.key,
      label: <I18nText text={item.label} />,
      home: homeRate,
      away: awayRate,
      mean: homeRate === null || awayRate === null ? null : (homeRate + awayRate) / 2,
    };
  })];
}

function halfMarketRows(home: History, away: History, sampleSize: number, locale: string, period: 1 | 2): GoalRow[] {
  const selector = (row: TeamRow) => halfTotalGoals(row, period);
  const rows = thresholdRows(home, away, selector, [0.5, 1.5, 2.5], sampleSize, locale, "over", undefined, true);
  const makeBttsRate = (history: History) => {
    const values = history.rows.slice(-sampleSize)
      .map((row) => ({ forGoals: scoredValue(row, period), againstGoals: concededValue(row, period) }))
      .filter((item) => item.forGoals !== null && item.againstGoals !== null);
    if (values.length < MIN_SAMPLES) return null;
    const hits = values.filter((item) => item.forGoals !== null && item.againstGoals !== null && item.forGoals > 0 && item.againstGoals > 0).length;
    return hits * 100 / values.length;
  };
  const homeRate = makeBttsRate(home), awayRate = makeBttsRate(away);
  rows.push({
    key: `btts-half-${period}`,
    label: <><I18nText text="AEM" /> · <I18nText text={period === 1 ? "Primer tiempo" : "Segundo tiempo"} /></>,
    home: homeRate,
    away: awayRate,
    mean: homeRate === null || awayRate === null ? null : (homeRate + awayRate) / 2,
  });
  return rows;
}

function valueTone(value: number | null) {
  if (value === null) return "bg-bg text-muted";
  if (value >= 65) return "bg-statGreen/20 text-statGreen";
  if (value >= 45) return "bg-statOrange/20 text-statOrange";
  return "bg-statRed/15 text-statRed";
}

function GoalTable({
  rows, home, away, firstColumn, showMean = false, title, locked = false,
}: {
  rows: GoalRow[]; home: TeamRef; away: TeamRef; firstColumn: string; showMean?: boolean; title?: string; locked?: boolean;
}) {
  return (
    <div className="min-w-0">
      {title && <h4 className="mb-2 text-xs font-bold text-fg"><I18nText text={title} /></h4>}
      <table className="w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-[3px] text-[10px] sm:text-xs">
        <colgroup>
          <col style={{ width: showMean ? "38%" : "42%" }} />
          <col style={{ width: showMean ? "21%" : "29%" }} />
          <col style={{ width: showMean ? "21%" : "29%" }} />
          {showMean && <col style={{ width: "20%" }} />}
        </colgroup>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="rounded-l-md bg-card2 px-2 py-2 text-left font-semibold"><I18nText text={firstColumn} /></th>
            <th scope="col" className="bg-card2 px-1 py-2 text-center font-semibold">
              <span className="flex min-w-0 flex-col items-center gap-1">
                <Shield src={home.logo} alt="" size={18} /><span className="w-full truncate">{home.name}</span>
              </span>
            </th>
            <th scope="col" className={`${showMean ? "" : "rounded-r-md "}bg-card2 px-1 py-2 text-center font-semibold`}>
              <span className="flex min-w-0 flex-col items-center gap-1">
                <Shield src={away.logo} alt="" size={18} /><span className="w-full truncate">{away.name}</span>
              </span>
            </th>
            {showMean && <th scope="col" className="rounded-r-md bg-card2 px-1 py-2 text-center font-semibold"><I18nText text="Medio" /></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="rounded-l-lg bg-card2 px-2 py-2 text-left font-medium leading-tight">{row.label}</th>
              <GoalCell value={row.home} locked={locked} />
              <GoalCell value={row.away} last={!showMean} locked={locked} />
              {showMean && <GoalCell value={row.mean ?? null} last locked={locked} />}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalCell({ value, last = false, locked = false }: { value: number | null; last?: boolean; locked?: boolean }) {
  const tone = locked ? "bg-brand/10 text-brand" : valueTone(value);
  return (
    <td className={`bg-card2 px-1 py-1 text-center ${last ? "rounded-r-lg" : ""}`}>
      <span className={`box-border flex min-h-9 w-full min-w-0 items-center justify-center overflow-hidden rounded-lg px-1 text-xs font-bold tabular-nums sm:text-sm ${tone}`}>
        {locked
          ? <><IconLock className="h-3.5 w-3.5" /><span className="sr-only"><I18nText text="Bloqueado con Premium" /></span></>
          : displayPercent(value)}
      </span>
    </td>
  );
}

function GoalPremiumBanner() {
  return (
    <Link href="/premium" className="flex items-center justify-center gap-2 rounded-xl bg-brand px-3 py-3 text-center text-xs font-extrabold text-black shadow-lg shadow-brand/10">
      <IconLock className="h-4 w-4" />
      <I18nText text="Desbloquea el análisis de goles con Premium" />
    </Link>
  );
}

function SegmentedTabs({
  label, options, selected, onSelect,
}: { label: string; options: GoalTab[]; selected: string; onSelect: (key: string) => void }) {
  return (
    <div aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 rounded-full border border-line bg-bg/70 p-1">
      {options.map((option) => (
        <button key={option.key} type="button" aria-pressed={selected === option.key} onClick={() => onSelect(option.key)}
          className={`min-w-0 rounded-full px-2 py-2 text-[10px] font-bold transition sm:text-xs ${selected === option.key ? "bg-brand text-slate-950" : "text-muted hover:bg-white/5 hover:text-fg"}`}>
          <I18nText text={option.label} />
        </button>
      ))}
    </div>
  );
}

function GoalRatePanel({
  home, away, sampleSize, locale, kind, isSubscriber,
}: { home: History; away: History; sampleSize: number; locale: string; kind: "scored" | "conceded"; isSubscriber: boolean }) {
  const [view, setView] = useState("full");
  const isScored = kind === "scored";
  const getValue = isScored ? scoredValue : concededValue;
  const title = isScored ? "Goles marcados" : "Goles concedidos";
  const subtitle = isScored ? "¿Quién marcará más?" : "¿Quién recibirá goles?";
  const firstColumn = isScored ? "Anotados por juego" : "Concedidos / partido";
  const makeRows = (period: 0 | 1 | 2) => {
    const selector: ValueSelector = (row) => getValue(row, period);
    const rows = thresholdRows(home, away, selector, TEAM_LINES, sampleSize, locale);
    const zeroLabel = isScored ? "Sin marcar" : "Porterías a 0";
    const zero = (history: History) => percentage(history, selector, (value) => value === 0, sampleSize)?.value ?? null;
    rows.push({
      key: `zero-${kind}-${period}`,
      label: <I18nText text={zeroLabel} />,
      home: zero(home),
      away: zero(away),
    });
    return rows;
  };
  const makeLockedRows = (period: 1 | 2): GoalRow[] => [
    ...TEAM_LINES.map((line) => ({
      key: `locked-${kind}-${period}-${line}`,
      label: <><I18nText text="Más de" /> {displayNumber(line, locale)}</>,
      home: null,
      away: null,
    })),
    {
      key: `locked-zero-${kind}-${period}`,
      label: <I18nText text={isScored ? "Sin marcar" : "Porterías a 0"} />,
      home: null,
      away: null,
    },
  ];
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-fg">
          <IconNet className="h-4 w-4 text-brand" />
          <I18nText text={title} />
        </h2>
        <span className="text-xs text-muted"><I18nText text={subtitle} /></span>
      </div>
      <SegmentedTabs label={title} options={[{ key: "full", label: "Partido completo" }, { key: "halves", label: "1T/2T" }]} selected={view} onSelect={setView} />
      {view === "full"
        ? <div className="mt-3"><GoalTable rows={makeRows(0)} home={home.team} away={away.team} firstColumn={firstColumn} /></div>
        : <div className="mt-3 space-y-3">
          {!isSubscriber && <GoalPremiumBanner />}
          <div className="grid gap-3 lg:grid-cols-2">
            {([1, 2] as const).map((period) => (
              <GoalTable
                key={period}
                title={period === 1 ? "1.ª parte" : "2.ª parte"}
                rows={isSubscriber ? makeRows(period) : makeLockedRows(period)}
                home={home.team}
                away={away.team}
                firstColumn={firstColumn}
                locked={!isSubscriber}
              />
            ))}
          </div>
        </div>}
    </section>
  );
}

function OverAemPanel({ home, away, sampleSize, locale, isSubscriber }: {
  home: History; away: History; sampleSize: number; locale: string; isSubscriber: boolean;
}) {
  const [view, setView] = useState("over");
  const rows = view === "halves" ? [] : marketRows(home, away, sampleSize, locale, view === "under" ? "under" : "over");
  const makeLockedRows = (period: 1 | 2): GoalRow[] => [
    ...[0.5, 1.5, 2.5].map((line) => ({
      key: `locked-half-${period}-${line}`,
      label: <><I18nText text="Más de" /> {displayNumber(line, locale)}</>,
      home: null,
      away: null,
      mean: null,
    })),
    {
      key: `locked-btts-half-${period}`,
      label: <><I18nText text="AEM" /> · <I18nText text={period === 1 ? "Primer tiempo" : "Segundo tiempo"} /></>,
      home: null,
      away: null,
      mean: null,
    },
  ];
  return (
    <section className="min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-fg">
          <IconNet className="h-4 w-4 text-brand" />
          <I18nText text="Más/Menos y AEM" />
        </h2>
        <span className="text-xs text-muted"><I18nText text="¿Cuántos goles en este partido?" /></span>
      </div>
      <SegmentedTabs label="Desglose de goles y AEM" options={[
        { key: "over", label: "Goles (Más de)" },
        { key: "halves", label: "1T/2T" },
        { key: "under", label: "Goles (Menos de)" },
      ]} selected={view} onSelect={setView} />
      <div className="mt-3">
        {view === "halves"
          ? <div className="space-y-3">
            {!isSubscriber && <GoalPremiumBanner />}
            <div className="grid gap-3 lg:grid-cols-2">
              {([1, 2] as const).map((period) => (
                <GoalTable
                  key={period}
                  title={period === 1 ? "1.ª parte" : "2.ª parte"}
                  rows={isSubscriber ? halfMarketRows(home, away, sampleSize, locale, period) : makeLockedRows(period)}
                  home={home.team}
                  away={away.team}
                  firstColumn="Goles de la parte"
                  showMean
                  locked={!isSubscriber}
                />
              ))}
            </div>
          </div>
          : <GoalTable rows={rows} home={home.team} away={away.team} firstColumn="Goles del partido" showMean />}
      </div>
    </section>
  );
}

export function GoalsAnalysis({
  home, away, homeRows, awayRows, sampleSize, locale, isSubscriber,
}: { home: TeamRef; away: TeamRef; homeRows: TeamRow[]; awayRows: TeamRow[]; sampleSize: number; locale: string; isSubscriber: boolean }) {
  const homeHistory = { team: home, rows: homeRows };
  const awayHistory = { team: away, rows: awayRows };
  return (
    <div className="min-w-0 space-y-3">
      <GoalRatePanel home={homeHistory} away={awayHistory} sampleSize={sampleSize} locale={locale} kind="scored" isSubscriber={isSubscriber} />
      <GoalRatePanel home={homeHistory} away={awayHistory} sampleSize={sampleSize} locale={locale} kind="conceded" isSubscriber={isSubscriber} />
      <OverAemPanel home={homeHistory} away={awayHistory} sampleSize={sampleSize} locale={locale} isSubscriber={isSubscriber} />
    </div>
  );
}
