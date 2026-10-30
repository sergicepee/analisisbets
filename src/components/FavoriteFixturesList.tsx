import Link from "next/link";
import type { Fixture } from "@/lib/types";
import { MatchRow } from "./MatchRow";
import { FavoriteFixtureVisibility } from "./FavoriteFixtureVisibility";
import { I18nText } from "./I18nProvider";
import { IconSearch } from "./icons";

export function FavoriteFixturesList({
  fixtures,
  dates,
  showEmptyState = true,
}: {
  fixtures: Fixture[];
  dates: Record<number, string>;
  showEmptyState?: boolean;
}) {
  if (!fixtures.length) {
    if (!showEmptyState) return null;
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-line bg-card px-6 py-10 text-center">
        <IconSearch className="h-7 w-7 text-muted" />
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
          <I18nText text="Todavía no tienes favoritos. Usa el buscador de arriba o pulsa la estrella en cualquier partido." />
        </p>
        <Link href="/buscar" className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-black">
          <I18nText text="Buscar partidos" />
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      {fixtures.map((fixture) => (
        <FavoriteFixtureVisibility key={fixture.id} fixtureId={fixture.id}>
          <MatchRow
            f={fixture}
            date={dates[fixture.id]}
            isAuthenticated
            initialFavorite
          />
        </FavoriteFixtureVisibility>
      ))}
    </div>
  );
}
