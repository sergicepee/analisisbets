import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronDown, MapPin, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { t } from "@/lib/i18n";
import { I18nText } from "@/components/I18nProvider";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MatchList } from "@/components/MatchList";
import { GoalsAnalysis } from "@/components/GoalsAnalysis";
import { CornersAnalysis } from "@/components/CornersAnalysis";
import { CardsAnalysis } from "@/components/CardsAnalysis";
import { ShotsAnalysis } from "@/components/ShotsAnalysis";
import { LiveMatchClock } from "@/components/LiveMatchClock";
import { MatchTimeline } from "@/components/MatchTimeline";
import { FollowMatchButton } from "@/components/FollowMatchButton";
import { Workspace } from "@/components/Workspace";
import { Shield } from "@/components/Shield";
import { IconAssist, IconBall, IconBars, IconCard, IconCorner, IconNet, IconNext, IconPlayerCard, IconShoe, IconSoccerBall, IconSubstitution, IconSubstitutionIn, IconSwap, IconTarget } from "@/components/icons";
import { Notice, Panel, StatCard } from "@/components/ui";
import { getFixture, getFixtureLineups, getFixtureStatsFor, getLeagueAverages, getLeagueCardLeaders, getTeamProfile } from "@/lib/apifootball";
import { getUser } from "@/lib/auth";
import { getDisplaySubscriberAccess } from "@/lib/subscriptions";
import { getFavoriteFixtureIds } from "@/lib/favorites";
import { PremiumLockedPreview } from "@/components/PremiumLockedPreview";
import { apiEnabled, FORM_MATCHES } from "@/lib/config";
import { savePreMatchPrediction, settleSavedPrediction, type ExpectedMetrics } from "@/lib/prediction-ledger";
import { errMsg, friendlyApiError, isDate, num, pct, statusGroup, timeStr, todayStr } from "@/lib/format";
import { getLeagueLogoUrl } from "@/lib/leagueLogo";
import { jerseyStyle, normalizedTeamColor } from "@/lib/teamColor";
import { getLocale, getTz } from "@/lib/prefs";
import {
  avg2, expectedFor, pctTone, poissonModel, tone,
} from "@/lib/metrics";
import type { Fixture, FixtureLineup, FixtureLineupEvent, FixtureLineupPlayer, MatchPeriod, MatchStat, Metric, StoredStats, TeamProfile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABS = [
  ["general", "General", IconBars], ["goles", "Goles", IconBall], ["tiros", "Tiros", IconTarget],
  ["corners", "Esquinas", IconCorner], ["tarjetas", "Tarjetas", IconCard],
] as const;
const MATCH_SECTIONS = [["analysis", "Análisis"], ["statistics", "Estadísticas"], ["timeline", "Cronología"], ["lineups", "Alineaciones"]] as const;
const EMPTY = (id: number): TeamProfile => ({ teamId: id, rows: [] });

export default async function MatchPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();
  const section = MATCH_SECTIONS.some(([key]) => key === searchParams.section)
    ? searchParams.section as typeof MATCH_SECTIONS[number][0]
    : "analysis";
  const analysisTab = TABS.some((t) => t[0] === searchParams.tab) ? (searchParams.tab as string) : "general";
  const statisticsPeriod: MatchPeriod = searchParams.period === "first" || searchParams.period === "second"
    ? searchParams.period
    : "full";
  const date = isDate(searchParams.date) ? (searchParams.date as string) : todayStr();
  const fixtureRequest = getFixture(id, Number(searchParams.league) || undefined, date)
    .then((fixture) => ({ fixture, error: null as unknown }))
    .catch((error: unknown) => ({ fixture: null, error }));
  const [user, fixtureResult] = await Promise.all([getUser(), fixtureRequest]);
  if (fixtureResult.error) {
    return <><Header back={`/?date=${date}`} /><main className="p-4"><Notice tone="warn">No se pudo cargar el partido: {errMsg(fixtureResult.error)}</Notice></main></>;
  }
  const f = fixtureResult.fixture;
  if (!f) notFound();
  if (["FT", "AET", "PEN"].includes(f.statusShort)) {
    try {
      await settleSavedPrediction(f);
    } catch (error) {
      console.error(`No se pudo evaluar la predicción guardada del partido ${f.id}:`, error);
    }
  }
  const [subscriptionAccess, favoriteLookup] = await Promise.all([
    user ? getDisplaySubscriberAccess(user.id) : Promise.resolve({ active: false, error: false, developerMode: null }),
    user ? getFavoriteFixtureIds(user.id, [f.id]) : Promise.resolve({ favoriteIds: new Set<number>(), error: false }),
  ]);
  const isSubscriber = subscriptionAccess.active;
  const g = statusGroup(f);
  const cardCounts = f.events.reduce((counts, event) => {
    if (event.type !== "Card") return counts;
    const home = event.teamId === f.home.id;
    if (event.detail === "Yellow Card") counts[home ? "homeYellow" : "awayYellow"]++;
    if (event.detail === "Red Card" || event.detail === "Second Yellow Card") counts[home ? "homeRed" : "awayRed"]++;
    return counts;
  }, { homeYellow: 0, homeRed: 0, awayYellow: 0, awayRed: 0 });

  return (
    <>
      <Header back={`/?date=${date}`} />
      {apiEnabled && g === "live" ? <AutoRefresh seconds={45} /> : null}
      <Workspace hideListOnMobile list={<MatchList date={date} selectedId={f.id} userId={user?.id ?? null} isSubscriber={isSubscriber} subscriptionError={subscriptionAccess.error} />}>
      <main className="space-y-4 px-3 pb-8 pt-4 sm:px-4 lg:px-0">
        {favoriteLookup.error && <Notice tone="warn"><I18nText text="No se pudieron cargar tus favoritos. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        {subscriptionAccess.error && <Notice tone="warn"><I18nText text="No se pudo verificar tu acceso Premium. Las funciones Premium están bloqueadas hasta que se recupere la conexión." /></Notice>}
        <MatchHeader f={f} cardCounts={cardCounts} returnTo={`/match/${f.id}?date=${date}&league=${f.leagueId}`} isAuthenticated={!!user} initialFavorite={favoriteLookup.favoriteIds.has(f.id)} />
        <nav role="tablist" aria-label={t("Secciones del partido")} className="grid grid-cols-4 border-b border-line">
          {MATCH_SECTIONS.map(([key, label]) => (
            <Link key={key} replace scroll={false} role="tab" aria-selected={section === key} href={`/match/${id}?section=${key}&tab=${analysisTab}&date=${date}&league=${f.leagueId}`} className={`flex flex-col items-center gap-1 border-b-2 py-2.5 text-xs font-semibold sm:text-sm ${section === key ? "border-brand text-brand" : "border-transparent text-muted"}`}>
              <I18nText text={label} />
            </Link>
          ))}
        </nav>
        {section === "analysis" && (
          <>
            <nav aria-label={t("Apartados del análisis")} className="flex gap-1.5 overflow-x-auto rounded-full border border-line bg-card2 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TABS.map(([key, label, Icon]) => (
                <Link key={key} replace scroll={false} aria-current={analysisTab === key ? "page" : undefined} href={`/match/${id}?section=analysis&tab=${key}&date=${date}&league=${f.leagueId}`} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold sm:px-4 sm:text-xs ${analysisTab === key ? "bg-brand text-slate-950" : "text-muted hover:bg-white/5 hover:text-fg"}`}>
                  <Icon className="h-3.5 w-3.5" /><I18nText text={label} />
                </Link>
              ))}
            </nav>
          </>
        )}
        <Suspense fallback={<MatchContentFallback section={section} />}>
          <MatchData f={f} section={section} analysisTab={analysisTab} statisticsPeriod={statisticsPeriod} date={date} isSubscriber={isSubscriber} />
        </Suspense>
      </main>
    </Workspace>
    </>
  );
}

async function MatchData({
  f, section, analysisTab, statisticsPeriod, date, isSubscriber,
}: {
  f: Fixture;
  section: typeof MATCH_SECTIONS[number][0];
  analysisTab: string;
  statisticsPeriod: MatchPeriod;
  date: string;
  isSubscriber: boolean;
}) {
  const premiumLocked = section === "analysis" && analysisTab !== "general" && analysisTab !== "goles" && !isSubscriber;
  const includeGoalProfiles = section === "analysis" && analysisTab === "goles";
  const includeStats = section === "analysis" && !premiumLocked && analysisTab !== "goles";
  let profileErr: string | null = null;
  let lineupsError: string | null = null;
  const grab = (p: Promise<TeamProfile>) => p.catch((error: unknown) => {
    profileErr = profileErr ?? errMsg(error);
    return null;
  });
  const homeProfilePromise = includeStats
    ? grab(getTeamProfile(f.home.id, true, f.season, f.timestamp, f.leagueId, { blendCompetitions: true }))
    : Promise.resolve(null);
  const awayProfilePromise = includeStats
    ? grab(getTeamProfile(f.away.id, true, f.season, f.timestamp, f.leagueId, { blendCompetitions: true }))
    : Promise.resolve(null);
  const goalHomeProfilePromise = includeGoalProfiles
    ? grab(getTeamProfile(f.home.id, false, f.season, f.timestamp, f.leagueId, { venue: "home", withHalfTime: true, blendCompetitions: true }))
    : Promise.resolve(null);
  const goalAwayProfilePromise = includeGoalProfiles
    ? grab(getTeamProfile(f.away.id, false, f.season, f.timestamp, f.leagueId, { venue: "away", withHalfTime: true, blendCompetitions: true }))
    : Promise.resolve(null);
  const actualStatsPromise = section === "statistics" ? getFixtureStatsFor(f) : Promise.resolve(null);
  const lineupsPromise = section === "lineups" || section === "timeline"
    ? getFixtureLineups(f).catch((error: unknown) => {
      lineupsError = errMsg(error);
      return [];
    })
    : Promise.resolve([]);
  const [pa0, pb0, actualStats, lineups, goalPa0, goalPb0] = await Promise.all([
    homeProfilePromise,
    awayProfilePromise,
    actualStatsPromise,
    lineupsPromise,
    goalHomeProfilePromise,
    goalAwayProfilePromise,
  ]);
  const pa = pa0 ?? EMPTY(f.home.id);
  const pb = pb0 ?? EMPTY(f.away.id);
  const goalPa = goalPa0 ?? EMPTY(f.home.id);
  const goalPb = goalPb0 ?? EMPTY(f.away.id);
  const goalRowsForViewer = (rows: typeof goalPa.rows) => isSubscriber
    ? rows
    : rows.map((row) => ({ ...row, htFor: null, htAgainst: null }));
  const goalCompetitionRowsForViewer = (rows: typeof goalPa.rows) => isSubscriber
    ? rows
    : rows.map((row) => ({ ...row, htFor: null, htAgainst: null }));
  const analysisProfileMissing = analysisTab === "goles"
    ? !goalPa0 || !goalPb0
    : !pa0 || !pb0;

  return (
    <>
      {section === "analysis" && (
        <>
          {!premiumLocked && analysisProfileMissing ? <Notice tone="warn"><I18nText text="Algunas estadísticas no se pudieron cargar." /> {profileErr ? friendlyApiError(profileErr) : <I18nText text="Sin datos suficientes." />}</Notice> : null}
          {analysisTab === "general" && <General f={f} pa={pa} pb={pb} />}
          {premiumLocked && <PremiumLockedPreview tab={analysisTab as "tiros" | "corners" | "tarjetas"} home={{ name: f.home.name, logo: f.home.logo }} away={{ name: f.away.name, logo: f.away.logo }} locale={getLocale()} />}
          {analysisTab === "goles" && <GoalsAnalysis home={f.home} away={f.away} homeRows={goalRowsForViewer(goalPa.rows)} awayRows={goalRowsForViewer(goalPb.rows)} homeCompetitionRows={goalCompetitionRowsForViewer(goalPa.competitionRows ?? [])} awayCompetitionRows={goalCompetitionRowsForViewer(goalPb.competitionRows ?? [])} sampleSize={FORM_MATCHES} locale={getLocale()} isSubscriber={isSubscriber} />}
          {!premiumLocked && analysisTab === "tiros" && <Block f={f} pa={pa} pb={pb} tab="tiros" />}
          {!premiumLocked && analysisTab === "corners" && <Block f={f} pa={pa} pb={pb} tab="corners" />}
          {!premiumLocked && analysisTab === "tarjetas" && <Block f={f} pa={pa} pb={pb} tab="tarjetas" />}
        </>
      )}
      {section === "statistics" && <MatchStatistics fixture={f} stats={actualStats} period={statisticsPeriod} date={date} />}
      {section === "timeline" && <MatchTimeline fixture={f} lineups={lineups} error={lineupsError} />}
      {section === "lineups" && <MatchLineups fixture={f} lineups={lineups} error={lineupsError} />}
    </>
  );
}

function MatchContentFallback({ section }: { section: typeof MATCH_SECTIONS[number][0] }) {
  const label = section === "analysis"
    ? "Cargando análisis..."
    : section === "statistics"
      ? "Cargando estadísticas..."
      : section === "timeline"
        ? "Cargando cronología..."
      : "Cargando alineaciones...";
  return <div role="status" aria-live="polite" className="card flex min-h-28 animate-pulse items-center justify-center p-4 text-sm text-muted"><I18nText text={label} /></div>;
}

function MatchStatistics({ fixture, stats, period, date }: { fixture: Fixture; stats: StoredStats | null; period: MatchPeriod; date: string }) {
  const groups: Array<{ title: string; rows: Array<{ label: string; key: string; percent?: boolean }> }> = [
    { title: "Resumen", rows: [
      { label: "Posesión", key: "possessionPct", percent: true },
      { label: "Tiros totales", key: "totalShots" },
      { label: "Tiros a puerta", key: "shotsOnTarget" },
      { label: "Córners", key: "wonCorners" },
      { label: "Faltas", key: "foulsCommitted" },
      { label: "Fuera de juego", key: "offsides" },
      { label: "Paradas", key: "saves" },
      { label: "Tarjetas", key: "cards" },
    ] },
    { title: "Remates", rows: [
      { label: "Tiros fuera", key: "shotsOffTarget" },
      { label: "Tiros bloqueados", key: "blockedShots" },
      { label: "Intentos de gol", key: "totalShots" },
    ] },
    { title: "Ataque", rows: [
      { label: "Centros", key: "totalCrosses" },
      { label: "Centros precisos", key: "accurateCrosses" },
    ] },
    { title: "Pases", rows: [
      { label: "Pases", key: "totalPasses" },
      { label: "Pases completados", key: "accuratePasses" },
      { label: "Precisión de pase", key: "passPct", percent: true },
      { label: "Pases largos", key: "totalLongBalls" },
      { label: "Pases largos completados", key: "accurateLongBalls" },
      { label: "Precisión en pase largo", key: "longballPct", percent: true },
    ] },
    { title: "Defensa", rows: [
      { label: "Entradas", key: "totalTackles" },
      { label: "Entradas ganadas", key: "effectiveTackles" },
      { label: "Intercepciones", key: "interceptions" },
    ] },
  ];
  const hasData = period === "full"
    ? !!stats?.hasData
    : !!stats && [stats.home, stats.away].some((team) => team.halves?.[period] !== undefined);
  const visibleGroups = period === "full"
    ? groups
    : groups
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => ["totalShots", "shotsOnTarget", "wonCorners", "cards"].includes(row.key)),
      }))
      .filter((group) => group.rows.length > 0);
  const waitingForStart = !hasData && ["upcoming", "pending"].includes(statusGroup(fixture));

  if (waitingForStart) {
    return (
      <section className="card min-w-0 p-3 sm:p-4">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
          <h3 className="min-w-0 text-xs font-black uppercase tracking-wide sm:text-sm">
            <I18nText text="Estadísticas del partido" />
          </h3>
          <div
            role="img"
            aria-label={`${fixture.home.name} ${t("contra")} ${fixture.away.name}`}
            className="flex shrink-0 items-center gap-2"
          >
            <Shield src={fixture.home.logo} alt="" size={20} />
            <span className="text-[9px] font-bold uppercase text-muted">VS</span>
            <Shield src={fixture.away.logo} alt="" size={20} />
          </div>
        </div>
        <div className="flex min-h-[96px] items-center justify-center px-2 text-center">
          <p className="text-sm font-semibold text-muted">
            <I18nText text="Las estadísticas estarán disponibles cuando empiece el partido." />
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-w-0 space-y-3">
      <div role="tablist" aria-label={t("Periodo de estadísticas")} className="grid grid-cols-3 gap-1 rounded-full border border-line bg-bg/70 p-1">
        {([
          ["full", "Partido completo"],
          ["first", "1.ª parte"],
          ["second", "2.ª parte"],
        ] as const).map(([value, label]) => (
          <Link
            key={value}
            replace
            scroll={false}
            role="tab"
            aria-selected={period === value}
            href={`/match/${fixture.id}?section=statistics&period=${value}&date=${date}&league=${fixture.leagueId}`}
            className={`min-w-0 rounded-full px-1.5 py-2 text-center text-[9px] font-bold transition sm:px-3 sm:text-xs ${period === value ? "bg-brand text-slate-950" : "text-muted hover:bg-white/5 hover:text-fg"}`}
          >
            <I18nText text={label} />
          </Link>
        ))}
      </div>
      {stats && hasData ? (
        <div className="space-y-2">
          {visibleGroups.map((group) => (
            <details key={group.title} open className="group overflow-hidden rounded-xl border border-line bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-3 [&::-webkit-details-marker]:hidden">
                <span className="text-xs font-black uppercase tracking-wide"><I18nText text={group.title} /></span>
                <span className="rounded-full bg-card2 px-2 py-0.5 text-[10px] font-bold text-muted">{group.rows.length}</span>
                <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2 border-t border-line px-2.5 py-2">
                {group.rows.map((row) => {
                  const getValue = (team: MatchStat) => {
                if (period !== "full") {
                  const half = team.halves?.[period];
                  if (!half) return null;
                  if (row.key === "cards") return half.cards;
                  if (row.key === "totalShots") return half.shots;
                  if (row.key === "shotsOnTarget") return half.shotsOn;
                  if (row.key === "wonCorners") return half.corners;
                  return null;
                }
                if (row.key === "cards") {
                      const yellow = team.details?.yellowCards ?? team.yellowCards ?? null;
                      const red = team.details?.redCards ?? team.redCards ?? null;
                      return team.cards ?? (yellow !== null && red !== null ? yellow + red : null);
                    }
                    if (row.key === "shotsOffTarget") {
                      const total = team.details?.totalShots ?? team.shots;
                      const onTarget = team.details?.shotsOnTarget ?? team.shotsOn;
                      const blocked = team.details?.blockedShots;
                      return total !== null && total !== undefined
                        && onTarget !== null && onTarget !== undefined
                        && blocked !== undefined
                        ? Math.max(0, total - onTarget - blocked)
                        : team.details?.shotsOffTarget ?? null;
                    }
                    return team.details?.[row.key]
                      ?? (row.key === "totalShots" ? team.shots
                        : row.key === "shotsOnTarget" ? team.shotsOn
                          : row.key === "wonCorners" ? team.corners
                            : null);
                  };
                  const home = getValue(stats.home);
                  const away = getValue(stats.away);
                  const max = Math.max(home ?? 0, away ?? 0);
                  const homeWidth = max > 0 ? Math.max(0, (home ?? 0) / max * 100) : 0;
                  const awayWidth = max > 0 ? Math.max(0, (away ?? 0) / max * 100) : 0;
                  const formatValue = (value: number | null) => {
                    if (value === null) return "—";
                    if (row.percent) return `${Math.round(value <= 1 ? value * 100 : value)}%`;
                    return num(value, 0);
                  };
                  const homeLeads = home !== null && away !== null && home > away;
                  const awayLeads = home !== null && away !== null && away > home;
                  const barColor = (value: number | null, leads: boolean) =>
                    value === null || max === 0 ? "bg-transparent"
                      : leads ? "bg-white"
                        : home === away ? "bg-white/70" : "bg-white/35";
                  return (
                    <div key={row.key} className="space-y-1">
                      <div className="grid grid-cols-[minmax(2.5rem,1fr)_minmax(0,2fr)_minmax(2.5rem,1fr)] items-center gap-2">
                        <span className={`justify-self-start rounded-md px-2 py-1 text-xs font-bold tabular-nums ${homeLeads ? "bg-white text-slate-950" : "text-muted"}`}>
                          {formatValue(home)}
                        </span>
                        <span className="min-w-0 text-center text-[10px] font-semibold leading-tight text-muted sm:text-xs"><I18nText text={row.label} /></span>
                        <span className={`justify-self-end rounded-md px-2 py-1 text-xs font-bold tabular-nums ${awayLeads ? "bg-white text-slate-950" : "text-muted"}`}>
                          {formatValue(away)}
                        </span>
                      </div>
                      <div aria-hidden="true" className="grid h-1.5 grid-cols-2 gap-1">
                        <div className="flex items-center justify-end overflow-hidden rounded-full bg-line">
                          <span className={`h-full rounded-full ${barColor(home, homeLeads)}`} style={{ width: `${homeWidth}%` }} />
                        </div>
                        <div className="flex items-center overflow-hidden rounded-full bg-line">
                          <span className={`h-full rounded-full ${barColor(away, awayLeads)}`} style={{ width: `${awayWidth}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <Notice>
          <I18nText text={period === "full"
            ? "ESPN todavía no ofrece estadísticas reales para este partido."
            : "ESPN todavía no ofrece estadísticas desglosadas por parte para este partido."} />
        </Notice>
      )}
    </section>
  );
}

function teamColorOptions(lineup: FixtureLineup | undefined) {
  return [...new Set([
    normalizedTeamColor(lineup?.teamColor),
    normalizedTeamColor(lineup?.teamAlternateColor),
  ].filter((color): color is string => color !== null))];
}

function colorDistance(left: string, right: string) {
  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(left.slice(offset, offset + 2), 16) - Number.parseInt(right.slice(offset, offset + 2), 16),
  );
  return Math.sqrt(channels.reduce((sum, channel) => sum + channel ** 2, 0));
}

function distinctLineupColors(homeLineup: FixtureLineup | undefined, awayLineup: FixtureLineup | undefined) {
  const homeOptions = teamColorOptions(homeLineup);
  const awayOptions = teamColorOptions(awayLineup);
  if (!homeOptions.length || !awayOptions.length) {
    return {
      home: homeOptions[0] ?? null,
      away: awayOptions[0] ?? null,
      needsBorder: true,
    };
  }

  const pairs = homeOptions.flatMap((home, homeIndex) => awayOptions.map((away, awayIndex) => ({
    home,
    away,
    distance: colorDistance(home, away),
    changes: homeIndex + awayIndex,
  })));
  const primaryPair = pairs[0];
  if (primaryPair.distance >= 100) {
    return { home: primaryPair.home, away: primaryPair.away, needsBorder: false };
  }

  const distinctPairs = pairs
    .filter((pair) => pair.distance >= 100)
    .sort((left, right) => left.changes - right.changes || right.distance - left.distance);
  const selected = distinctPairs[0] ?? [...pairs].sort((left, right) => right.distance - left.distance || left.changes - right.changes)[0];
  return { home: selected.home, away: selected.away, needsBorder: selected.distance < 100 };
}

function MatchLineups({ fixture, lineups, error }: { fixture: Fixture; lineups: FixtureLineup[]; error: string | null }) {
  const homeLineup = lineups.find((lineup) => lineup.teamId === fixture.home.id && lineup.starters.length >= 11);
  const awayLineup = lineups.find((lineup) => lineup.teamId === fixture.away.id && lineup.starters.length >= 11);
  const hasConfirmedLineups = !!homeLineup && !!awayLineup;
  const confirmedLineups = hasConfirmedLineups ? [homeLineup, awayLineup] : [];
  const displayColors = distinctLineupColors(homeLineup, awayLineup);
  const homeBorderColor = displayColors.needsBorder ? "#FFFFFF" : undefined;
  const awayBorderColor = displayColors.needsBorder ? "#FACC15" : undefined;
  const teams = [
    { id: fixture.home.id, name: homeLineup?.teamName ?? fixture.home.name, logo: homeLineup?.teamLogo ?? fixture.home.logo, formation: homeLineup?.formation },
    { id: fixture.away.id, name: awayLineup?.teamName ?? fixture.away.name, logo: awayLineup?.teamLogo ?? fixture.away.logo, formation: awayLineup?.formation },
  ];
  return (
    <div className="space-y-4">
      {error && <Notice tone="warn"><I18nText text="No se pudieron cargar las alineaciones." /> {friendlyApiError(error)}</Notice>}
      <section className="overflow-hidden rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold uppercase sm:text-base"><I18nText text="Alineaciones" /></h2>
          <div className="text-[10px] font-bold sm:text-xs">
            <span className={`rounded-full px-2.5 py-1 ${hasConfirmedLineups ? "bg-brand text-slate-950" : "bg-statOrange/15 text-statOrange"}`}>
              <I18nText text={hasConfirmedLineups ? "Confirmadas" : "No confirmadas"} />
            </span>
          </div>
        </div>
        <div className="mx-auto mb-3 grid w-full max-w-[520px] grid-cols-2 gap-2">
          {teams.map((team) => (
            <div key={team.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-card2 px-2.5 py-2">
              <Shield src={team.logo} alt={team.name} size={24} />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">{team.name}</p>
                {hasConfirmedLineups && team.formation && <p className="text-[10px] text-muted">{team.formation}</p>}
              </div>
            </div>
          ))}
        </div>
        <div
          aria-label={t("Campo de fútbol")}
          className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-white/50 shadow-inner ${hasConfirmedLineups ? "aspect-[5/14] max-w-[520px] sm:aspect-[5/12]" : "aspect-[5/8] max-w-[420px]"}`}
          style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.12) 0%, rgba(0,0,0,.12) 12.5%, transparent 12.5%, transparent 25%), linear-gradient(135deg, #168047, #0c6336)" }}
        >
          <div aria-hidden="true" className="absolute inset-4 rounded-lg border border-white/45" />
          <div aria-hidden="true" className="absolute inset-x-4 top-1/2 border-t border-white/45" />
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45" />
          <div aria-hidden="true" className="absolute left-1/2 top-2 h-[13%] w-[48%] -translate-x-1/2 border-x border-b border-white/40" />
          <div aria-hidden="true" className="absolute bottom-2 left-1/2 h-[13%] w-[48%] -translate-x-1/2 border-x border-t border-white/40" />
          <div className="absolute right-3 top-3 z-20 grid place-items-center rounded-full border border-white/30 bg-emerald-950/85 p-1.5 shadow">
            <Shield src={fixture.away.logo} alt={fixture.away.name} size={24} />
          </div>
          <div className="absolute bottom-3 left-3 z-20 grid place-items-center rounded-full border border-white/30 bg-emerald-950/85 p-1.5 shadow">
            <Shield src={fixture.home.logo} alt={fixture.home.name} size={24} />
          </div>
          {confirmedLineups.map((lineup) => {
            const isHome = lineup.teamId === fixture.home.id;
            return (
              <LineupPlayers
                key={lineup.teamId}
                lineup={lineup}
                side={isHome ? "home" : "away"}
                teamColor={isHome ? displayColors.home : displayColors.away}
                borderColor={isHome ? homeBorderColor : awayBorderColor}
              />
            );
          })}
          {!hasConfirmedLineups && (
            <div className="absolute inset-0 grid place-items-center p-8 text-center text-xs font-bold uppercase tracking-wide text-white/90">
              <span className="rounded-xl bg-black/35 px-4 py-3"><I18nText text="Alineaciones no confirmadas" /></span>
            </div>
          )}
        </div>
        {hasConfirmedLineups && confirmedLineups.some((lineup) => lineup.substitutes.length > 0) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {confirmedLineups.filter((lineup) => lineup.substitutes.length > 0).map((lineup) => {
              const isHome = lineup.teamId === fixture.home.id;
              return (
              <Panel
                key={lineup.teamId}
                title="Suplentes"
                right={
                  <span className="flex max-w-36 items-center gap-1.5 truncate text-xs text-muted">
                    <Shield src={lineup.teamLogo} alt={lineup.teamName} size={16} />
                    <span className="truncate">{lineup.teamName}</span>
                  </span>
                }
              >
                <div className="divide-y divide-line">
                  {lineup.substitutes.map((player) => (
                    <div key={player.id ?? `${player.name}-${player.jersey}`} className="flex min-h-11 items-center gap-2 py-2">
                      <span style={jerseyStyle(isHome ? displayColors.home : displayColors.away, isHome ? homeBorderColor : awayBorderColor)} className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-white/90 bg-emerald-950/90 text-xs font-black text-white shadow">
                        {player.jersey ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.name}</span>
                      <SubstituteEventMarkers events={player.matchEvents ?? []} />
                    </div>
                  ))}
                </div>
              </Panel>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
function LineupPlayers({ lineup, side, teamColor, borderColor }: {
  lineup: FixtureLineup;
  side: "home" | "away";
  teamColor: string | null;
  borderColor?: string;
}) {
  const isGoalkeeper = (position: string) => /goalkeeper|keeper|(^|[^a-z])gk?([^a-z]|$)/i.test(position);
  const isDefender = (position: string) => /defender|back|(^|[^a-z])(cd|cb|lb|rb|wb|df)([^a-z]|$)/i.test(position);
  const isAttackingMidfielder = (position: string) => /attacking midfielder|(^|[^a-z])(?:am|cam|lam|ram)([^a-z]|$)/i.test(position);
  const isForward = (position: string) => /forward|striker|winger|(^|[^a-z])(?:cf|st|fw|f)([^a-z]|$)/i.test(position);
  const goalkeepers = lineup.starters.filter((player) => isGoalkeeper(player.position));
  const defenders = lineup.starters.filter((player) => isDefender(player.position));
  const attackingMidfielders = lineup.starters.filter((player) => isAttackingMidfielder(player.position));
  const forwards = lineup.starters.filter((player) => isForward(player.position));
  const assigned = new Set([...goalkeepers, ...defenders, ...attackingMidfielders, ...forwards]);
  const rows = [
    { label: "goalkeeper", players: goalkeepers },
    { label: "defense", players: defenders },
    { label: "midfield", players: lineup.starters.filter((player) => !assigned.has(player)) },
    { label: "attacking-midfield", players: attackingMidfielders },
    { label: "forward", players: forwards },
  ].filter((row) => row.players.length > 0);

  return (
    <>
      {rows.map((row, index) => {
        const offset = rows.length === 1 ? 25 : 6 + (index * 38) / (rows.length - 1);
        const top = side === "away" ? offset : 100 - offset;
        const players = orderLineupPlayers(row.players, side);
        return (
          <div key={row.label} className="absolute inset-x-4 z-10 grid -translate-y-1/2 justify-items-center" style={{ top: `${top}%`, gridTemplateColumns: `repeat(${row.players.length}, minmax(0, 1fr))` }}>
            {players.map((player) => {
              const jersey = player.jersey?.trim() || "—";
              return (
                <div key={player.id ?? `${player.name}-${player.jersey}`} className="flex w-full min-w-0 flex-col items-center text-center text-[10px] font-semibold leading-tight text-white drop-shadow sm:text-xs">
                  <div className="relative">
                    <span role="img" aria-label={`${player.name} #${jersey}`} style={jerseyStyle(teamColor, borderColor)} className="grid size-12 place-items-center rounded-full border-2 border-white/90 bg-emerald-950/90 text-lg font-black shadow sm:size-14 sm:text-xl">
                      {jersey}
                    </span>
                    <LineupPlayerEventMarkers events={player.matchEvents ?? []} />
                  </div>
                  <span className="mt-2 w-full truncate">{lineupPlayerShortName(player.name)}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function orderLineupPlayers(players: FixtureLineupPlayer[], side: "home" | "away") {
  const lane = (code: string | null | undefined) => {
    const position = code?.toUpperCase().replace(/[^A-Z]/g, "") ?? "";
    if (/^(?:L|LB|LWB|LW|LWF|LM|LAM|LCM|LDM|LCB|AML|LWING)$/.test(position)) return -1;
    if (/^(?:R|RB|RWB|RW|RWF|RM|RAM|RCM|RDM|RCB|AMR|RWING)$/.test(position)) return 1;
    return 0;
  };
  const direction = side === "away" ? -1 : 1;
  return players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => (lane(a.player.positionCode) - lane(b.player.positionCode)) * direction || a.index - b.index)
    .map(({ player }) => player);
}

function LineupPlayerEventMarkers({ events }: { events: FixtureLineupEvent[] }) {
  const goals = events.filter((event) => event.type === "goal").length;
  const ownGoal = events.some((event) => event.type === "goal" && event.ownGoal);
  const assists = events.filter((event) => event.type === "assist").length;
  const yellowCards = events.filter((event) => event.type === "yellowCard").length;
  const redCard = events.some((event) => event.type === "redCard");
  const showRedCard = redCard;
  const substitutions = events.filter((event) => event.type === "substitutionIn" || event.type === "substitutionOut");
  const minuteLabel = (event: FixtureLineupEvent) => `${event.minute}${event.extra === null ? "" : `+${event.extra}`}′`;

  return (
    <>
      {substitutions.map((event, index) => {
        const label = event.type === "substitutionIn" ? t("Entró") : t("Salió");
        const description = `${label} ${minuteLabel(event)}`;
        return (
          <span key={`${event.type}-${index}`} role="img" aria-label={description} title={description} className="absolute left-1/2 -top-4 z-10 inline-flex h-3.5 -translate-x-1/2 items-center gap-0.5 whitespace-nowrap text-[10px] font-semibold leading-none text-white/80">
            <IconSubstitution size={13} />
            <span>{minuteLabel(event)}</span>
          </span>
        );
      })}
      {goals > 0 && (
        <span role="img" aria-label={`${t("Gol")}: ${goals}`} title={`${t("Gol")}: ${goals}`} className="absolute -bottom-2 -left-1 inline-flex items-center gap-0.5 text-white">
          <span className="relative grid size-4 place-items-center">
            <IconSoccerBall size={16} ownGoal={ownGoal} />
            {goals > 1 && <b className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full border border-white/80 bg-slate-950/95 text-[8px] leading-none text-white shadow">{goals}</b>}
          </span>
        </span>
      )}
      {assists > 0 && (
        <span role="img" aria-label={`${t("Asistencia")}: ${assists}`} title={`${t("Asistencia")}: ${assists}`} className="absolute -bottom-2 -right-1 inline-flex text-white">
          <span className="relative grid size-4 place-items-center">
            <IconAssist size={16} />
            {assists > 1 && <b className="absolute -right-1 -top-1 grid size-3.5 place-items-center rounded-full border border-white/80 bg-slate-950/95 text-[8px] leading-none text-white shadow">{assists}</b>}
          </span>
        </span>
      )}
      {yellowCards > 0 || redCard ? (
        <span
          role="img"
          aria-label={t(showRedCard ? "Tarjeta roja" : "Tarjeta amarilla")}
          title={t(showRedCard ? "Tarjeta roja" : "Tarjeta amarilla")}
          className="absolute -right-1 -top-1 z-10"
        >
          <IconPlayerCard red={showRedCard} />
        </span>
      ) : null}
    </>
  );
}

function SubstituteEventMarkers({ events }: { events: FixtureLineupEvent[] }) {
  const yellowCards = events.filter((event) => event.type === "yellowCard");
  const redCard = events.find((event) => event.type === "redCard");
  const cardEvent = redCard ?? (yellowCards.length > 1 ? yellowCards[1] : yellowCards[0]);
  const visibleEvents = events
    .filter((event) => event.type !== "yellowCard" && event.type !== "redCard")
    .concat(cardEvent ? [cardEvent] : [])
    .sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0));
  const minuteLabel = (event: FixtureLineupEvent) => `${event.minute}${event.extra === null ? "" : `+${event.extra}`}′`;

  return (
    <span className="ml-auto flex shrink-0 items-center gap-2">
      {visibleEvents.map((event, index) => {
        const label = event.type === "substitutionIn" ? t("Entró")
          : event.type === "substitutionOut" ? t("Salió")
            : event.type === "goal" ? t("Gol")
              : event.type === "assist" ? t("Asistencia")
                : t(event.type === "redCard" ? "Tarjeta roja" : "Tarjeta amarilla");
        const icon = event.type === "substitutionIn" ? <IconSubstitutionIn size={13} />
          : event.type === "substitutionOut" ? <IconSubstitution size={13} />
            : event.type === "goal" ? <IconSoccerBall size={13} ownGoal={event.ownGoal} />
              : event.type === "assist" ? <IconAssist size={13} />
                : <IconPlayerCard size={13} red={event.type === "redCard"} />;
        return (
          <span key={`${event.type}-${index}`} role="img" aria-label={`${label} ${minuteLabel(event)}`} className="inline-flex items-center gap-0.5 whitespace-nowrap text-[10px] font-semibold leading-none text-fg/80 tabular-nums">
            {icon}
            <span>{minuteLabel(event)}</span>
          </span>
        );
      })}
    </span>
  );
}

function lineupPlayerShortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length < 2 ? parts[0] ?? name : `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
}

// ───────────── Cabecera ─────────────
function MatchHeader({ f, cardCounts, returnTo, isAuthenticated, initialFavorite }: { f: Fixture; cardCounts: { homeYellow: number; homeRed: number; awayYellow: number; awayRed: number }; returnTo: string; isAuthenticated: boolean; initialFavorite: boolean }) {
  const g = statusGroup(f);
  const score = f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome} - ${f.goalsAway}` : null;
  const halftimeScore = f.htHome !== null && f.htAway !== null ? `${f.htHome} - ${f.htAway}` : null;
  const goals = f.events.filter((e) => e.type === "Goal" && e.detail !== "Missed Penalty");
  const scorer = (e: Fixture["events"][number]) =>
    `${e.player} ${e.minute}${e.extra ? `+${e.extra}` : ""}′${e.detail === "Own Goal" ? " (p.p.)" : e.detail === "Penalty" ? " (p)" : ""}`;
  const forHome = goals.filter((e) => (e.detail === "Own Goal" ? e.teamId === f.away.id : e.teamId === f.home.id));
  const forAway = goals.filter((e) => (e.detail === "Own Goal" ? e.teamId === f.home.id : e.teamId === f.away.id));
  const dateLabel = new Intl.DateTimeFormat(getLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: getTz() }).format(new Date(f.timestamp * 1000));
  const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: getTz() }).format(new Date(f.timestamp * 1000));
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
      <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(7rem,auto)_minmax(0,1fr)] items-start gap-1 sm:gap-2">
        <TeamCol teamId={f.home.id} leagueId={f.leagueId} season={f.season} timestamp={f.timestamp} returnTo={returnTo} name={f.home.name} logo={f.home.logo} yellowCards={cardCounts.homeYellow} redCards={cardCounts.homeRed} />
        <div className={`relative flex min-h-[72px] min-w-[7rem] flex-col items-center justify-center text-center ${g === "live" ? "-translate-y-1" : ""}`}>
          {g === "live" ? <><div><LiveMatchClock statusShort={f.statusShort} elapsed={f.elapsed} elapsedSeconds={f.elapsedSeconds} elapsedDisplay={f.elapsedDisplay} /></div><div className="hero-serif whitespace-nowrap text-4xl font-normal leading-normal tracking-normal text-loss sm:text-5xl">{score}</div></>
            : g === "finished" ? (<><div className="text-[10px] font-semibold uppercase tracking-wide text-slate-600"><I18nText text="Final" /></div><div className="hero-serif whitespace-nowrap text-4xl font-normal leading-normal tracking-normal text-slate-900 sm:text-5xl">{score ?? "—"}</div>{halftimeScore && <div className="text-xs text-slate-600">{t("Descanso")} {halftimeScore}</div>}</>)
            : (<><div className="hero-serif whitespace-nowrap text-4xl font-normal leading-normal tracking-normal sm:text-5xl">{timeStr(f.timestamp)}</div>{g === "pending" && <div className="absolute left-1/2 top-full mt-1 w-max max-w-[150px] -translate-x-1/2 rounded-full border border-slate-300/80 bg-white/55 px-2 py-1 text-[10px] leading-tight text-slate-600"><I18nText text="Pendiente de actualizar" /></div>}</>)}
        </div>
        <TeamCol teamId={f.away.id} leagueId={f.leagueId} season={f.season} timestamp={f.timestamp} returnTo={returnTo} name={f.away.name} logo={f.away.logo} yellowCards={cardCounts.awayYellow} redCards={cardCounts.awayRed} />
      </div>
      {(forHome.length > 0 || forAway.length > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-slate-600">
          <div className="space-y-0.5">{forHome.map((e, i) => <div key={i}>{scorer(e)}</div>)}</div>
          <div className="space-y-0.5 text-right">{forAway.map((e, i) => <div key={i}>{scorer(e)}</div>)}</div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <FollowMatchButton fixtureId={f.id} isAuthenticated={isAuthenticated} initialFavorite={initialFavorite} />
        <Link
          href={`/mis-apuestas?fixtureId=${f.id}&leagueId=${f.leagueId}&date=${dateKey}`}
          className="mt-3 inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-slate-400/70 bg-white/75 px-4 py-1.5 text-[11px] font-bold text-slate-900 shadow-sm transition-colors hover:bg-white"
        >
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          <I18nText text="Registrar apuesta" />
        </Link>
      </div>
      </div>
    </section>
  );
}
type TeamColProps = {
  teamId: number;
  leagueId: number;
  season: number;
  timestamp: number;
  returnTo: string;
  name: string;
  logo: string | null;
  yellowCards: number;
  redCards: number;
};
async function TeamColForm({ teamId, leagueId }: Pick<TeamColProps, "teamId" | "leagueId">) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const profile = await getTeamProfile(teamId, false, undefined, now, leagueId, { limit: 5 });
    return <TeamFormRows results={profile.rows.slice(-5).map((row) => row.result)} />;
  } catch (error: unknown) {
    return <span role="alert" className="text-center text-[9px] text-muted"><I18nText text="No se pudo cargar la forma reciente." /> {friendlyApiError(errMsg(error))}</span>;
  }
}
function TeamCol({ teamId, leagueId, season, timestamp, returnTo, name, logo, yellowCards, redCards }: TeamColProps) {
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
      <Suspense fallback={<div aria-hidden="true" className="mt-1 h-5" />}>
        <TeamColForm teamId={teamId} leagueId={leagueId} />
      </Suspense>
    </div>
  );
}
function TeamFormRows({ results }: { results: TeamProfile["rows"][number]["result"][] }) {
  return (
    <div className="mt-1 flex max-w-full flex-wrap justify-center gap-0.5 sm:gap-1">
      {results.map((result, index) => (
        <span key={index} className={`flex h-[18px] w-[18px] items-center justify-center rounded font-serif text-[10px] font-bold text-black sm:h-5 sm:w-5 sm:text-xs ${result === "W" ? "bg-statGreen" : result === "D" ? "bg-statOrange" : "bg-statRed"}`}>{result}</span>
      ))}
    </div>
  );
}

// ───────────── General ─────────────
async function General({ f, pa, pb }: { f: Fixture; pa: TeamProfile; pb: TeamProfile }) {
  const ownGoalEstimate = expectedFor(pa, pb, "goals");
  const lavg = await getLeagueAverages(f.leagueId, f.season).catch(() => null);
  const eg = ownGoalEstimate;
  const model = eg ? poissonModel(eg.home, eg.away) : null;
  const expected: ExpectedMetrics = {
    goals: ownGoalEstimate,
    shots: expectedFor(pa, pb, "shots"),
    shotsOn: expectedFor(pa, pb, "shotsOn"),
    corners: expectedFor(pa, pb, "corners"),
    cards: expectedFor(pa, pb, "cards"),
  };
  if (model) {
    try {
      await savePreMatchPrediction(f, pa, pb, {
        outcomes: { home: model.home / 100, draw: model.draw / 100, away: model.away / 100 },
        markets: { over15: model.over15 / 100, over25: model.over25 / 100, btts: model.btts / 100 },
        expected,
      });
    } catch (error) {
      console.error(`No se pudo guardar la predicción previa al partido ${f.id}:`, error);
    }
  }
  const p1x2 = model;
  const topOutcome = p1x2
    ? [
        { name: f.home.name, value: p1x2.home },
        { name: "Empate", value: p1x2.draw },
        { name: f.away.name, value: p1x2.away },
      ].sort((a, b) => b.value - a.value)[0]
    : null;
  const ex = (m: Metric) => expectedFor(pa, pb, m)?.total ?? null;
  const L = lavg;

  const valueTone = (value: number | null, ref: number | null | undefined, isProbability = false) => {
    const state = ref != null ? tone(value, ref) : isProbability ? pctTone(value) : "none";
    return state === "up" ? "bg-statGreen/20 text-statGreen"
      : state === "flat" ? "bg-statOrange/20 text-statOrange"
        : state === "down" ? "bg-statRed/15 text-statRed" : "bg-card2 text-muted";
  };
  const outcomeTone = (value: number) => {
    const values = [p1x2?.home, p1x2?.draw, p1x2?.away].filter((item): item is number => item !== undefined);
    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    if (highest === lowest) return "bg-statOrange/20 text-statOrange";
    if (value === highest) return "bg-statGreen/20 text-statGreen";
    if (value === lowest) return "bg-statRed/15 text-statRed";
    return "bg-statOrange/20 text-statOrange";
  };
  const prob = (label: string, Icon: typeof IconNet, value: number | null, ref: number | null | undefined) => (
    <article className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-bg/70 px-2.5 py-2.5 sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card2 text-brand"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <span className="block text-xs font-semibold leading-4 text-fg"><I18nText text={label} /></span>
          {ref != null && <span className="mt-0.5 block text-[10px] text-muted"><I18nText text="Media liga" /> <b className="text-fg">{pct(ref)}</b></span>}
        </div>
      </div>
      <strong className={`flex min-h-10 min-w-[4.5rem] shrink-0 items-center justify-center rounded-lg px-3 text-base font-extrabold tabular-nums ${valueTone(value, ref, true)}`}>{pct(value)}</strong>
    </article>
  );
  const average = (label: string, Icon: typeof IconNet, value: number | null, ref: number | null | undefined, digits = 1) => {
    return (
      <article className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-bg/70 px-2.5 py-2.5 sm:px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-card2 text-brand"><Icon className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-semibold leading-4 text-fg"><I18nText text={label} /></span>
            {ref != null && <span className="mt-0.5 block text-[10px] text-muted"><I18nText text="Media de liga" /> <b className="text-fg">{num(ref, 1)}</b></span>}
          </div>
        </div>
        <strong className={`flex min-h-10 min-w-[4.5rem] shrink-0 items-center justify-center rounded-lg px-3 text-base font-extrabold tabular-nums ${valueTone(value, ref)}`}>{num(value, digits)}</strong>
      </article>
    );
  };

  return (
    <div className="min-w-0 space-y-3">
      {p1x2 ? (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-card p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold"><I18nText text="Probabilidad 1X2" /></h2>
            <span className="rounded-full border border-line bg-bg/70 px-2.5 py-1 text-[10px] font-bold tracking-wider text-brand">1X2</span>
          </div>
          <div className="grid min-w-0 grid-cols-3 gap-1.5 sm:gap-2">
            <div className="min-w-0 rounded-xl bg-card2 px-2 py-2.5 text-center sm:px-3">
              <span className="block truncate text-[10px] font-semibold text-muted sm:text-xs">{f.home.name}</span>
              <strong className={`mt-1 block rounded-lg px-2 py-1 text-xl font-extrabold tabular-nums sm:text-2xl ${outcomeTone(p1x2.home)}`}>{Math.round(p1x2.home)}%</strong>
            </div>
            <div className="min-w-0 rounded-xl bg-card2 px-2 py-2.5 text-center sm:px-3">
              <span className="block truncate text-[10px] font-semibold text-muted sm:text-xs"><I18nText text="Empate" /></span>
              <strong className={`mt-1 block rounded-lg px-2 py-1 text-xl font-extrabold tabular-nums sm:text-2xl ${outcomeTone(p1x2.draw)}`}>{Math.round(p1x2.draw)}%</strong>
            </div>
            <div className="min-w-0 rounded-xl bg-card2 px-2 py-2.5 text-center sm:px-3">
              <span className="block truncate text-[10px] font-semibold text-muted sm:text-xs">{f.away.name}</span>
              <strong className={`mt-1 block rounded-lg px-2 py-1 text-xl font-extrabold tabular-nums sm:text-2xl ${outcomeTone(p1x2.away)}`}>{Math.round(p1x2.away)}%</strong>
            </div>
          </div>
        </section>
      ) : <Notice tone="warn"><I18nText text="Datos insuficientes para estimar el 1X2 (pocos partidos recientes o cobertura limitada)." /></Notice>}

      <section className="min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold"><I18nText text="Probabilidades clave" /></h2>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted"><I18nText text="Modelo" /></span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {prob("Más de 2,5 goles", IconShoe, model?.over25 ?? null, L?.over25)}
          {prob("Más de 1,5 goles", IconShoe, model?.over15 ?? null, L?.over15)}
          {prob("Ambos marcan", IconSwap, model?.btts ?? null, L?.btts)}
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold"><I18nText text="Promedios previstos" /></h2>
          <span className="rounded-full bg-card2 px-2.5 py-1 text-[10px] font-semibold text-muted">{FORM_MATCHES} <I18nText text="Partidos" /></span>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {average("Promedio de goles", IconBall, eg?.total ?? null, L?.goals, 2)}
          {average("Promedio de tarjetas", IconCard, ex("cards"), L?.cards)}
          {average("Promedio de córners", IconCorner, ex("corners"), L?.corners)}
          {average("Promedio de tiros", IconTarget, ex("shots"), L?.shots)}
          {average("Promedio de TAP", IconNet, ex("shotsOn"), L?.shotsOn)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[10px] font-medium text-muted">
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-statGreen" /><I18nText text="Por encima" /></span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-statOrange" /><I18nText text="Similar" /></span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-statRed" /><I18nText text="Por debajo" /></span>
          <span className="ml-auto inline-flex items-center gap-1.5"><i className="h-3 w-0.5 bg-fg/70" /><I18nText text="Media de liga" /></span>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-4">
        <h2 className="text-sm font-extrabold"><I18nText text="Contexto estadístico" /></h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {eg ? <><I18nText text="La proyección central es de" /> <b className="text-fg">{num(eg.total, 2)}</b> <I18nText text="goles totales." /></> : <I18nText text="No hay muestra suficiente para generar contexto de goles." />}
          {topOutcome ? <> <I18nText text="El resultado individual más probable es" /> <b className="text-fg"><I18nText text={topOutcome.name} /></b> ({pct(topOutcome.value)}).</> : null}
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-muted"><I18nText text="Lectura descriptiva del modelo; no es una recomendación ni una garantía." /></p>
      </section>
    </div>
  );
}

// ───────────── Tiros / Córners / Tarjetas ─────────────
async function Block({ f, pa, pb, tab }: {
  f: Fixture; pa: TeamProfile; pb: TeamProfile; tab: "tiros" | "corners" | "tarjetas";
}) {
  const [lavg, cardLeaders] = await Promise.all([
    getLeagueAverages(f.leagueId, f.season).catch(() => null),
    tab === "tarjetas" ? getLeagueCardLeaders(f.leagueId, f.season) : Promise.resolve([]),
  ]);
  if (tab === "tarjetas") {
    return <CardsAnalysis
      fixture={f}
      homeProfile={pa}
      awayProfile={pb}
      sampleSize={FORM_MATCHES}
      leagueAverage={lavg?.cards ?? null}
      leaders={cardLeaders}
      locale={getLocale()}
    />;
  }
  if (tab === "corners") {
    return <CornersAnalysis
      fixture={f}
      homeProfile={pa}
      awayProfile={pb}
      sampleSize={FORM_MATCHES}
      leagueAverage={lavg?.corners ?? null}
      locale={getLocale()}
    />;
  }
  return <ShotsAnalysis
    fixture={f}
    homeProfile={pa}
    awayProfile={pb}
    sampleSize={FORM_MATCHES}
    leagueAverage={lavg}
    locale={getLocale()}
  />;
}
