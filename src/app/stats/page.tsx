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
import { I18nText } from "@/components/I18nProvider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const METRICS: [Metric, string, typeof IconBall, string][] = [
  ["goals", "Goles", IconBall, "Promedio esperado de goles entre ambos equipos, según sus partidos recientes."],
  ["shots", "Disparos", IconTarget, "Promedio esperado de tiros totales entre ambos equipos."],
  ["shotsOn", "TAP", IconNet, "Promedio esperado de TAP entre ambos equipos."],
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
      const [a, b] = await Promise.all([getTeamProfile(f.home.id, metric !== "goals", f.season, f.timestamp, f.leagueId, f.home.name).catch(() => null), getTeamProfile(f.away.id, metric !== "goals", f.season, f.timestamp, f.leagueId, f.away.name).catch(() => null)]);
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
          <h1 className="text-2xl font-black leading-tight"><I18nText text="Mejores coincidencias por valores promedio" /></h1>
          <p className="mt-1 text-sm text-muted"><I18nText text="Encuentra coincidencias con los valores promedio más altos o más bajos en cada métrica." /></p>
        </div>
        <DateNav date={date} base="/stats" extra={`&m=${metric}&o=${dir}`} quick={false} />
        <div className="flex rounded-full border border-line bg-card p-1.5">
          {([["max", "Máximo", IconMax], ["min", "Más bajo", IconMin]] as const).map(([o, l, I]) => (
            <Link key={o} href={q(metric, o)} className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold ${dir === o ? "bg-brand text-black" : "text-muted"}`}><I className="h-4 w-4" /><I18nText text={l} /></Link>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {METRICS.map(([k, l, I]) => (
            <Link key={k} href={q(k, dir)} className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-center text-[11px] font-semibold ${metric === k ? "border-brand text-brand" : "border-line bg-card text-slate-300"}`}>
              <I className="h-5 w-5" /><I18nText text={l} />
            </Link>
          ))}
        </div>
        <div className="flex gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-4">
          <IconInfo className="h-5 w-5 shrink-0 text-brand" />
          <div><div className="font-bold"><I18nText text={`Promedio de ${def[1].toLowerCase()}`} /></div><p className="mt-1 text-sm text-slate-300"><I18nText text={def[3]} /></p></div>
        </div>
        {error && <Notice tone="warn">{error}</Notice>}
        <p className="text-xs text-muted">{analysed} <I18nText text="de" /> {total} <I18nText text="partidos con datos" /> · {date} · <I18nText text="actualizado" /> {timeStr(Date.now() / 1000)}</p>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {[list.slice(0, 5), list.slice(5, 10)].map((chunk, ci) => chunk.length > 0 && (
            <div key={ci} className="card min-w-0 divide-y divide-line overflow-hidden">
              {chunk.map(({ f, v }, i) => {
                const rank = ci * 5 + i + 1;
                return (
                  <div key={f.id} className="flex min-w-0 items-center gap-2 p-2.5 sm:gap-3 sm:p-3">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card2 text-[11px] font-bold sm:h-7 sm:w-7 sm:text-xs ${rank <= 3 ? "text-brand" : "text-muted"}`}>{rank}</span>
                    <div className="flex shrink-0 gap-0.5 sm:gap-1"><Shield src={f.home.logo} fallbackSrc={f.home.logoFallback} alt="" size={24} /><Shield src={f.away.logo} fallbackSrc={f.away.logoFallback} alt="" size={24} /></div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/match/${f.id}?date=${date}&league=${f.leagueId}&tab=${tabOf(metric)}`} className="block truncate text-sm font-bold">{f.home.name} <I18nText text="contra" /> {f.away.name}</Link>
                      <Link href={`/liga/${f.leagueId}`} className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted hover:text-brand"><Flag src={f.flag} />{f.leagueName}</Link>
                    </div>
                    <div className="hidden shrink-0 text-right text-xs text-muted sm:block">{date === today ? <I18nText text="Hoy" /> : date}<br />{timeStr(f.timestamp)}</div>
                    <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-brand px-1.5 text-center text-base font-black leading-none text-black sm:h-10 sm:w-auto sm:rounded-xl sm:px-3 sm:text-lg">{num(v, 2)}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {!list.length && !error && <Notice><I18nText text="Sin datos suficientes para esta fecha/métrica." /></Notice>}
      </main>
    </>
  );
}
