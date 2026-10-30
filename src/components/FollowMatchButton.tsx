"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "./I18nProvider";

type FavoriteProps = { fixtureId: number; isAuthenticated: boolean; initialFavorite: boolean };

function useFavorite({ fixtureId, isAuthenticated, initialFavorite }: FavoriteProps) {
  const router = useRouter();
  const t = useT();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFavorite(initialFavorite);
  }, [fixtureId, initialFavorite]);

  useEffect(() => {
    const syncFavorite = (event: Event) => {
      const detail = (event as CustomEvent<{ fixtureId: number; favorite: boolean }>).detail;
      if (detail.fixtureId === fixtureId) setFavorite(detail.favorite);
    };
    window.addEventListener("pickzone:favorite-updated", syncFavorite);
    return () => window.removeEventListener("pickzone:favorite-updated", syncFavorite);
  }, [fixtureId]);

  async function toggle() {
    if (!isAuthenticated) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/favorites", {
        method: favorite ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId }),
      });
      const result = await response.json() as { favorite?: boolean; error?: string };
      if (!response.ok || typeof result.favorite !== "boolean") {
        throw new Error(result.error || "No se pudo actualizar el favorito.");
      }
      setFavorite(result.favorite);
      window.dispatchEvent(new CustomEvent("pickzone:favorite-updated", {
        detail: { fixtureId, favorite: result.favorite },
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el favorito.");
    } finally {
      setBusy(false);
    }
  }
  return { favorite, busy, error, toggle };
}

export function FollowMatchButton({ fixtureId, isAuthenticated, initialFavorite }: FavoriteProps) {
  const { favorite: following, busy, error, toggle } = useFavorite({ fixtureId, isAuthenticated, initialFavorite });
  const t = useT();
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        aria-pressed={following}
        aria-busy={busy}
        onClick={toggle}
        disabled={busy}
        className={`mx-auto mt-3 inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-60 ${following ? "border-brand bg-brand text-slate-900" : "border-slate-300/80 bg-white/75 text-slate-900 hover:bg-white"}`}
      >
        <Star className="h-3.5 w-3.5" fill={following ? "currentColor" : "none"} />
        {t(following ? "Siguiendo" : "Seguir partido")}
      </button>
      {error && <span role="alert" className="mt-1 text-[10px] text-loss">{t(error)}</span>}
    </div>
  );
}

export function FavoriteMatchButton({ fixtureId, isAuthenticated, initialFavorite }: FavoriteProps) {
  const { favorite, busy, error, toggle } = useFavorite({ fixtureId, isAuthenticated, initialFavorite });
  const t = useT();
  return (
    <div className="relative flex shrink-0 items-center">
      <button type="button" aria-label={t(favorite ? "Quitar de favoritos" : "Añadir a favoritos")} title={isAuthenticated ? undefined : t("Inicia sesión para añadir a favoritos")} aria-pressed={favorite} aria-busy={busy} onClick={toggle} disabled={busy} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60 ${favorite ? "text-brand" : "text-muted hover:text-brand"}`}>
        <Star className="h-4 w-4" fill={favorite ? "currentColor" : "none"} />
      </button>
      {error && <span role="alert" className="absolute right-9 z-20 w-48 rounded-lg bg-loss px-2 py-1 text-[10px] text-white shadow-lg">{t(error)}</span>}
    </div>
  );
}