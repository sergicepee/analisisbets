"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Trash2 } from "lucide-react";
import type { Fixture } from "@/lib/types";
import { useT } from "./I18nProvider";
import { Shield } from "./Shield";
import { getLeagueLogoUrl } from "@/lib/leagueLogo";
import { MatchRow } from "./MatchRow";

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
  const t = useT();
  const hadInitialItems = initialLeagues.length > 0 || initialTeams.length > 0 || initialFixtures.length > 0;

  async function removeLeague(league: FollowedLeagueCard) {
    const key = `league:${league.id}`;
    if (busy) return;
    setBusy(key);
    setError(null);
    setLeagues((current) => current.filter((item) => item.id !== league.id));
    const dispatchFollowing = (following: boolean) => {
      window.dispatchEvent(new CustomEvent("pickzone:league-follow-updated", {
        detail: { leagueId: league.id, following },
      }));
    };
    dispatchFollowing(false);
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
    } catch (cause) {
      setLeagues((current) => current.some((item) => item.id === league.id) ? current : [...current, league]);
      dispatchFollowing(true);
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
        return;
      }
      const restored = initialFixtures.find((item) => item.fixture.id === detail.fixtureId);
      if (restored) {
        setFixtures((current) => {
          if (current.some((item) => item.fixture.id === detail.fixtureId)) return current;
          const next = [...current, restored];
          return initialFixtures.filter((item) => next.some((candidate) => candidate.fixture.id === item.fixture.id));
        });
      }
    };
    window.addEventListener("pickzone:favorite-updated", syncFavorite);
    return () => window.removeEventListener("pickzone:favorite-updated", syncFavorite);
  }, [initialFixtures]);

  useEffect(() => {
    const syncTeam = (event: Event) => {
      const detail = (event as CustomEvent<{ teamId: number; following: boolean }>).detail;
      if (!detail.following) {
        setTeams((current) => current.filter((item) => item.id !== detail.teamId));
        return;
      }
      const restored = initialTeams.find((item) => item.id === detail.teamId);
      if (restored) setTeams((current) => current.some((item) => item.id === detail.teamId) ? current : [...current, restored]);
    };
    window.addEventListener("pickzone:team-follow-updated", syncTeam);
    return () => window.removeEventListener("pickzone:team-follow-updated", syncTeam);
  }, [initialTeams]);

  useEffect(() => {
    const syncLeague = (event: Event) => {
      const detail = (event as CustomEvent<{ leagueId: number; following: boolean }>).detail;
      if (!detail.following) {
        setLeagues((current) => current.filter((item) => item.id !== detail.leagueId));
        return;
      }
      const restored = initialLeagues.find((item) => item.id === detail.leagueId);
      if (restored) setLeagues((current) => current.some((item) => item.id === detail.leagueId) ? current : [...current, restored]);
    };
    window.addEventListener("pickzone:league-follow-updated", syncLeague);
    return () => window.removeEventListener("pickzone:league-follow-updated", syncLeague);
  }, [initialLeagues]);

  async function removeTeam(team: FollowedTeamCard) {
    const key = `team:${team.id}`;
    if (busy) return;
    setBusy(key);
    setError(null);
    setTeams((current) => current.filter((item) => item.id !== team.id));
    const dispatchFollowing = (following: boolean) => {
      window.dispatchEvent(new CustomEvent("pickzone:team-follow-updated", {
        detail: { teamId: team.id, following, teamName: team.name },
      }));
    };
    dispatchFollowing(false);
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
    } catch (cause) {
      setTeams((current) => current.some((item) => item.id === team.id) ? current : [...current, team]);
      dispatchFollowing(true);
      setError(cause instanceof Error ? cause.message : "No se pudo dejar de seguir al equipo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl border border-loss/40 bg-loss/10 px-3 py-2 text-sm text-loss">{t(error)}</p>}
      {hadInitialItems && leagues.length === 0 && teams.length === 0 && fixtures.length === 0 && (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-line bg-card px-6 py-10 text-center">
          <p className="max-w-md text-sm leading-relaxed text-muted">
            {t("Todavía no tienes favoritos. Usa el buscador de arriba o pulsa la estrella en cualquier partido.")}
          </p>
          <Link href="/buscar" className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black">
            {t("Buscar partidos")}
          </Link>
        </div>
      )}
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
              <MatchRow
                key={fixture.id}
                f={fixture}
                date={dateKey}
                matchTime={date.split(" · ").at(-1) ?? ""}
                displayDate={date.split(" · ")[0]}
                showDate
                isAuthenticated
                initialFavorite
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
