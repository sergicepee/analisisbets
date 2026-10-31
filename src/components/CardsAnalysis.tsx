"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { I18nText } from "@/components/I18nProvider";
import { Shield } from "@/components/Shield";
import { IconCard } from "@/components/icons";
import { expectedFor, MIN_SAMPLES } from "@/lib/metrics";
import type { Fixture, LeagueCardLeader, TeamProfile, TeamRef, TeamRow } from "@/lib/types";

type CardRow = {
  key: string;
  label: ReactNode;
  home: number | null;
  away: number | null;
  mean: number | null;
  kind: "percent" | "number";
};

const MATCH_LINES = [2.5, 3.5, 4.5, 5.5, 6.5];
const TEAM_LINES = [0.5, 1.5, 2.5];
const numberText = (value: number | null, locale: string) =>
  value === null ? "—" : value.toLocaleString(locale, { maximumFractionDigits: 1 });
const percentText = (value: number | null) => value === null ? "—" : `${Math.round(value)}%`;

function cardValue(row: TeamRow, side: "for" | "against"): number | null {
  const value = (side === "for" ? row.sFor : row.sAgainst)?.cards;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function average(
  rows: TeamRow[],
  selector: (row: TeamRow) => number | null,
  sampleSize: number,
): number | null {
  const values = rows.slice(-sampleSize).map(selector).filter((value): value is number => value !== null);
  if (values.length < MIN_SAMPLES) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(
  rows: TeamRow[],
  selector: (row: TeamRow) => number | null,
  line: number,
  sampleSize: number,
): number | null {
  const values = rows.slice(-sampleSize).map(selector).filter((value): value is number => value !== null);
  if (values.length < MIN_SAMPLES) return null;
  return values.filter((value) => value > line).length * 100 / values.length;
}

function mean(home: number | null, away: number | null) {
  return home === null || away === null ? null : (home + away) / 2;
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

function ValueCell({ value, kind, locale, last = false }: {
  value: number | null; kind: CardRow["kind"]; locale: string; last?: boolean;
}) {
  const tone = value === null ? "bg-bg text-muted"
    : kind === "number" ? "bg-bg text-fg"
      : value >= 65 ? "bg-statGreen/20 text-statGreen"
        : value >= 40 ? "bg-statOrange/20 text-statOrange" : "bg-statRed/15 text-statRed";
  return (
    <td className={`bg-card2 px-1 py-1 text-center ${last ? "rounded-r-lg" : ""}`}>
      <span className={`flex min-h-9 w-full items-center justify-center rounded-lg px-1 text-xs font-bold tabular-nums sm:text-sm ${tone}`}>
        {kind === "percent" ? percentText(value) : numberText(value, locale)}
      </span>
    </td>
  );
}

function CardTable({ firstColumn, home, away, rows, locale }: {
  firstColumn: string; home: TeamRef; away: TeamRef; rows: CardRow[]; locale: string;
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
            <th scope="col" className="rounded-r-md bg-card2 px-1 py-2 text-center font-semibold"><I18nText text="Media" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="rounded-l-lg bg-card2 px-2 py-2 text-left font-medium leading-tight">{row.label}</th>
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

function Tabs<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full border border-line bg-card2 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-w-0 flex-1 rounded-full px-2 py-2 text-[10px] font-bold sm:px-4 sm:text-xs ${value === option.value ? "bg-brand text-slate-950" : "text-muted hover:bg-white/5 hover:text-fg"}`}
        >
          <I18nText text={option.label} />
        </button>
      ))}
    </div>
  );
}

function Summary({
  fixture, homeProfile, awayProfile, sampleSize, leagueAverage, locale,
}: {
  fixture: Fixture; homeProfile: TeamProfile; awayProfile: TeamProfile;
  sampleSize: number; leagueAverage: number | null; locale: string;
}) {
  const [view, setView] = useState<"match" | "team">("match");
  const home = fixture.home, away = fixture.away;
  const expected = expectedFor(homeProfile, awayProfile, "cards");
  const homeAverage = expected?.home ?? average(homeProfile.rows, (row) => cardValue(row, "for"), sampleSize);
  const awayAverage = expected?.away ?? average(awayProfile.rows, (row) => cardValue(row, "for"), sampleSize);
  const expectedTotal = homeAverage === null || awayAverage === null ? null : homeAverage + awayAverage;
  const rows: CardRow[] = view === "match"
    ? [
        ...MATCH_LINES.map((line) => ({
          key: `match-over-${line}`,
          label: <><I18nText text="Más de" /> {numberText(line, locale)}</>,
          home: rate(homeProfile.rows, (row) => {
            const own = cardValue(row, "for"), against = cardValue(row, "against");
            return own === null || against === null ? null : own + against;
          }, line, sampleSize),
          away: rate(awayProfile.rows, (row) => {
            const own = cardValue(row, "for"), against = cardValue(row, "against");
            return own === null || against === null ? null : own + against;
          }, line, sampleSize),
          mean: null,
          kind: "percent" as const,
        })).map((row) => ({ ...row, mean: mean(row.home, row.away) })),
      ]
    : [
        {
          key: "team-card-average",
          label: <I18nText text="Tarjetas recibidas/partido" />,
          home: average(homeProfile.rows, (row) => cardValue(row, "for"), sampleSize),
          away: average(awayProfile.rows, (row) => cardValue(row, "for"), sampleSize),
          mean: null,
          kind: "number",
        },
        {
          key: "team-opponent-card-average",
          label: <I18nText text="Tarjetas del rival/partido" />,
          home: average(homeProfile.rows, (row) => cardValue(row, "against"), sampleSize),
          away: average(awayProfile.rows, (row) => cardValue(row, "against"), sampleSize),
          mean: null,
          kind: "number",
        },
        ...(["for", "against"] as const).flatMap((side) =>
          TEAM_LINES.map((line) => {
            const sideLabel = side === "for" ? "Tarjetas recibidas" : "Tarjetas del rival";
            return {
              key: `team-${side}-${line}`,
              label: <><I18nText text="Más de" /> {numberText(line, locale)} · <I18nText text={sideLabel} /></>,
              home: rate(homeProfile.rows, (row) => cardValue(row, side), line, sampleSize),
              away: rate(awayProfile.rows, (row) => cardValue(row, side), line, sampleSize),
              mean: null,
              kind: "percent" as const,
            };
          }),
        ),
      ];
  const normalizedRows = rows.map((row) => ({ ...row, mean: row.mean ?? mean(row.home, row.away) }));
  const number = (value: number | null) => value === null ? "—" : value.toLocaleString(locale, { maximumFractionDigits: 1 });
  return (
    <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-extrabold">
          <IconCard className="h-4 w-4 text-brand" />
          <I18nText text="Estadísticas de Tarjetas" />
        </h2>
        <span className="text-xs text-muted"><I18nText text="¿Cuántas tarjetas habrá?" /></span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-card2 p-3">
        {[{ team: home, value: homeAverage }, { team: away, value: awayAverage }].map(({ team, value }, index) => (
          <div key={team.id} className={`${index === 0 ? "col-start-1" : "col-start-3"} row-start-1 flex min-w-0 flex-col items-center gap-1 text-center`}>
            <Shield src={team.logo} alt="" size={25} />
            <span className="w-full truncate text-xs font-semibold">{team.name}</span>
            <span className="text-sm font-extrabold tabular-nums">{number(value)}</span>
            <span className="text-[10px] text-muted"><I18nText text="Tarjetas recibidas/partido" /></span>
          </div>
        ))}
        <div className="col-start-2 row-start-1 text-center text-xs text-muted">
          <I18nText text="Total esperado" />
          <div className="text-lg font-extrabold text-brand tabular-nums">{number(expectedTotal)}</div>
        </div>
      </div>
      <div className="mt-3">
        <Tabs
          value={view}
          onChange={setView}
          label="Desglose de tarjetas"
          options={[{ value: "match", label: "Tarjetas totales" }, { value: "team", label: "Tarjetas del equipo" }]}
        />
      </div>
      <div className="mt-3">
        <CardTable firstColumn="Métrica" home={home} away={away} rows={normalizedRows} locale={locale} />
      </div>
      {view === "match" && leagueAverage !== null && (
        <p className="mt-2 text-[10px] leading-relaxed text-muted">
          <I18nText text="Media de liga" />: {number(leagueAverage)}
        </p>
      )}
    </section>
  );
}

function PlayerLeaders({ home, away, leaders }: { home: TeamRef; away: TeamRef; leaders: LeagueCardLeader[] }) {
  const teams = [home, away];
  const lists = teams.map((team) => leaders
    .filter((leader) => leader.teamId === team.id)
    .sort((a, b) => b.yellowCards + b.redCards - a.yellowCards - a.redCards || a.name.localeCompare(b.name))
    .slice(0, 5));
  const available = lists.some((list) => list.length > 0);
  return (
    <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-sm font-extrabold"><I18nText text="Jugadores con más tarjetas" /></h2>
        <span className="text-xs text-muted"><I18nText text="Amarillas y rojas en la temporada" /></span>
      </div>
      {!available ? (
        <p className="rounded-xl bg-card2 p-3 text-xs leading-relaxed text-muted">
          <I18nText text="No hay datos verificables de tarjetas individuales para esta competición." />
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {teams.map((team, teamIndex) => {
            const players = lists[teamIndex];
            const max = Math.max(1, ...players.map((player) => player.yellowCards + player.redCards));
            return (
              <div key={team.id} className="min-w-0 rounded-xl bg-card2 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Shield src={team.logo} alt="" size={20} />
                  <h3 className="min-w-0 truncate text-xs font-bold">{team.name}</h3>
                </div>
                <ol className="space-y-2">
                  {players.map((player, index) => {
                    const total = player.yellowCards + player.redCards;
                    return (
                      <li key={`${player.id}-${player.teamId}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 truncate text-xs"><span className="mr-1 text-muted">{index + 1}.</span>{player.name}</span>
                        <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums">
                          <span className="rounded-md bg-statOrange/15 px-1.5 py-1 text-statOrange">A {player.yellowCards}</span>
                          <span className="rounded-md bg-statRed/15 px-1.5 py-1 text-statRed">R {player.redCards}</span>
                        </span>
                        <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-bg">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.max(8, total / max * 100)}%` }} />
                        </span>
                      </li>
                    );
                  })}
                  {!players.length && <li className="text-xs text-muted"><I18nText text="No hay datos de jugadores para este equipo." /></li>}
                </ol>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function CardsAnalysis({
  fixture, homeProfile, awayProfile, sampleSize, leagueAverage, leaders, locale,
}: {
  fixture: Fixture;
  homeProfile: TeamProfile;
  awayProfile: TeamProfile;
  sampleSize: number;
  leagueAverage: number | null;
  leaders: LeagueCardLeader[];
  locale: string;
}) {
  return (
    <div className="min-w-0 space-y-3">
      <Summary
        fixture={fixture}
        homeProfile={homeProfile}
        awayProfile={awayProfile}
        sampleSize={sampleSize}
        leagueAverage={leagueAverage}
        locale={locale}
      />
      <PlayerLeaders home={fixture.home} away={fixture.away} leaders={leaders} />
    </div>
  );
}
