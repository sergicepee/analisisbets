"use client";

import { useMemo, useState } from "react";
import type { Metric } from "@/lib/types";
import { Shield } from "./Shield";

export type TeamGamePoint = {
  timestamp: number;
  opponent: string;
  opponentLogo: string | null;
  opponentLogoFallback?: string | null;
  isHome: boolean;
  own: Partial<Record<Metric, number | null>>;
  against: Partial<Record<Metric, number | null>>;
};

const OPTIONS: Array<[Metric, string]> = [
  ["shots", "Tiros"],
  ["shotsOn", "Tiros a puerta"],
  ["goals", "Goles"],
  ["corners", "Córners"],
  ["cards", "Tarjetas"],
];
export function TeamStatsChart({ games }: { games: TeamGamePoint[] }) {
  const [metric, setMetric] = useState<Metric>("shots");
  const [side, setSide] = useState<"own" | "against">("own");
  const [line, setLine] = useState(2.5);
  const recentGames = useMemo(() => games.slice(-10), [games]);
  const values = useMemo(() => recentGames.map((game) => ({
    ...game,
    value: game[side][metric] ?? null,
  })).filter((game): game is typeof game & { value: number } => game.value !== null), [recentGames, metric, side]);
  const chartValues = values;
  const maxValue = Math.max(5, ...values.map((game) => game.value));
  const maxLine = Math.max(5.5, Math.ceil(maxValue - 0.5) + 0.5);
  const adjustedLine = Math.min(maxLine, Math.max(0.5, Math.round(line - 0.5) + 0.5));
  const scale = maxLine;
  const average = values.length ? values.reduce((sum, game) => sum + game.value, 0) / values.length : 0;
  const sorted = values.map((game) => game.value).sort((a, b) => a - b);
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0;
  const hits = values.filter((game) => game.value >= adjustedLine).length;
  const hitRate = values.length ? Math.round((hits / values.length) * 100) : 0;
  const plotHeight = 128;
  const lineBottom = Math.max(0, Math.min(plotHeight, (adjustedLine / scale) * plotHeight));

  return <section className="min-w-0 overflow-hidden p-3 sm:p-4">
    <div role="tablist" aria-label="Estadísticas del equipo" className="-mx-3 flex snap-x snap-mandatory gap-0 overflow-x-auto border-b border-line px-3 scrollbar-none sm:-mx-4 sm:px-4">
      {OPTIONS.slice(0, 3).map(([key, label]) => (
        <MetricTab
          key={key}
          metricKey={key}
          label={label}
          active={metric === key}
          onClick={() => setMetric(key)}
        />
      ))}
      {OPTIONS.slice(3).map(([key, label]) => (
        <MetricTab
          key={key}
          metricKey={key}
          label={label}
          active={metric === key}
          onClick={() => setMetric(key)}
        />
      ))}
    </div>
    <div className="mt-3 flex justify-end">
      <div className="flex gap-1 rounded-lg bg-card2 p-1 text-xs">
        {([["own", "A favor"], ["against", "En contra"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setSide(key)} className={`rounded-md px-2.5 py-1.5 font-semibold ${side === key ? "bg-brand text-black" : "text-muted"}`}>{label}</button>)}
      </div>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-2">
      <div className="min-w-0 rounded-xl bg-bg px-3 py-2.5">
        <div className="truncate text-[9px] font-bold uppercase text-muted">Promedio</div>
        <b className="mt-0.5 block text-xl font-black leading-none">{average.toFixed(2)}</b>
        <div className="mt-1 text-[9px] text-muted">por partido</div>
      </div>
      <div className="min-w-0 rounded-xl bg-bg px-3 py-2.5">
        <div className="truncate text-[9px] font-bold uppercase text-muted">Más de {adjustedLine.toFixed(1)}</div>
        <b className="mt-0.5 block text-xl font-black leading-none">{hitRate}%</b>
        <div className="mt-1 text-[9px] text-muted">{hits}/{values.length} partidos</div>
      </div>
      <div className="min-w-0 rounded-xl bg-bg px-3 py-2.5">
        <div className="truncate text-[9px] font-bold uppercase text-muted">Mediana</div>
        <b className="mt-0.5 block text-xl font-black leading-none">{median.toFixed(1)}</b>
        <div className="mt-1 text-[9px] text-muted">por partido</div>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 text-xs"><label htmlFor="team-stat-line" className="font-semibold">Línea: <span className="text-brand">{adjustedLine.toFixed(1)}</span></label><span className="text-muted">Arrastra para ajustar</span></div>
    <input id="team-stat-line" type="range" min="0.5" max={maxLine} step="1" value={adjustedLine} onChange={(event) => setLine(Number(event.target.value))} className="mt-2 h-2 w-full cursor-pointer accent-brand" />
    <div className="mt-1 flex justify-between text-[10px] text-muted"><span>0.5</span><span>{maxLine.toFixed(1)}</span></div>
    <div className="mt-3 w-full pb-2">
      {chartValues.length ? <div className="relative w-full px-1">
        <div className="mx-auto w-full max-w-[360px] translate-x-4">
          <div className="flex items-start gap-1">
            <div className="relative flex h-[160px] min-w-0 flex-1 items-end gap-[2px] border-b border-line">
          <div
            className="pointer-events-none absolute left-0 right-0 z-20 -translate-y-1/2 border-t-2 border-dashed border-statOrange"
            style={{ top: `${160 - lineBottom}px` }}
          />
          {chartValues.map((game, index) => {
            const barHeight = Math.max(3, (game.value / scale) * plotHeight);
            const passes = game.value >= adjustedLine;
            const nearLine = !passes && adjustedLine - game.value <= 0.5;
            const color = passes ? "bg-statGreen" : nearLine ? "bg-statOrange" : "bg-statRed";
            return <div key={`${game.timestamp}-${index}`} className="relative h-full min-w-0 flex-1">
              <span className="absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold" style={{ bottom: `${barHeight + 4}px` }}>{game.value}</span>
              <div title={`${game.opponent} (${game.isHome ? "Local" : "Visitante"}): ${game.value}`} className={`absolute bottom-0 left-1/2 w-[88%] max-w-7 -translate-x-1/2 rounded-md transition-colors duration-300 ease-in-out ${color}`} style={{ height: `${barHeight}px` }} />
            </div>;
          })}
            </div>
            <div aria-hidden="true" className="pointer-events-none relative h-[160px] w-10 shrink-0">
              <div
                className="absolute left-0 -translate-y-1/2 whitespace-nowrap rounded-md bg-statOrange px-1.5 py-1 text-[10px] font-black leading-none text-black shadow-[0_0_12px_rgba(219,152,56,0.45)]"
                style={{ top: `${160 - lineBottom}px` }}
              >
                {adjustedLine.toFixed(1)}
              </div>
            </div>
          </div>
          <div className="mr-11 flex gap-[2px] pt-1">
            {chartValues.map((game, index) => <div key={`label-${game.timestamp}-${index}`} title={`${game.opponent} · ${game.isHome ? "Local" : "Visitante"} · ${new Date(game.timestamp * 1000).toLocaleDateString()}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <Shield src={game.opponentLogo} fallbackSrc={game.opponentLogoFallback} alt={game.opponent} size={20} />
              <span className="text-[9px] text-muted [writing-mode:vertical-rl]">{dateLabel(game.timestamp)}</span>
            </div>)}
          </div>
        </div>
      </div> : <p className="py-8 text-center text-sm text-muted">No hay datos de esta estadística.</p>}
    </div>
    <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-statGreen"/>Alcanza la línea</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-statOrange"/>A 0.5 de la línea</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-statRed"/>Por debajo</span><span>Últimos {recentGames.length} partidos; se muestran {chartValues.length}</span></div>
  </section>;
}

function MetricTab({
  metricKey,
  label,
  active,
  onClick,
}: {
  metricKey: Metric;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-10 shrink-0 snap-start items-center justify-center border-b-2 px-4 py-2 text-center text-sm font-bold transition-colors ${active ? "border-brand text-fg" : "border-transparent text-muted"}`}
    >
      <span>{label}</span>
    </button>
  );
}

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit" }).format(timestamp * 1000);
}
