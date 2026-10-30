import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { FavoriteFixturesList } from "@/components/FavoriteFixturesList";
import { I18nText } from "@/components/I18nProvider";
import { Notice } from "@/components/ui";
import { getUser, authConfigured } from "@/lib/auth";
import { getFixture, getTeamLogoUrl } from "@/lib/apifootball";
import { getUserFavoriteFixtureIds, getUserFollowedTeams } from "@/lib/favorites";
import { getTz } from "@/lib/prefs";
import { Star } from "lucide-react";
import Link from "next/link";
import { Shield } from "@/components/Shield";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function dateForFixture(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: getTz() }).format(timestamp * 1000);
}

export default async function FavoritesPage() {
  if (!authConfigured()) {
    return (
      <>
        <Header back="/" />
        <main className="space-y-4 px-4 pb-8 pt-6 lg:mx-auto lg:max-w-3xl">
          <h1 className="flex items-center gap-2 text-3xl font-black uppercase"><Star aria-hidden="true" className="h-6 w-6 shrink-0 fill-brand text-brand" /><I18nText text="Mis favoritos" /></h1>
          <Notice tone="warn"><I18nText text="La autenticación aún no está configurada (ver README)." /></Notice>
        </main>
      </>
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
  const dates = Object.fromEntries(fixtures.map((fixture) => [fixture.id, dateForFixture(fixture.timestamp)]));

  return (
    <>
      <Header back="/" />
      <main className="space-y-4 px-4 pb-8 pt-6 lg:mx-auto lg:max-w-3xl">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black uppercase"><Star aria-hidden="true" className="h-6 w-6 shrink-0 fill-brand text-brand" /><I18nText text="Mis favoritos" /></h1>
          <p className="mt-1 text-sm leading-relaxed text-muted"><I18nText text="Tus equipos y partidos favoritos se sincronizan con tu cuenta." /></p>
        </div>
        {lookup.error && <Notice tone="warn"><I18nText text="No se pudieron cargar tus favoritos. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        {teamLookup.error && <Notice tone="warn"><I18nText text="No se pudieron cargar los equipos seguidos. Comprueba que la tabla esté configurada en Supabase." /></Notice>}
        {!lookup.error && unavailableCount > 0 && <Notice tone="warn"><I18nText text="No se pudieron cargar algunos partidos favoritos." /></Notice>}
        {teamLookup.teams.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wide"><I18nText text="Equipos seguidos" /></h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-card">
              {teamLookup.teams.map((team) => (
                <Link
                  key={team.id}
                  href={`/equipo/${team.id}?name=${encodeURIComponent(team.name)}`}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-card2"
                >
                  <Shield src={getTeamLogoUrl(team.name, "")} alt="" size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{team.name}</span>
                  <Star aria-hidden="true" className="h-4 w-4 shrink-0 fill-brand text-brand" />
                </Link>
              ))}
            </div>
          </section>
        )}
        {!lookup.error && (fixtures.length > 0 || lookup.fixtureIds.length === 0) && (
          <FavoriteFixturesList
            fixtures={fixtures}
            dates={dates}
            showEmptyState={teamLookup.teams.length === 0}
          />
        )}
      </main>
    </>
  );
}
