"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "./I18nProvider";

export function FollowTeamButton({
  teamId,
  teamName,
  isAuthenticated,
  initialFollowing,
}: {
  teamId: number;
  teamName: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setFollowing(initialFollowing), [teamId, initialFollowing]);

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ teamId: number; following: boolean }>).detail;
      if (detail.teamId === teamId) setFollowing(detail.following);
    };
    window.addEventListener("pickzone:team-follow-updated", sync);
    return () => window.removeEventListener("pickzone:team-follow-updated", sync);
  }, [teamId]);

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
      const response = await fetch("/api/team-follows", {
        method: following ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, teamName }),
      });
      const result = await response.json() as { following?: boolean; error?: string };
      if (!response.ok || typeof result.following !== "boolean") {
        throw new Error(result.error || "No se pudo actualizar el seguimiento.");
      }
      setFollowing(result.following);
      window.dispatchEvent(new CustomEvent("pickzone:team-follow-updated", {
        detail: { teamId, following: result.following, teamName },
      }));
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Error al actualizar seguimiento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        aria-pressed={following}
        aria-busy={busy}
        onClick={toggle}
        disabled={busy}
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold text-slate-900 transition-colors disabled:opacity-60 ${following ? "border-brand bg-brand" : "border-slate-400/70 bg-white/40 hover:bg-white/70"}`}
      >
        <Star className="h-3.5 w-3.5" fill={following ? "currentColor" : "none"} />
        {t(following ? "Siguiendo" : "Seguir")}
      </button>
      {error && <p role="alert" className="mt-1 text-[10px] text-loss">{t(error)}</p>}
    </div>
  );
}
