"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useT } from "./I18nProvider";

export function FollowLeagueButton({
  leagueId,
  leagueName,
  country,
  logo,
  isAuthenticated,
  initialFollowing,
}: {
  leagueId: number;
  leagueName: string;
  country: string;
  logo: string | null;
  isAuthenticated: boolean;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useT();

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
      const response = await fetch("/api/league-follows", {
        method: following ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, leagueName, country, logo }),
      });
      const result = await response.json() as { following?: boolean; error?: string };
      if (!response.ok || typeof result.following !== "boolean") {
        throw new Error(result.error || "No se pudo actualizar el seguimiento.");
      }
      setFollowing(result.following);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo actualizar el seguimiento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-pressed={following}
        aria-busy={busy}
        onClick={() => void toggle()}
        disabled={busy}
        className={`mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold text-slate-900 transition-colors disabled:opacity-60 ${following ? "border-brand bg-brand" : "border-slate-400/70 bg-white/40 hover:bg-white/70"}`}
      >
        <Star className="h-3.5 w-3.5" fill={following ? "currentColor" : "none"} />
        {t(following ? "Siguiendo" : "Seguir")}
      </button>
      {error && <p role="alert" className="mt-1 text-[10px] text-loss">{t(error)}</p>}
    </div>
  );
}
