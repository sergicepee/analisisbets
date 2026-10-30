import Link from "next/link";
import type { Fixture } from "@/lib/types";
import { statusGroup, timeStr } from "@/lib/format";
import { Shield } from "./Shield";
import { IconStats } from "./icons";
import { t } from "@/lib/i18n";

export function MatchRow({ f, date, selected = false }: { f: Fixture; date: string; selected?: boolean }) {
  const g = statusGroup(f);
  const score = f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome} - ${f.goalsAway}` : null;
  return (
    <Link href={`/match/${f.id}?date=${date}`} aria-label={`${f.home.name} contra ${f.away.name}`} className={`group flex min-w-0 items-center gap-3 border-t border-line px-3 py-3 transition-colors active:bg-card2 sm:px-4 ${selected ? "bg-card2" : "bg-card hover:bg-card2/70"}`}>
      <div className="w-11 shrink-0 text-left sm:w-14">
        {g === "live" || g === "finished" ? (
          <>
            <div className={`text-sm font-extrabold tabular-nums sm:text-base ${g === "live" ? "text-chartHit" : ""}`}>{score ?? "—"}</div>
            <div className={`mt-0.5 text-[10px] font-semibold ${g === "live" ? "text-chartHit" : "text-muted"}`}>{g === "live" ? (f.statusShort === "HT" ? "HT" : `${f.elapsed ?? ""}′`) : f.statusShort}</div>
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
      <IconStats aria-hidden="true" className="h-8 w-8 shrink-0 rounded-lg border border-line p-1.5 text-muted transition-colors group-hover:border-chartHit/40 group-hover:text-chartHit" />
    </Link>
  );
}
function TeamLine({ name, logo, fallback }: { name: string; logo: string | null; fallback?: string | null }) {
  return <div className="flex min-w-0 items-center gap-2 text-xs font-semibold sm:text-sm"><Shield src={logo} fallbackSrc={fallback} alt="" size={20} /><span className="min-w-0 truncate">{name}</span></div>;
}
