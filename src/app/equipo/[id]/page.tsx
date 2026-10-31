import Link from "next/link";
import { Header } from "@/components/Header";
import { MatchRow } from "@/components/MatchRow";
import { Notice } from "@/components/ui";
import { Shield, Flag } from "@/components/Shield";
import { TeamPageTabs } from "@/components/TeamPageTabs";
import {
  getLeagueSeasons,
  getLeagueFixtures,
  getLeagueStandingsZones,
  getLeagueTeams,
  getTeamLogoFallbackUrl,
  getTeamLogoUrl,
  getTeamRecentFixtures,
  getTeamSeasonMatchSeries,
  getTeamSeasonProfile,
  getTeamUpcomingFixtures,
  getTeamProfile,
} from "@/lib/apifootball";
import { countryEs, errMsg } from "@/lib/format";
import { getLeagueLogoUrl } from "@/lib/leagueLogo";
import { getUser } from "@/lib/auth";
import { getFavoriteFixtureIds, getTeamFollowStatus } from "@/lib/favorites";
import { I18nText } from "@/components/I18nProvider";
import { FollowTeamButton } from "@/components/FollowTeamButton";
import type { Fixture, TeamProfile } from "@/lib/types";
import { TeamStatsChart, type TeamGamePoint } from "@/components/TeamStatsChart";
import { SearchLauncher } from "@/components/SearchModal";
import { csvLeagueById } from "@/lib/csvLeagues";
import { getTz } from "@/lib/prefs";
import { LeagueStandingsTable } from "@/components/LeagueStandingsTable";

export const dynamic = "force-dynamic";

function safeReturnPath(value: string | undefined) {
  let candidate = value ?? "";
  for (let i = 0; i < 3; i++) {
    if (/^\/match\/\d+(?:\?[^#]*)?$/.test(candidate)) return candidate;
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
    } catch { break; }
  }
  return "/";
}

function dateForFixture(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getTz(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp * 1000);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function displayDateForFixture(timestamp: number) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: getTz(),
    day: "2-digit",
    month: "2-digit",
  }).format(timestamp * 1000);
}

function FixtureGroups({
  fixtures,
  favoriteIds,
  isAuthenticated,
  showDate = false,
}: {
  fixtures: Fixture[];
  favoriteIds: Set<number>;
  isAuthenticated: boolean;
  showDate?: boolean;
}) {
  if (!fixtures.length) {
    return <Notice><I18nText text="No hay partidos disponibles." /></Notice>;
  }
  return (
    <div className="overflow-hidden">
      {fixtures.map((fixture) => (
        <MatchRow
          key={fixture.id}
          f={fixture}
          date={dateForFixture(fixture.timestamp)}
          displayDate={displayDateForFixture(fixture.timestamp)}
          isAuthenticated={isAuthenticated}
          initialFavorite={favoriteIds.has(fixture.id)}
          showLeagueLogo
          showDate={showDate}
        />
      ))}
    </div>
  );
}

export default async function Page({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const id = Number(params.id);
  const leagueId = Number(searchParams.league) || undefined;
  const back = safeReturnPath(searchParams.from);
  const userPromise = getUser();
  const seasons = leagueId ? await getLeagueSeasons(leagueId) : [];
  const requestedSeason = Number(searchParams.season);
  const season = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];
  const teams = leagueId ? await getLeagueTeams(leagueId, season) : [];
  const name = searchParams.name || teams.find((team) => team.id === id)?.name;
  let profile: TeamProfile | null = null;
  let recent: Fixture[] = [];
  let upcoming: Fixture[] = [];
  let chartGames: TeamGamePoint[] = [];
  let profileError: string | null = null;
  let fixtureError: string | null = null;
  let seriesError: string | null = null;

  const [profileResult, recentResult, upcomingResult, seriesResult] = await Promise.allSettled([
    name ? (leagueId && season
      ? getTeamSeasonProfile(id, name, leagueId, season)
      : getTeamProfile(id, true, season, Infinity, leagueId, name))
      : Promise.resolve(null),
    getTeamRecentFixtures(id, 15, leagueId, name),
    getTeamUpcomingFixtures(id, 15, leagueId, name),
    name && leagueId && season ? getTeamSeasonMatchSeries(id, name, leagueId, season, teams) : Promise.resolve([]),
  ]);
  if (profileResult.status === "fulfilled") profile = profileResult.value;
  else profileError = errMsg(profileResult.reason);
  if (recentResult.status === "fulfilled") recent = recentResult.value;
  else fixtureError = errMsg(recentResult.reason);
  if (upcomingResult.status === "fulfilled") upcoming = upcomingResult.value;
  else fixtureError = fixtureError ? `${fixtureError}; ${errMsg(upcomingResult.reason)}` : errMsg(upcomingResult.reason);
  if (seriesResult.status === "fulfilled") {
    const country = csvLeagueById(leagueId ?? 0)?.country ?? "";
    chartGames = seriesResult.value.map((game) => ({
      ...game,
      opponentLogo: getTeamLogoUrl(game.opponent, country),
      opponentLogoFallback: getTeamLogoFallbackUrl(game.opponent, country),
    }));
  } else seriesError = errMsg(seriesResult.reason);

  const teamName = name ?? `Equipo ${id}`;
  const country = csvLeagueById(leagueId ?? 0)?.country ?? upcoming[0]?.country ?? recent[0]?.country ?? "";
  const standingsLeagueId = leagueId ?? recent[0]?.leagueId ?? upcoming[0]?.leagueId;
  const standingsSeason = (leagueId ? season : undefined)
    ?? recent.find((fixture) => fixture.leagueId === standingsLeagueId)?.season
    ?? upcoming.find((fixture) => fixture.leagueId === standingsLeagueId)?.season;
  let standingsTeams: Awaited<ReturnType<typeof getLeagueTeams>> = [];
  let standingsFixtures: Fixture[] = [];
  let standingsZones: Awaited<ReturnType<typeof getLeagueStandingsZones>> = [];
  let standingsDataError: string | null = null;
  let standingsZoneError: string | null = null;
  if (standingsLeagueId && standingsSeason) {
    const [teamsResult, fixturesResult, zonesResult] = await Promise.allSettled([
      leagueId === standingsLeagueId && season === standingsSeason
        ? Promise.resolve(teams)
        : getLeagueTeams(standingsLeagueId, standingsSeason),
      getLeagueFixtures(standingsLeagueId, standingsSeason),
      getLeagueStandingsZones(standingsLeagueId, standingsSeason),
    ]);
    if (teamsResult.status === "fulfilled") standingsTeams = teamsResult.value;
    else standingsDataError = errMsg(teamsResult.reason);
    if (fixturesResult.status === "fulfilled") standingsFixtures = fixturesResult.value;
    else standingsDataError = standingsDataError ? `${standingsDataError}; ${errMsg(fixturesResult.reason)}` : errMsg(fixturesResult.reason);
    if (zonesResult.status === "fulfilled") standingsZones = zonesResult.value;
    else standingsZoneError = errMsg(zonesResult.reason);
  }
  const standingsCountry = csvLeagueById(standingsLeagueId ?? 0)?.country ?? country;
  const standings = standingsLeagueId && standingsSeason ? (
    <LeagueStandingsTable
      leagueId={standingsLeagueId}
      season={standingsSeason}
      teams={standingsTeams.map((team) => ({ ...team, logoFallback: getTeamLogoFallbackUrl(team.name, standingsCountry) }))}
      fixtures={standingsFixtures}
      zones={standingsZones}
      currentTeamId={id}
      dataError={standingsDataError}
      zoneError={standingsZoneError}
    />
  ) : null;
  const league = leagueId ? csvLeagueById(leagueId) : null;
  const competitionName = league?.name ?? upcoming[0]?.leagueName ?? recent[0]?.leagueName;
  const competitionLogo = upcoming[0]?.leagueLogo ?? recent[0]?.leagueLogo ?? null;
  const logo = getTeamLogoUrl(teamName, country);
  const recentForm = profile?.rows.slice(-5) ?? [];
  const competitions = new Map<number, { name: string; logo: string | null }>();
  for (const fixture of [...recent, ...upcoming]) {
    competitions.set(fixture.leagueId, { name: fixture.leagueName, logo: fixture.leagueLogo });
  }
  if (leagueId && competitionName) {
    competitions.set(leagueId, { name: competitionName, logo: competitionLogo });
  }
  const user = await userPromise;
  const [favoriteLookup, followLookup] = user
    ? await Promise.all([
      getFavoriteFixtureIds(user.id, [...recent, ...upcoming].map((fixture) => fixture.id)),
      getTeamFollowStatus(user.id, id),
    ])
    : [
      { favoriteIds: new Set<number>(), error: false },
      { following: false, error: false },
    ];

  const statistics = (
    <>
      {seriesError && <Notice tone="warn">{seriesError}</Notice>}
      {chartGames.length > 0 && <TeamStatsChart games={chartGames} />}
      {profile && chartGames.length === 0 && <Notice><I18nText text="Hay estadísticas resumidas, pero no un historial partido a partido disponible para dibujar la gráfica." /></Notice>}
      {!profile && !seriesError && <Notice><I18nText text="Sin estadísticas disponibles para este equipo." /></Notice>}
    </>
  );

  return (
    <>
      <Header back={back} />
      <main className="space-y-4 px-3 pb-8 pt-5 lg:mx-auto lg:max-w-3xl lg:px-4">
        <section
          className="relative isolate overflow-hidden rounded-3xl border border-slate-300/80 p-4 text-slate-900 shadow-sm sm:p-6"
          style={{ background: "#f1f3f0" }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-32 z-0 flex h-96 w-96 items-center justify-center opacity-35 blur-[64px]">
            <Shield src={logo} fallbackSrc={getTeamLogoFallbackUrl(teamName, country)} alt="" size={300} />
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-300/70 bg-white sm:h-24 sm:w-24">
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <Shield src={logo} fallbackSrc={getTeamLogoFallbackUrl(teamName, country)} alt={teamName} size={56} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                {country && <><Flag src={league?.flag ?? recent[0]?.flag ?? upcoming[0]?.flag ?? null} />{countryEs(country, league?.flag ?? null)}</>}
              </div>
              <div className="mt-1">
                <h1 className="min-w-0 truncate text-2xl font-black uppercase leading-tight sm:text-3xl">{teamName}</h1>
                <FollowTeamButton teamId={id} teamName={teamName} isAuthenticated={!!user} initialFollowing={followLookup.following} />
              </div>
            </div>
          </div>
          {recentForm.length > 0 && (
            <div className="relative z-10 mt-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-600"><I18nText text="Últimos 5" /></div>
              <div className="mt-1 flex gap-1">
                {recentForm.map((row) => {
                  const letter = row.result === "W" ? "V" : row.result === "D" ? "E" : "D";
                  const label = row.result === "W" ? "Victoria" : row.result === "D" ? "Empate" : "Derrota";
                  return (
                    <span
                      key={`${row.fixtureId}-${row.ts}`}
                      title={`${label} · ${new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", timeZone: "Europe/Madrid" }).format(row.ts * 1000)}`}
                      className={`grid h-5 w-5 place-items-center rounded text-[9px] font-black text-slate-900 ${row.result === "W" ? "bg-statGreen" : row.result === "D" ? "bg-statOrange" : "bg-statRed"}`}
                    >
                      {letter}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {competitions.size > 0 && (
            <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">
              {[...competitions.entries()].map(([competitionId, item]) => (
                <Link
                  key={competitionId}
                  href={`/liga/${competitionId}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-white/50 px-2.5 py-1 text-[10px] font-semibold text-slate-700"
                >
                  <Shield src={getLeagueLogoUrl(competitionId, item.logo)} alt="" size={16} />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {profileError && <Notice tone="warn">{profileError}</Notice>}
        {fixtureError && <Notice tone="warn">{fixtureError}</Notice>}
        {favoriteLookup.error && <Notice tone="warn"><I18nText text="No se pudieron cargar tus favoritos. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        {followLookup.error && <Notice tone="warn"><I18nText text="No se pudieron cargar los equipos seguidos. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        <TeamPageTabs
          resultCount={recent.length}
          upcomingCount={upcoming.length}
          results={<FixtureGroups fixtures={recent} favoriteIds={favoriteLookup.favoriteIds} isAuthenticated={!!user} />}
          upcoming={<FixtureGroups fixtures={upcoming} favoriteIds={favoriteLookup.favoriteIds} isAuthenticated={!!user} showDate />}
          statistics={statistics}
          standings={standings}
        />
        {recent.length === 0 && upcoming.length === 0 && !fixtureError && (
          <div className="text-center text-xs text-muted"><SearchLauncher className="text-brand"><I18nText text="Buscar equipos" /></SearchLauncher></div>
        )}
      </main>
    </>
  );
}
