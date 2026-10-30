import Link from "next/link";
import type { Fixture } from "@/lib/types";
import { statusGroup, timeStr } from "@/lib/format";
import { Shield } from "./Shield";
import { IconStats } from "./icons";
import { FavoriteMatchButton } from "./FollowMatchButton";
import { t } from "@/lib/i18n";

export function MatchRow({ f, date, selected = false }: { f: Fixture; date: string; selected?: boolean }) {
  const g = statusGroup(f);
  const score = f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome} - ${f.goalsAway}` : null;
  return (
    <div className={`match-row flex min-w-0 items-center gap-1.5 border-t border-line px-2 sm:px-3 ${selected ? "bg-card2" : "bg-card"}`}>
      <FavoriteMatchButton fixtureId={f.id} />
      <Link href={`/match/${f.id}?date=${date}`} aria-label={`${f.home.name} contra ${f.away.name}`} className="group flex min-w-0 flex-1 items-center gap-3 py-3 sm:px-1">
        <div className={`shrink-0 text-left ${g === "finished" ? "w-10" : "w-11 sm:w-14"}`}>
          {g === "finished" ? (
            <div className="text-xs font-medium text-muted">{t("Final")}</div>
          ) : g === "live" ? (
            <>
              <div className="text-sm font-extrabold tabular-nums text-chartHit sm:text-base">{score ?? "—"}</div>
              <div className="mt-0.5 text-[10px] font-semibold text-chartHit">{f.statusShort === "HT" ? "HT" : `${f.elapsed ?? ""}′`}</div>
            </>
          ) : (
            <>
              <div className="text-xs font-bold tabular-nums sm:text-sm">{timeStr(f.timestamp)}</div>
              {g === "pending" && <div className="mt-0.5 text-[9px] leading-tight text-muted">{t("Pendiente de actualizar")}</div>}
            </>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <TeamLine name={f.home.name} logo={f.home.logo} fallback={f.home.logoFallback} />
          <TeamLine name={f.away.name} logo={f.away.logo} fallback={f.away.logoFallback} />
        </div>
        {g === "finished" && (
          <div className="flex w-4 shrink-0 flex-col items-center text-sm font-extrabold leading-5 tabular-nums">
            <span>{f.goalsHome ?? "—"}</span>
            <span>{f.goalsAway ?? "—"}</span>
          </div>
        )}
        <IconStats aria-hidden="true" className="h-8 w-8 shrink-0 rounded-lg border border-line p-1.5 text-muted transition-colors group-hover:border-chartHit/40 group-hover:text-chartHit" />
      </Link>
    </div>
  );
}
function TeamLine({ name, logo, fallback }: { name: string; logo: string | null; fallback?: string | null }) {
  return <div className="flex min-w-0 items-center gap-2 text-xs font-semibold sm:text-sm"><Shield src={logo} fallbackSrc={fallback} alt="" size={20} /><span className="min-w-0 truncate">{name}</span></div>;
}