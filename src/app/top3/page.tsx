import Link from "next/link";
import { Header } from "@/components/Header";
import { DateNav } from "@/components/DateNav";
import { Flag, Shield } from "@/components/Shield";
import { Notice } from "@/components/ui";
import { getFixturesByDate, getPrediction, getTeamProfile } from "@/lib/apifootball";
import { LEAGUE_IDS, MAX_ANALYSIS_FIXTURES, PRIORITY_LEAGUES, hasApiKey } from "@/lib/config";
import { countryEs, dayMonthTime, errMsg, isDate, statusGroup, todayStr } from "@/lib/format";
import { expectedFor, poissonModel } from "@/lib/metrics";
import type { Fixture } from "@/lib/types";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Pick = { f: Fixture; side: "1" | "X" | "2"; p: number; advice: string | null };

async function signal(f: Fixture): Promise<Pick | null> {
  let p1: { home: number; draw: number; away: number } | null = null;
  let advice: string | null = null;
  if (hasApiKey) {
    const pr = await getPrediction(f.id).catch(() => null);
    if (pr) { p1 = pr; advice = pr.advice; }
  } else {
    const [a, b] = await Promise.all([getTeamProfile(f.home.id), getTeamProfile(f.away.id)]);
    const e = expectedFor(a, b, "goals");
    if (e) p1 = poissonModel(e.home, e.away);
  }
  if (!p1) return null;
  const arr: [Pick["side"], number][] = [["1", p1.home], ["X", p1.draw], ["2", p1.away]];
  const [side, p] = arr.sort((x, y) => y[1] - x[1])[0];
  return { f, side, p, advice };
}

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const today = todayStr();
  const date = isDate(searchParams.date) ? (searchParams.date as string) : today;
  let picks: Pick[] = [];
  let error: string | null = null;
  try {
    let fx = await getFixturesByDate(date, date === today);
    fx = fx.filter((f) => statusGroup(f) === "upcoming" && (LEAGUE_IDS.length ? LEAGUE_IDS.includes(f.leagueId) : PRIORITY_LEAGUES.includes(f.leagueId)));
    fx.sort((a, b) => PRIORITY_LEAGUES.indexOf(a.leagueId) - PRIORITY_LEAGUES.indexOf(b.leagueId) || a.timestamp - b.timestamp);
    const res = await Promise.all(fx.slice(0, MAX_ANALYSIS_FIXTURES).map((f) => signal(f).catch(() => null)));
    picks = res.filter((x): x is Pick => !!x).sort((a, b) => b.p - a.p).slice(0, 3);
  } catch (e) { error = errMsg(e); }

  return (
    <>
      <Header />
      <main className="space-y-4 px-4 pb-8 pt-5 lg:mx-auto lg:max-w-3xl">
        <div>
          <h1 className="text-3xl font-black"><span className="text-win">{t("Los 3")}</span> {t("mejores")}</h1>
          <p className="mt-1 text-sm text-muted">Los tres partidos del día con la señal 1X2 más fuerte según nuestro criterio, que se explica abajo.</p>
        </div>
        <DateNav date={date} base="/top3" quick={false} />
        {error && <Notice tone="warn">{error}</Notice>}
        {!error && picks.length === 0 && <Notice>No hay señales calculables para esta fecha (sin partidos próximos en las ligas analizadas o sin datos).</Notice>}
        {picks.map((k, i) => {
          const name = k.side === "1" ? k.f.home.name : k.side === "2" ? k.f.away.name : "Empate";
          return (
            <Link key={k.f.id} href={`/match/${k.f.id}?date=${date}`} className={`card block p-4 ${i === 0 ? "border-win/50" : ""}`}>
              <div className="flex items-center justify-end gap-2 text-xs font-semibold text-slate-300"><Flag src={k.f.flag} />{countryEs(k.f.country, k.f.flag)} · {k.f.leagueName}</div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-14 w-12 shrink-0 items-center justify-center rounded-xl bg-win/20 text-lg font-black text-win">#{i + 1}</div>
                <div className="flex flex-1 items-center justify-around text-center text-sm font-bold">
                  <div className="flex flex-col items-center gap-1"><Shield src={k.f.home.logo} alt="" size={40} />{k.f.home.name}</div>
                  <span className="text-xs text-muted">VS</span>
                  <div className="flex flex-col items-center gap-1"><Shield src={k.f.away.logo} alt="" size={40} />{k.f.away.name}</div>
                </div>
              </div>
              <div className="mt-2 text-center text-xs text-muted">{dayMonthTime(k.f.timestamp)}</div>
              <div className="mt-3 rounded-xl border border-line bg-bg/60 p-3">
                <div className="text-[11px] font-bold tracking-wider text-muted">SEÑAL ESTADÍSTICA</div>
                <div className="mt-1 text-base font-extrabold">{k.side === "X" ? "Empate" : `Gana ${name}`} · <span className="text-brand">{Math.round(k.p)}%</span></div>
                {k.advice && <div className="mt-1 text-xs text-muted">API-Football: {k.advice}</div>}
              </div>
            </Link>
          );
        })}
        <Notice>
          <b>Criterio:</b> entre los partidos próximos de las ligas analizadas (máx. {MAX_ANALYSIS_FIXTURES}), se ordenan por la probabilidad 1X2 más alta
          ({hasApiKey ? "predicciones de API-Football" : "modelo de Poisson sobre datos demo"}). Es una estimación, no una garantía ni un “pick seguro”.
        </Notice>
      </main>
    </>
  );
}
