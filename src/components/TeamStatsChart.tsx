"use client";

import { useEffect, useMemo, useState } from "react";
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

const OPTIONS: Array<[Metric, string]> = [["goals", "Goles"], ["shots", "Tiros"], ["shotsOn", "TAP"], ["corners", "Córners"], ["cards", "Tarjetas"]];

export function TeamStatsChart({ games }: { games: TeamGamePoint[] }) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [metric, setMetric] = useState<Metric>("corners");
  const [side, setSide] = useState<"own" | "against">("own");
  const [line, setLine] = useState(2.5);
  const values = useMemo(() => games.slice(wide ? -20 : -10).map((game) => ({
    ...game,
    value: game[side][metric] ?? null,
  })).filter((game): game is typeof game & { value: number } => game.value !== null), [games, metric, side, wide]);
  const maxValue = Math.max(5, ...values.map((game) => game.value));
  const scale = Math.ceil(Math.max(maxValue, line) / 5) * 5 || 5;
  const average = values.length ? values.reduce((sum, game) => sum + game.value, 0) / values.length : 0;
  const sorted = values.map((game) => game.value).sort((a, b) => a - b);
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
  const hits = values.filter((game) => game.value >= line).length;
  const hitRate = values.length ? Math.round((hits / values.length) * 100) : 0;
  const plotHeight = 176;
  const lineBottom = Math.min(plotHeight, (line / scale) * plotHeight);

  return <section className="card min-w-0 overflow-hidden p-3 sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-extrabold">{OPTIONS.find(([key]) => key === metric)?.[1]}</h2>
      <div className="flex gap-1 rounded-lg bg-card2 p-1 text-xs">
        {([["own", "A favor"], ["against", "En contra"]] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setSide(key)} className={`rounded-md px-2.5 py-1.5 font-semibold ${side === key ? "bg-brand text-black" : "text-muted"}`}>{label}</button>)}
      </div>
    </div>
    <label className="mt-3 block text-xs font-semibold text-muted">Estadística
      <select value={metric} onChange={(event) => setMetric(event.target.value as Metric)} className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-white outline-none focus:border-brand sm:w-auto sm:min-w-48">
        {OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    <div className="mt-3 grid grid-cols-3 divide-x divide-line rounded-lg bg-bg/70 py-2 text-center">
      <div><div className="text-[10px] text-muted">Tasa de acierto</div><b className="text-sm text-chartHit">{hitRate}%</b></div>
      <div><div className="text-[10px] text-muted">Promedio</div><b className="text-sm">{average.toFixed(1)}</b></div>
      <div><div className="text-[10px] text-muted">Mediana</div><b className="text-sm">{median.toFixed(1)}</b></div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3 text-xs"><label htmlFor="team-stat-line" className="font-semibold">Línea: <span className="text-brand">{line.toFixed(1)}</span></label><span className="text-muted">Arrastra para ajustar</span></div>
    <input id="team-stat-line" type="range" min="0.5" max={Math.max(5, Math.ceil(maxValue * 2) / 2)} step="0.5" value={line} onChange={(event) => setLine(Number(event.target.value))} className="mt-2 h-2 w-full cursor-pointer accent-brand" />
    <div className="mt-1 flex justify-between text-[10px] text-muted"><span>0.5</span><span>{Math.max(5, Math.ceil(maxValue * 2) / 2).toFixed(1)}</span></div>
    <div className="mt-3 w-full pb-2">
      {values.length ? <div className="relative w-full px-1">
        <div className="relative flex h-[176px] w-full items-end gap-1 border-b border-line">
          <div className="pointer-events-none absolute z-20 w-full border-t border-dashed border-yellow-300" style={{ bottom: `${lineBottom}px` }} />
          {values.map((game, index) => {
            const barHeight = Math.max(3, (game.value / scale) * plotHeight);
            const passes = game.value >= line;
            return <div key={`${game.timestamp}-${index}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[10px] font-bold">{game.value}</span>
              <div title={`${game.opponent} (${game.isHome ? "Local" : "Visitante"}): ${game.value}`} className={`w-3/4 max-w-6 rounded-t-sm ${passes ? "bg-chartHit" : "bg-loss"}`} style={{ height: `${barHeight}px` }} />
            </div>;
          })}
        </div>
        <div className="flex gap-1 pt-1">
          {values.map((game, index) => <div key={`label-${game.timestamp}-${index}`} title={`${game.opponent} · ${game.isHome ? "Local" : "Visitante"} · ${new Date(game.timestamp * 1000).toLocaleDateString()}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <Shield src={game.opponentLogo} fallbackSrc={game.opponentLogoFallback} alt={game.opponent} size={20} />
            <span className="text-[9px] text-muted [writing-mode:vertical-rl]">{dateLabel(game.timestamp)}</span>
          </div>)}
        </div>
      </div> : <p className="py-8 text-center text-sm text-muted">No hay datos de esta estadística.</p>}
    </div>
    <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-chartHit"/>Alcanza la línea</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-loss"/>No llega</span><span>Últimos {values.length} partidos</span></div>
  </section>;
}

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit" }).format(timestamp * 1000);
}
