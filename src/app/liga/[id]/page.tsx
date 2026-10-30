import { Header } from "@/components/Header";
import { Notice } from "@/components/ui";
import { LeagueCompetition } from "@/components/LeagueCompetition";
import {
  getLeagueFixtures,
  getLeagueSeasons,
  getLeagueStandingsZones,
  getLeagueTeams,
  getLeagueTopScorers,
  getLeagues,
  getTeamLogoFallbackUrl,
} from "@/lib/apifootball";
import { csvLeagueById } from "@/lib/csvLeagues";
import { getLeagueLogoUrl } from "@/lib/leagueLogo";
import { I18nText } from "@/components/I18nProvider";
import { getTz } from "@/lib/prefs";
import { getUser } from "@/lib/auth";
import { getFavoriteFixtureIds, getLeagueFollowStatus } from "@/lib/favorites";
import { apiEnabled } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function LeaguePage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return <><Header back="/leagues" /><main className="p-4"><Notice><I18nText text="Liga no válida." /></Notice></main></>;
  }

  const [leagues, seasons] = await Promise.all([getLeagues(), getLeagueSeasons(id)]);
  const league = leagues.find((item) => item.id === id) ?? csvLeagueById(id);
  const leagueLogo = league && "logo" in league ? league.logo : null;
  const currentSeason = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const availableSeasons = seasons.length ? seasons : [currentSeason];
  const initialTab = searchParams.tab === "table" ? "table" : "calendar";
  const requestedSeason = Number(searchParams.season);
  const selected = availableSeasons.includes(requestedSeason) ? requestedSeason : availableSeasons[0];
  const [teams, fixturesResult, scorersResult, zonesResult, user] = await Promise.all([
    getLeagueTeams(id, selected),
    getLeagueFixtures(id, selected).then((fixtures) => ({ fixtures, error: null as string | null }), (error: unknown) => ({ fixtures: [], error: message(error) })),
    getLeagueTopScorers(id, selected).then((scorers) => ({ scorers, error: null as string | null }), (error: unknown) => ({ scorers: [], error: message(error) })),
    getLeagueStandingsZones(id, selected).then((zones) => ({ zones, error: null as string | null }), (error: unknown) => ({ zones: [], error: message(error) })),
    getUser(),
  ]);
  const [favorites, followLookup] = await Promise.all([
    user ? getFavoriteFixtureIds(user.id, fixturesResult.fixtures.map((fixture) => fixture.id)) : Promise.resolve({ favoriteIds: new Set<number>(), error: false }),
    user ? getLeagueFollowStatus(user.id, id) : Promise.resolve({ following: false, error: false }),
  ]);

  return (
    <>
      <Header back="/leagues" />
      <main className="space-y-4 px-3 pb-8 pt-4 sm:px-4 lg:mx-auto lg:max-w-3xl">
        {fixturesResult.error && <Notice tone="warn"><I18nText text="No se pudo cargar el calendario:" /> {fixturesResult.error}</Notice>}
        {favorites.error && <Notice tone="warn"><I18nText text="No se pudieron cargar tus favoritos. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        {followLookup.error && <Notice tone="warn"><I18nText text="No se pudo comprobar si sigues esta liga. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        {league ? (
          <LeagueCompetition
            key={`${id}:${selected}`}
            leagueId={id}
            apiEnabled={apiEnabled}
            initialTab={initialTab}
            leagueName={league.name}
            leagueLogo={getLeagueLogoUrl(id, leagueLogo)}
            initialFollowing={followLookup.following}
            currentSeason={currentSeason}
            country={league.country}
            flag={league.flag}
            season={selected}
            seasons={availableSeasons}
            teams={teams.map((team) => ({ ...team, logoFallback: getTeamLogoFallbackUrl(team.name, league.country) }))}
            fixtures={fixturesResult.fixtures}
            standingsZones={zonesResult.zones}
            standingsZoneError={zonesResult.error}
            scorers={scorersResult.scorers}
            scorerError={scorersResult.error}
            favoriteIds={[...favorites.favoriteIds]}
            isAuthenticated={!!user}
            timeZone={getTz()}
          />
        ) : <Notice><I18nText text="No se encontró esta liga." /></Notice>}
      </main>
    </>
  );
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
