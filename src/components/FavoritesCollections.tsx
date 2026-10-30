"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Trash2 } from "lucide-react";
import type { Fixture } from "@/lib/types";
import { useT } from "./I18nProvider";
import { Shield } from "./Shield";
import { getLeagueLogoUrl } from "@/lib/leagueLogo";

export type FollowedLeagueCard = { id: number; name: string; country: string; logo: string | null };
export type FollowedTeamCard = {
  id: number;
  name: string;
  logo: string | null;
  logoFallback: string | null;
  nextFixture: Fixture | null;
  nextFixtureDate: string | null;
  nextFixtureDateKey: string | null;
};

export type FavoriteFixtureCard = {
  fixture: Fixture;
  date: string;
  dateKey: string;
};

export function FavoritesCollections({
  leagues: initialLeagues,
  teams: initialTeams,
  fixtures: initialFixtures,
}: {
  leagues: FollowedLeagueCard[];
  teams: FollowedTeamCard[];
  fixtures: FavoriteFixtureCard[];
}) {
  const [leagues, setLeagues] = useState(initialLeagues);
  const [teams, setTeams] = useState(initialTeams);
  const [fixtures, setFixtures] = useState(initialFixtures);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useT();

  async function removeLeague(league: FollowedLeagueCard) {
    const key = `league:${league.id}`;
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/league-follows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: league.id, leagueName: league.name, country: league.country, logo: league.logo }),
      });
      const result = await response.json() as { following?: boolean; error?: string };
      if (!response.ok || result.following !== false) {
        throw new Error(result.error || "No se pudo dejar de seguir la liga.");
      }
      setLeagues((current) => current.filter((item) => item.id !== league.id));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo dejar de seguir la liga.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    const syncFavorite = (event: Event) => {
      const detail = (event as CustomEvent<{ fixtureId: number; favorite: boolean }>).detail;
      if (!detail.favorite) {
        setFixtures((current) => current.filter((item) => item.fixture.id !== detail.fixtureId));
      }
    };
    window.addEventListener("pickzone:favorite-updated", syncFavorite);
    return () => window.removeEventListener("pickzone:favorite-updated", syncFavorite);
  }, []);

  async function removeTeam(team: FollowedTeamCard) {
    const key = `team:${team.id}`;
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/team-follows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, teamName: team.name }),
      });
      const result = await response.json() as { following?: boolean; error?: string };
      if (!response.ok || result.following !== false) {
        throw new Error(result.error || "No se pudo dejar de seguir al equipo.");
      }
      setTeams((current) => current.filter((item) => item.id !== team.id));
      window.dispatchEvent(new CustomEvent("pickzone:team-follow-updated", {
        detail: { teamId: team.id, following: false, teamName: team.name },
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo dejar de seguir al equipo.");
    } finally {
      setBusy(null);
    }
  }

  async function removeFixture(fixtureId: number) {
    const key = `fixture:${fixtureId}`;
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const response = await fetch("/api/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId }),
      });
      const result = await response.json() as { favorite?: boolean; error?: string };
      if (!response.ok || result.favorite !== false) {
        throw new Error(result.error || "No se pudo quitar el favorito. Comprueba la configuración de la base de datos.");
      }
      setFixtures((current) => current.filter((item) => item.fixture.id !== fixtureId));
      window.dispatchEvent(new CustomEvent("pickzone:favorite-updated", {
        detail: { fixtureId, favorite: false },
      }));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo quitar el favorito.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{t(error)}</p>}
      {leagues.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-extrabold uppercase leading-none text-brand">{t("Ligas")} ({leagues.length})</h2>
          <div className="space-y-2">
            {leagues.map((league) => (
              <article key={league.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                <Link href={`/liga/${league.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Shield src={getLeagueLogoUrl(league.id, league.logo)} alt="" size={36} />
                  <span className="min-w-0"><span className="block truncate text-sm font-extrabold uppercase">{league.name}</span><span className="block truncate text-xs text-muted">{league.country}</span></span>
                </Link>
                <button type="button" aria-label={`${t("Dejar de seguir")} ${league.name}`} title={t("Dejar de seguir")} disabled={busy !== null} onClick={() => void removeLeague(league)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-loss disabled:opacity-50">
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {teams.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-extrabold uppercase leading-none text-brand">{t("Equipos")} ({teams.length})</h2>
          <div className="space-y-2">
            {teams.map((team) => (
              <article key={team.id} className="rounded-2xl border border-line bg-transparent p-3">
                <div className="flex items-center gap-3">
                  <Link href={`/equipo/${team.id}?name=${encodeURIComponent(team.name)}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Shield src={team.logo} fallbackSrc={team.logoFallback} alt="" size={40} />
                    <span className="truncate text-sm font-extrabold uppercase">{team.name}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`${t("Dejar de seguir a")} ${team.name}`}
                    title={t("Dejar de seguir")}
                    disabled={busy !== null}
                    onClick={() => void removeTeam(team)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-loss disabled:opacity-50"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                {team.nextFixture ? (
                  <Link
                    href={`/match/${team.nextFixture.id}?date=${encodeURIComponent(team.nextFixtureDateKey ?? "")}&league=${team.nextFixture.leagueId}`}
                    className="mt-3 flex min-h-8 min-w-0 items-center gap-2 rounded-xl bg-card2 px-3 py-1.5 text-xs"
                  >
                    <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      vs {team.nextFixture.home.id === team.id ? team.nextFixture.away.name : team.nextFixture.home.name}
                    </span>
                    <span className="shrink-0 text-right font-bold text-muted">{team.nextFixtureDate}</span>
                  </Link>
                ) : (
                  <p className="mt-3 rounded-xl bg-card2 px-3 py-2 text-xs text-muted">{t("No hay próximo partido disponible.")}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {fixtures.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-line bg-card">
          <h2 className="border-b border-line px-3 py-3 font-display text-lg font-extrabold uppercase leading-none">{t("Partidos seguidos")} ({fixtures.length})</h2>
          <div>
            {fixtures.map(({ fixture, date, dateKey }) => (
              <article key={fixture.id} className="flex items-center gap-2 border-b border-line px-3 py-3 last:border-b-0">
                <Shield src={fixture.home.logo} alt="" size={28} />
                <Link href={`/match/${fixture.id}?date=${encodeURIComponent(dateKey)}&league=${fixture.leagueId}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{fixture.home.name} - {fixture.away.name}</span>
                  <span className="mt-1 block text-xs text-muted">{date}</span>
                </Link>
                <button
                  type="button"
                  aria-label={`${t("Quitar de favoritos")}: ${fixture.home.name} - ${fixture.away.name}`}
                  title={t("Quitar de favoritos")}
                  disabled={busy !== null}
                  onClick={() => void removeFixture(fixture.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-loss disabled:opacity-50"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
