import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { Header } from "@/components/Header";
import { t } from "@/lib/i18n";
import { I18nText } from "@/components/I18nProvider";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MatchList } from "@/components/MatchList";
import { FollowMatchButton } from "@/components/FollowMatchButton";
import { Workspace } from "@/components/Workspace";
import { Shield } from "@/components/Shield";
import { IconBall, IconBars, IconCard, IconCorner, IconNet, IconNext, IconShoe, IconSwap, IconTarget } from "@/components/icons";
import { Notice, Panel, StatCard, TeamPair, TrendTable, type TrendRow } from "@/components/ui";
import { getFixture, getLeagueAverages, getTeamProfile } from "@/lib/apifootball";
import { getUser } from "@/lib/auth";
import { getCsvStatsForFixture } from "@/lib/csvHistory";
import { getSubscriberAccess } from "@/lib/subscriptions";
import { getFavoriteFixtureIds } from "@/lib/favorites";
import { PremiumLockedPreview } from "@/components/PremiumLockedPreview";
import { apiEnabled, FORM_MATCHES } from "@/lib/config";
import { errMsg, friendlyApiError, isDate, num, pct, statusGroup, timeStr, todayStr } from "@/lib/format";
import { getLeagueLogoUrl } from "@/lib/leagueLogo";
import { getLocale, getTz } from "@/lib/prefs";
import { isNearCsvLiveWindow, isWithinCsvLiveWindow } from "@/lib/fixtureStatus";
import {
  LINES, avg2, bttsPct, expectedFor, halfExpected, halfGoalPct, matchOverPct, ownPct, pctTone, poissonModel, pooledBtts, pooledPct, teamAvg, tone, trendPct,
} from "@/lib/metrics";
import type { Fixture, LeagueAvg, Metric, TeamProfile } from "@/lib/types";

export const dynamic = "force-dynamic";
const OUTCOME_COLORS = {
  home: "#70dfa0",
  draw: "#27ad68",
  away: "#075b38",
} as const;
export const maxDuration = 60;

const TABS = [["general", "General", IconBars], ["goles", "Goles", IconBall], ["tiros", "Tiros", IconTarget], ["corners", "Esquinas", IconCorner], ["tarjetas", "Tarjetas", IconCard]] as const;
const EMPTY = (id: number): TeamProfile => ({ teamId: id, rows: [] });

export default async function MatchPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const tab = TABS.some((t) => t[0] === searchParams.tab) ? (searchParams.tab as string) : "general";
  const date = isDate(searchParams.date) ? (searchParams.date as string) : todayStr();
  const user = await getUser();
  const subscriptionAccess = user ? await getSubscriberAccess(user.id) : { active: false, error: false };
  const isSubscriber = subscriptionAccess.active;
  const premiumLocked = tab !== "general" && !isSubscriber;

  let f: Fixture | null = null;
  try { f = await getFixture(id, Number(searchParams.league) || undefined, date); } catch (e) {
    return <><Header back={`/?date=${date}`} /><main className="p-4"><Notice tone="warn">No se pudo cargar el partido: {errMsg(e)}</Notice></main></>;
  }
  if (!f) notFound();
  const favoriteLookup = user
    ? await getFavoriteFixtureIds(user.id, [f.id])
    : { favoriteIds: new Set<number>(), error: false };

  const needStats = tab !== "goles";
  let profileErr: string | null = null;
  const grab = (p: Promise<TeamProfile>) => p.catch((e) => { profileErr = profileErr ?? errMsg(e); return null; });
  let pa0: TeamProfile | null = null;
  let pb0: TeamProfile | null = null;
  const includeStats = premiumLocked ? false : needStats;
  [pa0, pb0] = await Promise.all([
    grab(getTeamProfile(f.home.id, includeStats, f.season, f.timestamp, f.leagueId, f.home.name)),
    grab(getTeamProfile(f.away.id, includeStats, f.season, f.timestamp, f.leagueId, f.away.name)),
  ]);
  const pa = pa0 ?? EMPTY(f.home.id), pb = pb0 ?? EMPTY(f.away.id);
  const headerPa = pa, headerPb = pb;
  const g = statusGroup(f);
  const csvMatchStats = f.id < 0 ? await getCsvStatsForFixture(f) : null;
  const cardCounts = csvMatchStats
    ? {
        homeYellow: csvMatchStats.yellowHome, homeRed: csvMatchStats.redHome,
        awayYellow: csvMatchStats.yellowAway, awayRed: csvMatchStats.redAway,
      }
    : f.events.reduce((counts, event) => {
        if (event.type !== "Card") return counts;
        const home = event.teamId === f.home.id;
        if (event.detail === "Yellow Card") counts[home ? "homeYellow" : "awayYellow"]++;
        if (event.detail === "Red Card" || event.detail === "Second Yellow Card") counts[home ? "homeRed" : "awayRed"]++;
        return counts;
      }, { homeYellow: 0, homeRed: 0, awayYellow: 0, awayRed: 0 });

  return (
    <>
      <Header back={`/?date=${date}`} />
      {(apiEnabled && g === "live") || (!apiEnabled && isNearCsvLiveWindow(f)) ? <AutoRefresh seconds={apiEnabled ? 45 : 30} /> : null}
      <Workspace hideListOnMobile list={<MatchList date={date} selectedId={f.id} />}>
      <main className="space-y-4 px-3 pb-8 pt-4 sm:px-4 lg:px-0">
        {favoriteLookup.error && <Notice tone="warn"><I18nText text="No se pudieron cargar tus favoritos. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        {subscriptionAccess.error && <Notice tone="warn"><I18nText text="No se pudo verificar tu acceso Premium. Las funciones Premium están bloqueadas hasta que se recupere la conexión." /></Notice>}
        <MatchHeader f={f} pa={headerPa} pb={headerPb} cardCounts={cardCounts} returnTo={`/match/${f.id}?date=${date}&league=${f.leagueId}`} isAuthenticated={!!user} initialFavorite={favoriteLookup.favoriteIds.has(f.id)} />
        <nav className="flex border-b border-line">
          {TABS.map(([key, label, Icon]) => (
            <Link key={key} href={`/match/${id}?tab=${key}&date=${date}&league=${f.leagueId}`} className={`flex flex-1 flex-col items-center gap-1 border-b-2 py-2 text-xs font-semibold ${tab === key ? "border-brand text-brand" : "border-transparent text-muted"}`}>
              <Icon className="h-4 w-4" /><I18nText text={label} />
            </Link>
          ))}
        </nav>
        {!premiumLocked && (!pa0 || !pb0) ? <Notice tone="warn"><I18nText text="Algunas estadísticas no se pudieron cargar." /> {profileErr ? friendlyApiError(profileErr) : <I18nText text="Sin datos suficientes." />}</Notice> : null}
        {tab === "general" && <General f={f} pa={pa} pb={pb} />}
        {premiumLocked && <PremiumLockedPreview tab={tab as "goles" | "tiros" | "corners" | "tarjetas"} home={{ name: f.home.name, logo: f.home.logo }} away={{ name: f.away.name, logo: f.away.logo }} />}
        {!premiumLocked && tab === "goles" && <Goals f={f} pa={pa} pb={pb} />}
        {!premiumLocked && tab === "tiros" && <Block f={f} pa={pa} pb={pb} metrics={["shots", "shotsOn"]} />}
        {!premiumLocked && tab === "corners" && <Block f={f} pa={pa} pb={pb} metrics={["corners"]} />}
        {!premiumLocked && tab === "tarjetas" && <Block f={f} pa={pa} pb={pb} metrics={["cards"]} />}
      </main>
      </Workspace>
    </>
  );
}

// ───────────── Cabecera ─────────────
function MatchHeader({ f, pa, pb, cardCounts, returnTo, isAuthenticated, initialFavorite }: { f: Fixture; pa: TeamProfile; pb: TeamProfile; cardCounts: { homeYellow: number; homeRed: number; awayYellow: number; awayRed: number }; returnTo: string; isAuthenticated: boolean; initialFavorite: boolean }) {
  const g = statusGroup(f);
  const csvLive = f.id < 0 && isWithinCsvLiveWindow(f);
  const score = f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome} - ${f.goalsAway}` : null;
  const halftimeScore = f.htHome !== null && f.htAway !== null ? `${f.htHome} - ${f.htAway}` : null;
  const goals = f.events.filter((e) => e.type === "Goal" && e.detail !== "Missed Penalty");
  const scorer = (e: Fixture["events"][number]) =>
    `${e.player} ${e.minute}${e.extra ? `+${e.extra}` : ""}′${e.detail === "Own Goal" ? " (p.p.)" : e.detail === "Penalty" ? " (p)" : ""}`;
  const forHome = goals.filter((e) => (e.detail === "Own Goal" ? e.teamId === f.away.id : e.teamId === f.home.id));
  const forAway = goals.filter((e) => (e.detail === "Own Goal" ? e.teamId === f.home.id : e.teamId === f.away.id));
  const dateLabel = new Intl.DateTimeFormat(getLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: getTz() }).format(new Date(f.timestamp * 1000));
  const matchday = f.round.match(/(\d+)\s*$/)?.[1];
  const roundLabel = matchday ? `Jornada ${matchday}` : f.round;
  return (
    <section className="relative isolate min-w-0 overflow-hidden rounded-2xl border border-slate-300/80 p-3 text-slate-900 shadow-sm sm:p-4" style={{ background: "linear-gradient(110deg, #eef3ee 0%, #f5f5ef 50%, #eef2f0 100%)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
        {f.home.logo && <div className="absolute -left-[28%] top-1/2 h-[90%] w-[65%] -translate-y-1/2 bg-contain bg-left bg-no-repeat opacity-30 blur-xl team-color-halo" style={{ backgroundImage: `url("${f.home.logo}")` }} />}
        {f.away.logo && <div className="absolute -right-[28%] top-1/2 h-[90%] w-[65%] -translate-y-1/2 bg-contain bg-right bg-no-repeat opacity-30 blur-xl team-color-halo" style={{ backgroundImage: `url("${f.away.logo}")` }} />}
      </div>
      <div className="relative z-10">
      <div className="flex justify-center">
        <Link href={`/liga/${f.leagueId}`} className="flex min-w-0 items-center gap-2 rounded-full border border-slate-300/80 bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white">
          <Shield src={getLeagueLogoUrl(f.leagueId, f.leagueLogo)} alt="" size={20} />
          <span className="truncate">{f.leagueName}</span>
          <IconNext className="h-3.5 w-3.5 shrink-0" />
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center text-[11px] text-slate-600 sm:text-xs">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3 shrink-0" /><span className="capitalize">{dateLabel}</span></span>
        {roundLabel && <span><I18nText text={roundLabel} /></span>}
      </div>
      {f.venue && <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-slate-600 sm:text-xs"><MapPin className="h-3 w-3" />{f.venue}</div>}
      <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(5rem,auto)_minmax(0,1fr)] items-start gap-1 sm:gap-2">
        <TeamCol teamId={f.home.id} leagueId={f.leagueId} season={f.season} returnTo={returnTo} name={f.home.name} logo={f.home.logo} yellowCards={cardCounts.homeYellow} redCards={cardCounts.homeRed} p={pa} />
        <div className="relative flex min-h-[72px] min-w-[5rem] flex-col items-center justify-center text-center">
          {g === "live" ? (csvLive ? <span className="inline-flex animate-pulse items-center justify-center rounded-md bg-loss px-3 py-1.5 text-sm font-black uppercase leading-none text-black motion-reduce:animate-none">LIVE</span> : <><div className="text-lg font-extrabold text-loss">{f.statusShort === "HT" ? "HT" : `${f.elapsed ?? ""}′`}</div><div className="text-3xl font-black text-loss">{score}</div></>)
            : g === "finished" ? (<><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600"><I18nText text="Final" /></div><div className="hero-serif whitespace-nowrap text-4xl font-normal leading-normal tracking-normal text-slate-900 sm:text-5xl">{score ?? "—"}</div>{halftimeScore && <div className="text-xs text-slate-600">{t("Descanso")} {halftimeScore}</div>}</>)
            : (<><div className="hero-serif whitespace-nowrap text-4xl font-normal leading-normal tracking-normal sm:text-5xl">{timeStr(f.timestamp)}</div>{g === "pending" && <div className="absolute left-1/2 top-full mt-1 w-max max-w-[150px] -translate-x-1/2 rounded-full border border-slate-300/80 bg-white/55 px-2 py-1 text-[10px] leading-tight text-slate-600"><I18nText text="Pendiente de actualizar" /></div>}</>)}
        </div>
        <TeamCol teamId={f.away.id} leagueId={f.leagueId} season={f.season} returnTo={returnTo} name={f.away.name} logo={f.away.logo} yellowCards={cardCounts.awayYellow} redCards={cardCounts.awayRed} p={pb} />
      </div>
      {(forHome.length > 0 || forAway.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-slate-600">
          <div className="space-y-0.5">{forHome.map((e, i) => <div key={i}>{scorer(e)}</div>)}</div>
          <div className="space-y-0.5 text-right">{forAway.map((e, i) => <div key={i}>{scorer(e)}</div>)}</div>
        </div>
      )}
      <div className="flex justify-center"><FollowMatchButton fixtureId={f.id} isAuthenticated={isAuthenticated} initialFavorite={initialFavorite} /></div>
      </div>
    </section>
  );
}
function TeamCol({ teamId, leagueId, season, returnTo, name, logo, yellowCards, redCards, p }: { teamId: number; leagueId: number; season: number; returnTo: string; name: string; logo: string | null; yellowCards: number; redCards: number; p: TeamProfile }) {
  const form = p.rows.slice(-5);
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <Link href={`/equipo/${teamId}?league=${leagueId}&season=${season}&name=${encodeURIComponent(name)}&from=${encodeURIComponent(returnTo)}`} aria-label={`Ver estadísticas de ${name}`} title={`Ver estadísticas de ${name}`} className="relative inline-flex rounded-2xl border border-slate-300/80 bg-white/75 p-2 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <Shield src={logo} alt={name} size={56} />
        {(yellowCards > 0 || redCards > 0) && (
          <span className="absolute -right-1 -top-1 flex gap-1">
            {yellowCards > 0 && <span className="flex h-4 w-3 items-center justify-center rounded-[4px] bg-yellow-400 text-[9px] font-extrabold leading-none text-slate-900">{yellowCards}</span>}
            {redCards > 0 && <span className="flex h-4 w-3 items-center justify-center rounded-[4px] bg-red-500 text-[9px] font-extrabold leading-none text-white">{redCards}</span>}
          </span>
        )}
      </Link>
      <div className="hero-serif min-h-[2.4em] max-w-full whitespace-normal break-words text-center text-[13px] font-normal uppercase leading-tight tracking-normal sm:text-sm">{name}</div>
      <div className="mt-1 flex max-w-full flex-wrap justify-center gap-0.5 sm:gap-1">
        {form.map((r, i) => (
          <span key={i} className={`flex h-[18px] w-[18px] items-center justify-center rounded font-serif text-[10px] font-bold text-black sm:h-5 sm:w-5 sm:text-xs ${r.result === "W" ? "bg-statGreen" : r.result === "D" ? "bg-statOrange" : "bg-statRed"}`}>{r.result}</span>
        ))}
      </div>
    </div>
  );
}

// ───────────── General ─────────────
async function General({ f, pa, pb }: { f: Fixture; pa: TeamProfile; pb: TeamProfile }) {
  const ownGoalEstimate = expectedFor(pa, pb, "goals");
  const lavg = await getLeagueAverages(f.leagueId, f.season).catch(() => null);
  const eg = ownGoalEstimate;
  const model = eg ? poissonModel(eg.home, eg.away) : null;
  const p1x2 = model;
  const ex = (m: Metric) => expectedFor(pa, pb, m)?.total ?? null;
  const L = lavg;

  const prob = (label: string, Icon: typeof IconNet, v: number | null, ref: number | null | undefined) => (
    <StatCard label={label} Icon={Icon} value={pct(v)} fill={v ?? 0} tone={ref != null ? tone(v, ref) : pctTone(v)} refValue={ref != null ? pct(ref) : null} variant="tile" />
  );
  const avgc = (label: string, Icon: typeof IconNet, v: number | null, ref: number | null | undefined, d = 1) => (
    <StatCard label={label} Icon={Icon} value={num(v, d)} fill={v !== null && ref ? (v / (ref * 2)) * 100 : v !== null ? 40 : 0} tone={tone(v, ref ?? null)} refValue={ref != null ? num(ref, 1) : null} variant="tile" />
  );

  return (
    <div className="min-w-0 space-y-4">
      {p1x2 ? (
        <div>
          <div className="mb-1.5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 text-[11px] font-bold leading-tight sm:text-sm">
            <span className="min-w-0 truncate text-left">{f.home.name} <span style={{ color: OUTCOME_COLORS.home }}>{Math.round(p1x2.home)}%</span></span>
            <span className="min-w-0 truncate text-center" style={{ color: OUTCOME_COLORS.draw }}><I18nText text="Empate" /> {Math.round(p1x2.draw)}%</span>
            <span className="min-w-0 truncate text-right">{f.away.name} <span style={{ color: OUTCOME_COLORS.away }}>{Math.round(p1x2.away)}%</span></span>
          </div>
          <div className="flex h-5 overflow-hidden rounded-full">
            <div className="border-r-2 border-bg" style={{ width: `${p1x2.home}%`, backgroundColor: OUTCOME_COLORS.home }} />
            <div className="border-r-2 border-bg" style={{ width: `${p1x2.draw}%`, backgroundColor: OUTCOME_COLORS.draw }} />
            <div style={{ width: `${p1x2.away}%`, backgroundColor: OUTCOME_COLORS.away }} />
          </div>
        </div>
      ) : <Notice tone="warn"><I18nText text="Datos insuficientes para estimar el 1X2 (pocos partidos recientes o cobertura limitada)." /></Notice>}

      <section className="min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-4">
        <h2 className="mb-3 font-bold"><I18nText text="Probabilidades clave" /></h2>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {prob("Más de 2,5 goles", IconShoe, model?.over25 ?? null, L?.over25)}
          {prob("Más de 1,5 goles", IconShoe, model?.over15 ?? null, L?.over15)}
          {prob("Ambos marcan", IconSwap, model?.btts ?? null, L?.btts)}
          {avgc("Promedio de goles", IconBall, eg?.total ?? null, L?.goals, 2)}
          {avgc("Promedio de tarjetas", IconCard, ex("cards"), L?.cards)}
          {avgc("Promedio de córners", IconCorner, ex("corners"), L?.corners)}
          {avgc("Promedio de tiros", IconTarget, ex("shots"), L?.shots)}
          {avgc("Promedio de TAP", IconNet, ex("shotsOn"), L?.shotsOn)}
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted"><I18nText text="Rojo intenso: por encima de la media de la liga (±10%). Ámbar: similar. Rojo oscuro: por debajo. Sin media de liga disponible, el color indica solo si el porcentaje es alto (rojo intenso), medio (ámbar) o bajo (rojo oscuro)." /> {FORM_MATCHES} <I18nText text="Partidos" />.</p>
      </section>
    </div>
  );
}

// ───────────── Goles ─────────────
async function Goals({ f, pa, pb }: { f: Fixture; pa: TeamProfile; pb: TeamProfile }) {
  const eg = expectedFor(pa, pb, "goals");
  const h1 = halfExpected(pa, pb, 1), h2 = halfExpected(pa, pb, 2);
  const goalExpected = expectedFor(pa, pb, "goals");
  const model = goalExpected ? poissonModel(goalExpected.home, goalExpected.away) : null;
  const rows: TrendRow[] = [
    { label: "Goles esperados", kind: "num", a: eg?.home ?? null, b: eg?.away ?? null, m: eg?.total ?? null },
    ...LINES.goals.map((l) => ({ label: `Más de ${num(l)}`, kind: "pct" as const, a: trendPct(pa, "goals", l), b: trendPct(pb, "goals", l), m: model ? (l === 1.5 ? model.over15 : model.over25) : pooledPct(pa, pb, "goals", l) })),
    { label: "Ambos equipos marcan", kind: "pct", a: bttsPct(pa), b: bttsPct(pb), m: model?.btts ?? pooledBtts(pa, pb) },
  ];
  const tp = { homeName: f.home.name, awayName: f.away.name, homeLogo: f.home.logo, awayLogo: f.away.logo, d: 2 };
  return (
    <div className="space-y-4">
      <TeamPair title="Goles esperados" totalLabel="Total esperado" total={eg?.total ?? null} home={eg?.home ?? null} away={eg?.away ?? null} {...tp} />
      <TrendTable title="Tendencias de goles" rows={rows} aName={f.home.name} bName={f.away.name} note="Las tendencias recientes ponderan más los partidos nuevos. “Partido” usa el modelo de goles del encuentro." />
      <TeamPair title="Potencial de gol 1.er tiempo" totalLabel={`Partidos con gol: ${pct(halfGoalPct(pa, pb, 1))}`} total={h1?.total ?? null} home={h1?.home ?? null} away={h1?.away ?? null} {...tp} />
      <TeamPair title="Potencial de gol 2.º tiempo" totalLabel={`Partidos con gol: ${pct(halfGoalPct(pa, pb, 2))}`} total={h2?.total ?? null} home={h2?.home ?? null} away={h2?.away ?? null} {...tp} />
    </div>
  );
}

// ───────────── Tiros / Córners / Tarjetas ─────────────
const TITLE: Record<string, [string, string, string]> = {
  shots: ["Tiros totales", "Media combinada de tiros", "Tiros"],
  shotsOn: ["TAP", "Media combinada de TAP", "TAP"],
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
    ...LINES[tm].map((l) => ({ label: `Más de ${num(l)}`, kind: "pct" as const, a: ownPct(pa, tm, l), b: ownPct(pb, tm, l), m: matchOverPct(pa, pb, tm, l) })),
  ];
  const noData = metrics.every((m) => expectedFor(pa, pb, m) === null);
  return (
    <div className="space-y-4">
      {noData && <Notice tone="warn"><I18nText text="ESPN y los CSV no ofrecen estadísticas suficientes para este partido." /></Notice>}
      {metrics.map((m) => {
        const e = expectedFor(pa, pb, m);
        return <TeamPair key={m} title={TITLE[m][0]} totalLabel={TITLE[m][1]} total={e?.total ?? null} home={e?.home ?? null} away={e?.away ?? null} {...tp} />;
      })}
      {lavg && lavg[tm] != null && <Notice><I18nText text="Media de liga" />: <b className="text-brand">{num(lavg[tm], 1)}</b></Notice>}
      {LINES[tm].length > 0 && (
        <TrendTable
          title={`Tendencias de ${tm === "shotsOn" ? "TAP" : TITLE[tm][0].toLowerCase()}`} rows={rows} aName={f.home.name} bName={f.away.name}
          sub={`${TITLE[tm][2]} del equipo`} totalHead="Total del partido"
          note="Las columnas de equipo ponderan más los partidos recientes. El total del partido se estima con la producción de cada equipo y lo que concede el rival."
        />
      )}
    </div>
  );
}
