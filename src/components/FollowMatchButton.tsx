"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

const STORAGE_KEY = "pickzone:followed-matches";

function readFollowedMatches(): number[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

export function FollowMatchButton({ fixtureId }: { fixtureId: number }) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setFollowing(readFollowedMatches().includes(fixtureId));
  }, [fixtureId]);

  function toggleFollowing() {
    const current = readFollowedMatches();
    const next = current.includes(fixtureId)
      ? current.filter((id) => id !== fixtureId)
      : [...current, fixtureId];
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setFollowing(next.includes(fixtureId));
    } catch {
      setFollowing((value) => !value);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={following}
      onClick={toggleFollowing}
      className={`mx-auto mt-3 inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${following ? "border-brand bg-brand text-slate-900" : "border-slate-300/80 bg-white/75 text-slate-900 hover:bg-white"}`}
    >
      <Star className="h-3.5 w-3.5" fill={following ? "currentColor" : "none"} />
      {following ? "Siguiendo" : "Seguir partido"}
    </button>
  );
}
