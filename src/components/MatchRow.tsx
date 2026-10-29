import Link from "next/link";
import type { Fixture } from "@/lib/types";
import { statusGroup, timeStr } from "@/lib/format";
import { Shield } from "./Shield";
import { IconGo } from "./icons";
import { t } from "@/lib/i18n";

export function MatchRow({ f, date, selected = false }: { f: Fixture; date: string; selected?: boolean }) {
  const g = statusGroup(f);
  const score = f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome} - ${f.goalsAway}` : null;
  return (
    <Link href={`/match/${f.id}?date=${date}`} className={`card flex min-w-0 items-center gap-1.5 px-2.5 py-2.5 active:border-brand/60 sm:gap-2 sm:px-3 sm:py-3 ${selected ? "border-brand/70 bg-card2" : ""}`}>
      <Team name={f.home.name} logo={f.home.logo} logoFallback={f.home.logoFallback} role={t("Local")} />
      <div className="w-[4.25rem] shrink-0 text-center sm:w-20">
        {g === "live" ? (
          <>
            <div className="text-lg font-extrabold text-loss">{score}</div>
            <div className="text-xs font-semibold text-loss">{f.statusShort === "HT" ? "HT" : `${f.elapsed ?? ""}′`}</div>
          </>
        ) : g === "finished" ? (
          <>
            <div className="text-lg font-extrabold">{score}</div>
            <div className="text-xs text-muted">{f.statusShort}</div>
          </>
        ) : (
          <>
            <div className="text-base font-bold">{timeStr(f.timestamp)}</div>
            <div className={`text-xs text-muted ${g === "pending" ? "text-[10px] leading-tight" : ""}`}>{g === "pending" ? t("Pendiente de actualizar") : f.statusShort}</div>
          </>
        )}
      </div>
      <Team name={f.away.name} logo={f.away.logo} logoFallback={f.away.logoFallback} role={t("Visitante")} />
      <IconGo className="h-3.5 w-3.5 shrink-0 text-muted sm:h-4 sm:w-4" />
    </Link>
  );
}
function Team({ name, logo, logoFallback, role }: { name: string; logo: string | null; logoFallback?: string | null; role: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <Shield src={logo} fallbackSrc={logoFallback} alt={name} size={32} />
      <div className="w-full truncate text-xs font-semibold sm:text-[13px]">{name}</div>
      <div className="text-[10px] text-muted sm:text-[11px]">{role}</div>
    </div>
  );
}
