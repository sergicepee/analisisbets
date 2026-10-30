import { redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { FavoritesCollections, type FollowedTeamCard, type FavoriteFixtureCard } from "@/components/FavoritesCollections";
import { I18nText } from "@/components/I18nProvider";
import { Notice } from "@/components/ui";
import { getUser, authConfigured } from "@/lib/auth";
import { getFixture, getTeamLogoFallbackUrl, getTeamLogoUrl, getTeamUpcomingFixtures } from "@/lib/apifootball";
import { getUserFavoriteFixtureIds, getUserFollowedTeams } from "@/lib/favorites";
import { getTz } from "@/lib/prefs";
import { Star } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function dateForFixture(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: getTz() }).format(timestamp * 1000);
}

function dateTimeForFixture(timestamp: number) {
  const parts = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: getTz(),
  }).formatToParts(timestamp * 1000);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("weekday")}, ${value("day")} ${value("month")} · ${value("hour")}:${value("minute")}`;
}

export default async function FavoritesPage() {
  if (!authConfigured()) {
    return (
      <main className="flex min-h-screen flex-col px-4 pb-8 pt-6 lg:mx-auto lg:max-w-3xl">
        <div className="mb-6"><BackButton /></div>
        <div className="space-y-4">
          <h1 className="flex items-center gap-2 font-display text-4xl font-extrabold uppercase leading-none"><Star aria-hidden="true" className="h-6 w-6 shrink-0 fill-brand text-brand" /><I18nText text="Mis favoritos" /></h1>
          <Notice tone="warn"><I18nText text="La autenticación aún no está configurada (ver README)." /></Notice>
        </div>
        <FavoritesFooter />
      </main>
    );
  }

  const user = await getUser();
  if (!user) redirect("/login?next=%2Ffavoritos");

  const [lookup, teamLookup] = await Promise.all([
    getUserFavoriteFixtureIds(user.id),
    getUserFollowedTeams(user.id),
  ]);
  const results = await Promise.allSettled(lookup.fixtureIds.map((id) => getFixture(id)));
  results.forEach((result, index) => {
    if (result.status === "rejected") console.error(`Could not load favorite fixture ${lookup.fixtureIds[index]}:`, result.reason);
  });
  const fixtures = results.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
  const unavailableCount = results.filter((result) => result.status === "rejected" || (result.status === "fulfilled" && result.value === null)).length;
  const fixtureCards: FavoriteFixtureCard[] = fixtures.map((fixture) => ({
    fixture,
    date: dateTimeForFixture(fixture.timestamp),
    dateKey: dateForFixture(fixture.timestamp),
  }));
  const teamResults = await Promise.allSettled(teamLookup.teams.map(async (team): Promise<FollowedTeamCard> => {
    const [nextFixture] = await getTeamUpcomingFixtures(team.id, 1);
    return {
      ...team,
      logo: getTeamLogoUrl(team.name, ""),
      logoFallback: getTeamLogoFallbackUrl(team.name, ""),
      nextFixture: nextFixture ?? null,
      nextFixtureDate: nextFixture ? dateTimeForFixture(nextFixture.timestamp) : null,
      nextFixtureDateKey: nextFixture ? dateForFixture(nextFixture.timestamp) : null,
    };
  }));
  teamResults.forEach((result, index) => {
    if (result.status === "rejected") console.error(`Could not load upcoming fixture for followed team ${teamLookup.teams[index].id}:`, result.reason);
  });
  const teams: FollowedTeamCard[] = teamLookup.teams.map((team, index) => {
    const result = teamResults[index];
    return result.status === "fulfilled"
      ? result.value
      : {
        ...team,
        logo: getTeamLogoUrl(team.name, ""),
        logoFallback: getTeamLogoFallbackUrl(team.name, ""),
        nextFixture: null,
        nextFixtureDate: null,
        nextFixtureDateKey: null,
      };
  });
  const upcomingErrors = teamResults.filter((result) => result.status === "rejected").length;

  return (
    <main className="flex min-h-screen flex-col px-4 pb-8 pt-6 lg:mx-auto lg:max-w-3xl">
      <div className="mb-6"><BackButton /></div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-4xl font-extrabold uppercase leading-none"><Star aria-hidden="true" className="h-6 w-6 shrink-0 fill-brand text-brand" /><I18nText text="Mis favoritos" /></h1>
        <p className="mt-2 text-sm leading-relaxed text-muted"><I18nText text="Recibirás avisos de goles, inicio y final de tus equipos y partidos seguidos." /></p>
        <p className="text-sm font-bold text-brand"><I18nText text="Todo sincronizado con tu cuenta." /></p>
      </div>
      <div className="flex-1 space-y-5">
        {lookup.error && <Notice tone="warn"><I18nText text="No se pudieron cargar tus favoritos. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        {teamLookup.error && <Notice tone="warn"><I18nText text="No se pudieron cargar los equipos seguidos. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        {!lookup.error && unavailableCount > 0 && <Notice tone="warn"><I18nText text="No se pudieron cargar algunos partidos favoritos." /></Notice>}
        {upcomingErrors > 0 && <Notice tone="warn"><I18nText text="No se pudo cargar el próximo partido de algunos equipos." /></Notice>}
        {(!lookup.error && !teamLookup.error && teams.length === 0 && fixtureCards.length === 0) && (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-line bg-card px-6 py-10 text-center">
            <p className="max-w-md text-sm leading-relaxed text-muted">
              <I18nText text="Todavía no tienes favoritos. Usa el buscador de arriba o pulsa la estrella en cualquier partido." />
            </p>
            <Link href="/buscar" className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black">
              <I18nText text="Buscar partidos" />
            </Link>
          </div>
        )}
        {(!lookup.error || !teamLookup.error) && (
          <FavoritesCollections
            teams={teamLookup.error ? [] : teams}
            fixtures={lookup.error ? [] : fixtureCards}
          />
        )}
      </div>
      <FavoritesFooter />
    </main>
  );
}

function FavoritesFooter() {
  return (
    <footer className="mt-6 border-t border-line pt-8">
      <span className="font-display text-3xl font-extrabold uppercase tracking-tight">PICKZONE<span className="text-brand">.</span></span>
    </footer>
  );
}
