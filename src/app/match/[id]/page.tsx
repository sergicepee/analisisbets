import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { t } from "@/lib/i18n";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MatchList } from "@/components/MatchList";
import { Workspace } from "@/components/Workspace";
import { Flag, Shield } from "@/components/Shield";
import { IconBall, IconBars, IconCard, IconCorner, IconNet, IconShoe, IconSwap, IconTarget } from "@/components/icons";
import { Notice, Panel, StatCard, TeamPair, TrendTable, type TrendRow } from "@/components/ui";
import { getFixture, getLeagueAverages, getPrediction, getTeamProfile } from "@/lib/apifootball";
import { FORM_MATCHES } from "@/lib/config";
import { countryEs, errMsg, friendlyApiError, fullDateTime, isDate, num, pct, statusGroup, timeStr, todayStr } from "@/lib/format";
import {
  LINES, avg2, bttsPct, expectedFor, halfExpected, halfGoalPct, matchOverPct, ownPct, pctTone, poissonModel, pooledBtts, pooledPct, teamAvg, tone, trendPct,
} from "@/lib/metrics";
import type { Fixture, LeagueAvg, Metric, TeamProfile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABS = [["general", "General", IconBars], ["goles", "Goles", IconBall], ["tiros", "Tiros", IconTarget], ["corners", "Esquinas", IconCorner], ["tarjetas", "Tarjetas", IconCard]] as const;
/** Goles esperados: con nuestros datos si hay; si no, con las medias que da la predicción de la API. */
function goalsExpected(pa: TeamProfile, pb: TeamProfile, pred: Awaited<ReturnType<typeof getPrediction>>) {
  const own = expectedFor(pa, pb, "goals");
  if (own) return { ...own, fromPrediction: false };
  const l = pred?.last5;
  if (!l) return null;
  const home = (l.home.gf + l.away.ga) / 2, away = (l.away.gf + l.home.ga) / 2;
  return { home, away, total: home + away, fromPrediction: true };
}
const EMPTY = (id: number): TeamProfile => ({ teamId: id, rows: [] });

export default async function MatchPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const tab = TABS.some((t) => t[0] === searchParams.tab) ? (searchParams.tab as string) : "general";
  const date = isDate(searchParams.date) ? (searchParams.date as string) : todayStr();

  let f: Fixture | null = null;
  try { f = await getFixture(id); } catch (e) {
    return <><Header back={`/?date=${date}`} /><main className="p-4"><Notice tone="warn">No se pudo cargar el partido: {errMsg(e)}</Notice></main></>;
  }
  if (!f) notFound();

  const needStats = tab !== "goles";
  let profileErr: string | null = null;
  const grab = (p: Promise<TeamProfile>) => p.catch((e) => { profileErr = profileErr ?? errMsg(e); return null; });
  const [pa0, pb0] = await Promise.all([
    grab(getTeamProfile(f.home.id, needStats, f.season, f.timestamp, f.leagueId)),
    grab(getTeamProfile(f.away.id, needStats, f.season, f.timestamp, f.leagueId)),
  ]);
  const pa = pa0 ?? EMPTY(f.home.id), pb = pb0 ?? EMPTY(f.away.id);
  const g = statusGroup(f);

  return (
    <>
      <Header back={`/?date=${date}`} />
      {g === "live" && <AutoRefresh seconds={45} />}
      <Workspace hideListOnMobile list={<MatchList date={date} selectedId={f.id} />}>
      <main className="space-y-4 px-4 pb-8 pt-4 lg:px-0">
        <MatchHeader f={f} pa={pa} pb={pb} />
        <nav className="flex border-b border-line">
          {TABS.map(([key, label, Icon]) => (
            <Link key={key} href={`/match/${id}?tab=${key}&date=${date}`} className={`flex flex-1 flex-col items-center gap-1 border-b-2 py-2 text-xs font-semibold ${tab === key ? "border-brand text-brand" : "border-transparent text-muted"}`}>
              <Icon className="h-4 w-4" />{t(label)}
            </Link>
          ))}
        </nav>
        {!pa0 || !pb0 ? <Notice tone="warn">Algunas estadísticas no se pudieron cargar. {profileErr ? friendlyApiError(profileErr) : "Sin datos suficientes."}</Notice> : null}
        {tab === "general" && <General f={f} pa={pa} pb={pb} />}
        {tab === "goles" && <Goals f={f} pa={pa} pb={pb} />}
        {tab === "tiros" && <Block f={f} pa={pa} pb={pb} metrics={["shots", "shotsOn"]} />}
        {tab === "corners" && <Block f={f} pa={pa} pb={pb} metrics={["corners"]} />}
        {tab === "tarjetas" && <Block f={f} pa={pa} pb={pb} metrics={["cards"]} />}
      </main>
      </Workspace>
    </>
  );
}

// ───────────── Cabecera ─────────────
function MatchHeader({ f, pa, pb }: { f: Fixture; pa: TeamProfile; pb: TeamProfile }) {
  const g = statusGroup(f);
  const score = f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome} - ${f.goalsAway}` : null;
  const goals = f.events.filter((e) => e.type === "Goal" && e.detail !== "Missed Penalty");
  const scorer = (e: Fixture["events"][number]) =>
    `${e.player} ${e.minute}${e.extra ? `+${e.extra}` : ""}′${e.detail === "Own Goal" ? " (p.p.)" : e.detail === "Penalty" ? " (p)" : ""}`;
  const forHome = goals.filter((e) => (e.detail === "Own Goal" ? e.teamId === f.away.id : e.teamId === f.home.id));
  const forAway = goals.filter((e) => (e.detail === "Own Goal" ? e.teamId === f.home.id : e.teamId === f.away.id));
  return (
    <section className="card p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-brand"><Flag src={f.flag} />{countryEs(f.country, f.flag)} · {f.leagueName}{f.round ? ` · ${f.round}` : ""}</div>
      <div className="mt-1 text-xs text-muted">{fullDateTime(f.timestamp)}{f.venue ? ` · ${f.venue}` : ""}</div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <TeamCol name={f.home.name} logo={f.home.logo} role={t("Local")} p={pa} />
        <div className="shrink-0 text-center">
          {g === "live" ? (<><div className="text-lg font-extrabold text-loss">{f.statusShort === "HT" ? "HT" : `${f.elapsed ?? ""}′`}</div><div className="text-3xl font-black text-loss">{score}</div></>)
            : g === "finished" ? (<><div className="text-3xl font-black">{score}</div><div className="mt-1 rounded-full border border-line px-3 py-0.5 text-xs text-muted">{f.statusShort}</div></>)
            : (<><div className="text-sm font-bold text-muted">VS</div><div className="mt-2 rounded-full border border-line px-3 py-1 text-xs text-muted">{timeStr(f.timestamp)} · {f.statusShort}</div></>)}
        </div>
        <TeamCol name={f.away.name} logo={f.away.logo} role={t("Visitante")} p={pb} />
      </div>
      {(forHome.length > 0 || forAway.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-muted">
          <div className="space-y-0.5">{forHome.map((e, i) => <div key={i}>{scorer(e)}</div>)}</div>
          <div className="space-y-0.5 text-right">{forAway.map((e, i) => <div key={i}>{scorer(e)}</div>)}</div>
        </div>
      )}
    </section>
  );
}
function TeamCol({ name, logo, role, p }: { name: string; logo: string | null; role: string; p: TeamProfile }) {
  const form = p.rows.slice(-5);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <Shield src={logo} alt={name} size={52} />
      <div className="max-w-full truncate text-lg font-extrabold">{name}</div>
      <div className="text-[11px] text-muted">{role}</div>
      <div className="mt-1 flex gap-1">
        {form.map((r, i) => (
          <span key={i} className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-black ${r.result === "W" ? "bg-win" : r.result === "D" ? "bg-warn" : "bg-loss"}`}>{r.result}</span>
        ))}
      </div>
    </div>
  );
}

// ───────────── General ─────────────
async function General({ f, pa, pb }: { f: Fixture; pa: TeamProfile; pb: TeamProfile }) {
  const ownGoalEstimate = expectedFor(pa, pb, "goals");
  const [pred, lavg] = await Promise.all([
    ownGoalEstimate ? Promise.resolve(null) : getPrediction(f.id).catch(() => null),
    getLeagueAverages(f.leagueId, f.season).catch(() => null),
  ]);
  const eg = ownGoalEstimate ? { ...ownGoalEstimate, fromPrediction: false } : goalsExpected(pa, pb, pred);
  const model = eg ? poissonModel(eg.home, eg.away) : null;
  const p1x2 = model ?? pred;
  const ex = (m: Metric) => expectedFor(pa, pb, m)?.total ?? null;
  const L = lavg;

  const prob = (label: string, Icon: typeof IconNet, v: number | null, ref: number | null | undefined) => (
    <StatCard label={label} Icon={Icon} value={pct(v)} fill={v ?? 0} tone={ref != null ? tone(v, ref) : pctTone(v)} refValue={ref != null ? pct(ref) : null} />
  );
  const avgc = (label: string, Icon: typeof IconNet, v: number | null, ref: number | null | undefined, d = 1) => (
    <StatCard label={label} Icon={Icon} value={num(v, d)} fill={v !== null && ref ? (v / (ref * 2)) * 100 : v !== null ? 40 : 0} tone={tone(v, ref ?? null)} refValue={ref != null ? num(ref, 1) : null} />
  );

  return (
    <div className="space-y-4">
      <Notice>{t("Estimaciones previas al partido; no hay probabilidades en directo. Se ponderan más los partidos recientes y se separa el rendimiento en casa y fuera. Son estimaciones estadísticas, no garantías.")}</Notice>
      {eg?.fromPrediction && <Notice>Goles estimados con la media de los últimos {pred?.last5?.home.n ?? 5} partidos de cada equipo según API-Football (no hay estadísticas propias disponibles).</Notice>}
      {p1x2 ? (
        <div>
          <div className="mb-1.5 flex justify-between text-sm font-bold">
            <span>{f.home.name} <span className="text-brand">{Math.round(p1x2.home)}%</span></span>
            <span className="text-sky-400">{t("Empate")} {Math.round(p1x2.draw)}%</span>
            <span>{f.away.name} <span className="text-slate-300">{Math.round(p1x2.away)}%</span></span>
          </div>
          <div className="flex h-7 overflow-hidden rounded-full">
            <div className="bg-win" style={{ width: `${p1x2.home}%` }} />
            <div className="bg-drawbar" style={{ width: `${p1x2.draw}%` }} />
            <div className="bg-slate-400/70" style={{ width: `${p1x2.away}%` }} />
          </div>
          {!model && pred?.advice && <p className="mt-2 text-xs text-muted">Consejo de API-Football: {pred.advice}</p>}
        </div>
      ) : <Notice tone="warn">Datos insuficientes para estimar el 1X2 (pocos partidos recientes o cobertura limitada).</Notice>}

      <h2 className="pt-1 font-bold">{t("Probabilidades clave")}</h2>
      <div className="grid grid-cols-2 gap-3">
        {prob(t("Más de 2,5 goles"), IconShoe, model?.over25 ?? null, L?.over25)}
        {prob(t("Más de 1,5 goles"), IconShoe, model?.over15 ?? null, L?.over15)}
        {prob(t("Ambos marcan"), IconSwap, model?.btts ?? null, L?.btts)}
        {avgc(t("Promedio de goles"), IconBall, eg?.total ?? null, L?.goals, 2)}
        {avgc(t("Promedio de tarjetas"), IconCard, ex("cards"), L?.cards)}
        {avgc(t("Promedio de córners"), IconCorner, ex("corners"), L?.corners)}
        {avgc(t("Promedio de tiros"), IconTarget, ex("shots"), L?.shots)}
        {avgc(t("Promedio de tiros a puerta"), IconNet, ex("shotsOn"), L?.shotsOn)}
      </div>
      <p className="text-[11px] leading-snug text-muted">{t("Verde: por encima de la media de la liga (±10%). Ámbar: similar. Rojo: por debajo. Sin media de liga disponible, el color indica solo si el porcentaje es alto (verde), medio (ámbar) o bajo (rojo).")} {FORM_MATCHES} {t("Partidos")}.</p>
    </div>
  );
}

// ───────────── Goles ─────────────
async function Goals({ f, pa, pb }: { f: Fixture; pa: TeamProfile; pb: TeamProfile }) {
  const ownGoalEstimate = expectedFor(pa, pb, "goals");
  const pred = ownGoalEstimate ? null : await getPrediction(f.id).catch(() => null);
  const eg = ownGoalEstimate ? { ...ownGoalEstimate, fromPrediction: false } : goalsExpected(pa, pb, pred);
  const h1 = halfExpected(pa, pb, 1), h2 = halfExpected(pa, pb, 2);
  const goalExpected = expectedFor(pa, pb, "goals");
  const model = goalExpected ? poissonModel(goalExpected.home, goalExpected.away) : null;
  const rows: TrendRow[] = [
    { label: t("Goles esperados"), kind: "num", a: eg?.home ?? null, b: eg?.away ?? null, m: eg?.total ?? null },
    ...LINES.goals.map((l) => ({ label: `${t("Más de")} ${num(l)}`, kind: "pct" as const, a: trendPct(pa, "goals", l), b: trendPct(pb, "goals", l), m: model ? (l === 1.5 ? model.over15 : model.over25) : pooledPct(pa, pb, "goals", l) })),
    { label: t("Ambos equipos marcan"), kind: "pct", a: bttsPct(pa), b: bttsPct(pb), m: model?.btts ?? pooledBtts(pa, pb) },
  ];
  const tp = { homeName: f.home.name, awayName: f.away.name, homeLogo: f.home.logo, awayLogo: f.away.logo, d: 2 };
  return (
    <div className="space-y-4">
      <TeamPair title={t("Goles esperados")} totalLabel={t("Total esperado")} total={eg?.total ?? null} home={eg?.home ?? null} away={eg?.away ?? null} {...tp} />
      <TrendTable title={t("Tendencias de goles")} rows={rows} aName={f.home.name} bName={f.away.name} note={t("Las tendencias recientes ponderan más los partidos nuevos. “Partido” usa el modelo de goles del encuentro.")} />
      <TeamPair title={t("Potencial de gol 1.er tiempo")} totalLabel={`Partidos con gol: ${pct(halfGoalPct(pa, pb, 1))}`} total={h1?.total ?? null} home={h1?.home ?? null} away={h1?.away ?? null} {...tp} />
      <TeamPair title={t("Potencial de gol 2.º tiempo")} totalLabel={`Partidos con gol: ${pct(halfGoalPct(pa, pb, 2))}`} total={h2?.total ?? null} home={h2?.home ?? null} away={h2?.away ?? null} {...tp} />
    </div>
  );
}

// ───────────── Tiros / Córners / Tarjetas ─────────────
const TITLE: Record<string, [string, string, string]> = {
  shots: ["Tiros totales", "Media combinada de tiros", "Tiros"],
  shotsOn: ["Tiros a puerta", "Media combinada de tiros a puerta", "Tiros a puerta"],
  corners: ["Córners", "Media combinada de córners", "Córners"],
  cards: ["Tarjetas", "Total esperado de tarjetas", "Tarjetas"],
};
async function Block({ f, pa, pb, metrics }: { f: Fixture; pa: TeamProfile; pb: TeamProfile; metrics: Metric[] }) {
  const lavg: LeagueAvg | null = await getLeagueAverages(f.leagueId, f.season).catch(() => null);
  const tp = { homeName: f.home.name, awayName: f.away.name, homeLogo: f.home.logo, awayLogo: f.away.logo };
  const tm = metrics[metrics.length - 1];
  const exp = expectedFor(pa, pb, tm);
  const rows: TrendRow[] = [
    { label: `Promedio de ${TITLE[tm][2].toLowerCase()}`, kind: "num", a: teamAvg(pa, tm, "for"), b: teamAvg(pb, tm, "for"), m: exp?.total ?? null },
    ...LINES[tm].map((l) => ({ label: `${t("Más de")} ${num(l)}`, kind: "pct" as const, a: ownPct(pa, tm, l), b: ownPct(pb, tm, l), m: matchOverPct(pa, pb, tm, l) })),
  ];
  const noData = metrics.every((m) => expectedFor(pa, pb, m) === null);
  return (
    <div className="space-y-4">
      {noData && <Notice tone="warn">Sin estadísticas suficientes para este partido: la liga puede no tener cobertura de estadísticas de partido, o la cuota de la API está agotada.</Notice>}
      {metrics.map((m) => {
        const e = expectedFor(pa, pb, m);
        return <TeamPair key={m} title={t(TITLE[m][0])} totalLabel={t(TITLE[m][1])} total={e?.total ?? null} home={e?.home ?? null} away={e?.away ?? null} {...tp} />;
      })}
      {lavg && lavg[tm] != null && <Notice>Media de liga (por partido, {lavg.n} partidos guardados): <b className="text-brand">{num(lavg[tm], 1)}</b></Notice>}
      {LINES[tm].length > 0 && (
        <TrendTable
          title={t(`Tendencias de ${TITLE[tm][0].toLowerCase()}`)} rows={rows} aName={f.home.name} bName={f.away.name}
          sub={`${TITLE[tm][2]} del equipo`} totalHead="Total del partido"
          note={t("Las columnas de equipo ponderan más los partidos recientes. El total del partido se estima con la producción de cada equipo y lo que concede el rival.")}
        />
      )}
      <Panel title={t("Cómo se calcula")}>
        <p className="text-xs leading-relaxed text-muted">Valor esperado de cada equipo = media entre lo que produce habitualmente y lo que el rival suele conceder. El total es la suma. Son estimaciones sobre una muestra pequeña: úsalas como contexto, no como certeza.</p>
      </Panel>
    </div>
  );
}
