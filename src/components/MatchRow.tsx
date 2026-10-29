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
    <Link href={`/match/${f.id}?date=${date}`} className={`card flex items-center gap-2 px-3 py-3 active:border-brand/60 ${selected ? "border-brand/70 bg-card2" : ""}`}>
      <Team name={f.home.name} logo={f.home.logo} role={t("Local")} />
      <div className="w-20 shrink-0 text-center">
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
            <div className="text-xs text-muted">{f.statusShort}</div>
          </>
        )}
      </div>
      <Team name={f.away.name} logo={f.away.logo} role={t("Visitante")} />
      <IconGo className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}
function Team({ name, logo, role }: { name: string; logo: string | null; role: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <Shield src={logo} alt={name} size={38} />
      <div className="w-full truncate text-[13px] font-semibold">{name}</div>
      <div className="text-[11px] text-muted">{role}</div>
    </div>
  );
}
