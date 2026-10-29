import Link from "next/link";
import { Header } from "@/components/Header";
import { DateNav } from "@/components/DateNav";
import { Flag, Shield } from "@/components/Shield";
import { Notice } from "@/components/ui";
import { getFixtureStatsFor, getFixturesByDate, getPrediction, getTeamProfile } from "@/lib/apifootball";
import { LEAGUE_IDS, MAX_ANALYSIS_FIXTURES, PRIORITY_LEAGUES, hasApiKey } from "@/lib/config";
import { countryEs, dayMonthTime, errMsg, isDate, statusGroup, todayStr } from "@/lib/format";
import { expectedFor, poissonModel, pooledBtts, pooledPct } from "@/lib/metrics";
import type { Fixture, Metric, TeamProfile } from "@/lib/types";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Pick = { f: Fixture; market: "1x2" | "goals" | "btts" | Metric; selection: string; p: number };
type Result = "hit" | "miss" | "void" | "pending";
const EMPTY = (id: number): TeamProfile => ({ teamId: id, rows: [] });
const doneStatus = (f: Fixture) => statusGroup(f) === "finished";

function buildPicks(f: Fixture, a: TeamProfile, b: TeamProfile, pred: Awaited<ReturnType<typeof getPrediction>>): Pick[] {
  const out: Pick[] = [];
  const eg = expectedFor(a, b, "goals") ?? (pred?.last5 ? {
    home: (pred.last5.home.gf + pred.last5.away.ga) / 2,
    away: (pred.last5.away.gf + pred.last5.home.ga) / 2,
  } : null);
  const model = eg ? poissonModel(eg.home, eg.away) : null;
  const p1x2 = pred ?? (model ? { home: model.home, draw: model.draw, away: model.away } : null);
  if (p1x2) {
    out.push({ f, market: "1x2", selection: `${f.home.name} gana`, p: p1x2.home });
    out.push({ f, market: "1x2", selection: "Empate", p: p1x2.draw });
    out.push({ f, market: "1x2", selection: `${f.away.name} gana`, p: p1x2.away });
  }
  if (model) {
    for (const [line, over] of [[1.5, model.over15], [2.5, model.over25]] as [number, number][]) {
      out.push({ f, market: "goals", selection: `Más de ${line} goles`, p: over });
      out.push({ f, market: "goals", selection: `Menos de ${line} goles`, p: 100 - over });
    }
    out.push({ f, market: "btts", selection: "Ambos marcan · Sí", p: model.btts });
    out.push({ f, market: "btts", selection: "Ambos marcan · No", p: 100 - model.btts });
  }
  const lines: Record<Metric, number[]> = { goals: [], shots: [], shotsOn: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5], corners: [4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5], cards: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5] };
  const labels: Partial<Record<Metric, string>> = { shotsOn: "tiros a puerta", corners: "córners", cards: "tarjetas" };
  for (const metric of ["shotsOn", "corners", "cards"] as const) {
    for (const line of lines[metric]) {
      const over = pooledPct(a, b, metric, line);
      if (over === null) continue;
      out.push({ f, market: metric, selection: `Más de ${line} ${labels[metric]}`, p: over });
      out.push({ f, market: metric, selection: `Menos de ${line} ${labels[metric]}`, p: 100 - over });
    }
  }
  return out.filter((p) => Number.isFinite(p.p) && p.p >= 0 && p.p <= 100);
}

function grade(p: Pick, stats: Awaited<ReturnType<typeof getFixtureStatsFor>> | null): Result {
  const { f } = p;
  if (!doneStatus(f)) return "pending";
  if (p.market === "1x2" || p.market === "goals" || p.market === "btts") {
    if (f.goalsHome === null || f.goalsAway === null) return "pending";
    const h = f.goalsHome, a = f.goalsAway, total = h + a;
    let ok = false;
    if (p.market === "1x2") ok = p.selection === "Empate" ? h === a : p.selection === `${f.home.name} gana` ? h > a : a > h;
    if (p.market === "goals") {
      const m = p.selection.match(/(Más|Menos) de ([\d.]+)/);
      if (!m) return "pending";
      const line = Number(m[2]); ok = m[1] === "Más" ? total > line : total < line;
      if (total === line) return "void";
    }
    if (p.market === "btts") ok = p.selection.endsWith("Sí") ? h > 0 && a > 0 : h === 0 || a === 0;
    return ok ? "hit" : "miss";
  }
  if (!stats?.hasData) return "pending";
  const pair = p.market === "corners" ? [stats.home.corners, stats.away.corners]
    : p.market === "cards" ? [stats.home.cards, stats.away.cards]
      : [stats.home.shotsOn, stats.away.shotsOn];
  if (pair[0] === null || pair[1] === null) return "pending";
  const value = pair[0] + pair[1];
  const m = p.selection.match(/(Más|Menos) de ([\d.]+)/);
  if (!m) return "pending";
  const line = Number(m[2]);
  if (value === line) return "void";
  const ok = m[1] === "Más" ? value > line : value < line;
  return ok ? "hit" : "miss";
}

const resultText: Record<Result, string> = { hit: "ACIERTO", miss: "FALLO", void: "DEVOLUCIÓN", pending: "PENDIENTE" };
const resultStyle: Record<Result, string> = {
  hit: "border-win/30 bg-win/10 text-win", miss: "border-loss/30 bg-loss/10 text-loss",
  void: "border-line bg-panel text-muted", pending: "border-line bg-panel text-muted",
};

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const today = todayStr();
  const date = isDate(searchParams.date) ? searchParams.date as string : today;
  let picks: Pick[] = [];
  let error: string | null = null;
  let fixtures: Fixture[] = [];
  try {
    fixtures = await getFixturesByDate(date, date === today);
    fixtures = fixtures.filter((f) => ["upcoming", "finished"].includes(statusGroup(f)) && (LEAGUE_IDS.length ? LEAGUE_IDS.includes(f.leagueId) : PRIORITY_LEAGUES.includes(f.leagueId)));
    fixtures.sort((a, b) => PRIORITY_LEAGUES.indexOf(a.leagueId) - PRIORITY_LEAGUES.indexOf(b.leagueId) || a.timestamp - b.timestamp);
    const eligible = fixtures.slice(0, MAX_ANALYSIS_FIXTURES);
    const candidates = await Promise.all(eligible.map(async (f) => {
      const [a, b, pred] = await Promise.all([
        getTeamProfile(f.home.id, true, f.season).catch(() => EMPTY(f.home.id)),
        getTeamProfile(f.away.id, true, f.season).catch(() => EMPTY(f.away.id)),
        hasApiKey ? getPrediction(f.id).catch(() => null) : Promise.resolve(null),
      ]);
      return buildPicks(f, a, b, pred);
    }));
    const ranked = candidates.flat().sort((a, b) => b.p - a.p);
    const seen = new Set<number>();
    picks = ranked.filter((p) => { if (seen.has(p.f.id)) return false; seen.add(p.f.id); return true; }).slice(0, 3);
  } catch (e) { error = errMsg(e); }

  const grades = await Promise.all(picks.map(async (p) => {
    const stats = doneStatus(p.f) && ["cards", "corners", "shotsOn"].includes(p.market) ? await getFixtureStatsFor(p.f).catch(() => null) : null;
    return grade(p, stats);
  }));

  return (
    <>
      <Header />
      <main className="space-y-4 px-4 pb-8 pt-5 lg:mx-auto lg:max-w-5xl">
        <div>
          <h1 className="text-3xl font-black">Top <span className="text-win">3</span></h1>
          <p className="mt-1 text-sm text-muted">Los tres picks con los porcentajes más altos entre los mercados disponibles.</p>
        </div>
        <DateNav date={date} base="/top3" quick={false} />
        {error && <Notice tone="warn">{error}</Notice>}
        {!error && picks.length === 0 && <Notice>No hay señales calculables para esta fecha en las ligas analizadas.</Notice>}
        {picks.map((k, i) => {
          const result = grades[i];
          const score = k.f.goalsHome !== null && k.f.goalsAway !== null ? `${k.f.goalsHome} - ${k.f.goalsAway}` : null;
          return (
            <Link key={k.f.id} href={`/match/${k.f.id}?date=${date}`} className={`card block p-4 ${result === "miss" ? "border-loss/50" : "border-win/40"}`}>
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-300">
                <span className="flex min-w-0 items-center gap-1.5"><Flag src={k.f.flag} />{countryEs(k.f.country, k.f.flag)} · {k.f.leagueName}</span>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${resultStyle[result]}`}>{resultText[result]}</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl bg-win/20 text-lg font-black text-win">#{i + 1}</div>
                <div className="flex flex-1 items-center justify-around gap-1 text-center text-sm font-bold">
                  <div className="flex min-w-0 flex-col items-center gap-1"><Shield src={k.f.home.logo} alt="" size={40} /><span className="line-clamp-2">{k.f.home.name}</span></div>
                  <span className="shrink-0 text-xs text-muted">VS</span>
                  <div className="flex min-w-0 flex-col items-center gap-1"><Shield src={k.f.away.logo} alt="" size={40} /><span className="line-clamp-2">{k.f.away.name}</span></div>
                </div>
              </div>
              <div className="mt-2 text-center text-xs text-muted">{dayMonthTime(k.f.timestamp)}</div>
              <div className="mt-3 rounded-xl border border-line bg-bg/60 p-3">
                <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-bold uppercase tracking-wider text-muted">{k.market === "1x2" ? "Ganador" : k.market === "btts" ? "Ambos marcan" : k.market === "goals" ? "Goles" : k.market === "corners" ? "Córners" : k.market === "cards" ? "Tarjetas" : "Tiros a puerta"}</span><b className="text-2xl font-black text-win">{Math.round(k.p)}%</b></div>
                <div className="mt-1 text-base font-extrabold">{k.selection}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-win" style={{ width: `${k.p}%` }} /></div>
                {result !== "pending" && score && <div className="mt-2 text-sm font-bold text-muted">Resultado final: <span className="text-white">{score}</span></div>}
                {result === "pending" && doneStatus(k.f) && <div className="mt-2 text-xs text-muted">Resultado estadístico pendiente de actualizar.</div>}
              </div>
            </Link>
          );
        })}
        <Notice>
          Los picks se eligen comparando las probabilidades de 1X2, goles, ambos marcan y estadísticas disponibles de tiros a puerta, córners y tarjetas. Los picks históricos se recalculan con los datos recientes disponibles; PICKZONE todavía no guarda un registro diario congelado de las recomendaciones originales.
        </Notice>
      </main>
    </>
  );
}
