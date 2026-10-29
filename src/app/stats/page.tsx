import Link from "next/link";
import { Header } from "@/components/Header";
import { DateNav } from "@/components/DateNav";
import { Flag, Shield } from "@/components/Shield";
import { IconBall, IconCard, IconCorner, IconInfo, IconMax, IconMin, IconNet, IconTarget } from "@/components/icons";
import { Notice } from "@/components/ui";
import { getFixturesByDate, getTeamProfile } from "@/lib/apifootball";
import { LEAGUE_IDS, MAX_ANALYSIS_FIXTURES, PRIORITY_LEAGUES } from "@/lib/config";
import { errMsg, isDate, num, timeStr, todayStr } from "@/lib/format";
import { expectedFor } from "@/lib/metrics";
import type { Fixture, Metric } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const METRICS: [Metric, string, typeof IconBall, string][] = [
  ["goals", "Goles", IconBall, "Promedio esperado de goles entre ambos equipos, según sus partidos recientes."],
  ["shots", "Disparos", IconTarget, "Promedio esperado de tiros totales entre ambos equipos."],
  ["shotsOn", "Tiros a puerta", IconNet, "Promedio esperado de tiros a puerta entre ambos equipos."],
  ["corners", "Córners", IconCorner, "Promedio esperado de córners entre ambos equipos."],
  ["cards", "Tarjetas", IconCard, "Promedio esperado de tarjetas (amarillas y rojas) entre ambos equipos."],
];

const tabOf = (m: Metric) => (m === "goals" ? "goles" : m === "shots" || m === "shotsOn" ? "tiros" : m === "corners" ? "corners" : "tarjetas");

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const today = todayStr();
  const date = isDate(searchParams.date) ? (searchParams.date as string) : today;
  const metric = (METRICS.find((m) => m[0] === searchParams.m)?.[0] ?? "goals") as Metric;
  const dir = searchParams.o === "min" ? "min" : "max";
  const def = METRICS.find((m) => m[0] === metric)!;

  let list: { f: Fixture; v: number }[] = [];
  let analysed = 0, total = 0, error: string | null = null;
  try {
    const all = await getFixturesByDate(date, date === today);
    const cand = all
      .filter((f) => (LEAGUE_IDS.length ? LEAGUE_IDS.includes(f.leagueId) : PRIORITY_LEAGUES.includes(f.leagueId)))
      .sort((a, b) => PRIORITY_LEAGUES.indexOf(a.leagueId) - PRIORITY_LEAGUES.indexOf(b.leagueId) || a.timestamp - b.timestamp)
      .slice(0, MAX_ANALYSIS_FIXTURES);
    total = cand.length;
    const res = await Promise.all(cand.map(async (f) => {
      const [a, b] = await Promise.all([getTeamProfile(f.home.id, metric !== "goals", f.season).catch(() => null), getTeamProfile(f.away.id, metric !== "goals", f.season).catch(() => null)]);
      const e = a && b ? expectedFor(a, b, metric) : null;
      return e ? { f, v: e.total } : null;
    }));
    list = res.filter((x): x is { f: Fixture; v: number } => !!x);
    analysed = list.length;
    list.sort((x, y) => (dir === "max" ? y.v - x.v : x.v - y.v));
  } catch (e) { error = errMsg(e); }

  const q = (m: string, o: string) => `/stats?date=${date}&m=${m}&o=${o}`;
  return (
    <>
      <Header />
      <main className="space-y-4 px-4 pb-8 pt-5 lg:mx-auto lg:max-w-6xl lg:px-8">
        <div>
          <h1 className="text-2xl font-black leading-tight">Mejores coincidencias por valores promedio</h1>
          <p className="mt-1 text-sm text-muted">Encuentra coincidencias con los valores promedio más altos o más bajos en cada métrica.</p>
        </div>
        <DateNav date={date} base="/stats" extra={`&m=${metric}&o=${dir}`} quick={false} />
        <div className="flex rounded-full border border-line bg-card p-1.5">
          {([["max", "Máximo", IconMax], ["min", "Más bajo", IconMin]] as const).map(([o, l, I]) => (
            <Link key={o} href={q(metric, o)} className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold ${dir === o ? "bg-brand text-black" : "text-muted"}`}><I className="h-4 w-4" />{l}</Link>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {METRICS.map(([k, l, I]) => (
            <Link key={k} href={q(k, dir)} className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-center text-[11px] font-semibold ${metric === k ? "border-brand text-brand" : "border-line bg-card text-slate-300"}`}>
              <I className="h-5 w-5" />{l}
            </Link>
          ))}
        </div>
        <div className="flex gap-3 rounded-2xl border border-win/40 bg-win/10 p-4">
          <IconInfo className="h-5 w-5 shrink-0 text-win" />
          <div><div className="font-bold">Promedio de {def[1].toLowerCase()}</div><p className="mt-1 text-sm text-slate-300">{def[3]}</p></div>
        </div>
        {error && <Notice tone="warn">{error}</Notice>}
        <p className="text-xs text-muted">{analysed} de {total} partidos con datos · {date} · actualizado {timeStr(Date.now() / 1000)}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {[list.slice(0, 5), list.slice(5, 10)].map((chunk, ci) => chunk.length > 0 && (
            <div key={ci} className="card divide-y divide-line">
              {chunk.map(({ f, v }, i) => {
                const rank = ci * 5 + i + 1;
                return (
                  <Link key={f.id} href={`/match/${f.id}?date=${date}&tab=${tabOf(metric)}`} className="flex items-center gap-3 p-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card2 text-xs font-bold ${rank <= 3 ? "text-brand" : "text-muted"}`}>{rank}</span>
                    <div className="flex gap-1"><Shield src={f.home.logo} alt="" size={30} /><Shield src={f.away.logo} alt="" size={30} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{f.home.name} contra {f.away.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><Flag src={f.flag} />{f.leagueName}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted">{date === today ? "Hoy" : date}<br />{timeStr(f.timestamp)}</div>
                    <div className="rounded-xl bg-brand px-3 py-2 text-lg font-black text-black">{num(v, 2)}</div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        {!list.length && !error && <Notice>Sin datos suficientes para esta fecha/métrica.</Notice>}
        <Notice>Se analizan como máximo {MAX_ANALYSIS_FIXTURES} partidos por carga para cuidar la cuota de la API. Ajustable con MAX_ANALYSIS_FIXTURES y LEAGUE_IDS.</Notice>
      </main>
    </>
  );
}
