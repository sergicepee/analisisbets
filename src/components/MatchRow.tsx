import Link from "next/link";
import type { Fixture } from "@/lib/types";
import { statusGroup, timeStr } from "@/lib/format";
import { Shield } from "./Shield";
import { IconStats } from "./icons";
import { FavoriteMatchButton } from "./FollowMatchButton";
import { t } from "@/lib/i18n";

export function MatchRow({ f, date, selected = false }: { f: Fixture; date: string; selected?: boolean }) {
  const g = statusGroup(f);
  const suspended = f.statusShort === "SUSP";
  const score = f.goalsHome !== null && f.goalsAway !== null ? `${f.goalsHome} - ${f.goalsAway}` : null;
  const homeWon = g === "finished" && f.goalsHome !== null && f.goalsAway !== null && f.goalsHome > f.goalsAway;
  const awayWon = g === "finished" && f.goalsHome !== null && f.goalsAway !== null && f.goalsAway > f.goalsHome;
  const homeLost = g === "finished" && f.goalsHome !== null && f.goalsAway !== null && f.goalsHome < f.goalsAway;
  const awayLost = g === "finished" && f.goalsHome !== null && f.goalsAway !== null && f.goalsAway < f.goalsHome;
  const eventRedCards = (teamId: number) => f.events.filter((event) =>
    event.teamId === teamId && event.type === "Card" && (event.detail === "Red Card" || event.detail === "Second Yellow Card"),
  ).length;
  const homeRedCards = f.redCardsHome ?? eventRedCards(f.home.id);
  const awayRedCards = f.redCardsAway ?? eventRedCards(f.away.id);
  return (
    <div className={`match-row flex min-w-0 items-center gap-1.5 border-t border-line px-2 sm:px-3 ${selected ? "bg-card2" : "bg-card"}`}>
      <FavoriteMatchButton fixtureId={f.id} />
      <Link href={`/match/${f.id}?date=${date}`} aria-label={`${f.home.name} contra ${f.away.name}`} className="group flex min-w-0 flex-1 items-center gap-3 py-3 sm:px-1">
        <div className={`shrink-0 text-left ${g === "finished" ? "w-10" : "w-11 sm:w-14"}`}>
          {suspended ? (
            <span className="rounded bg-loss/15 px-1 py-0.5 text-[9px] font-bold text-loss">SUSP.</span>
          ) : g === "finished" ? (
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
          <TeamLine name={f.home.name} logo={f.home.logo} fallback={f.home.logoFallback} winner={homeWon} loser={homeLost} redCard={homeRedCards > 0} suspended={suspended} />
          <TeamLine name={f.away.name} logo={f.away.logo} fallback={f.away.logoFallback} winner={awayWon} loser={awayLost} redCard={awayRedCards > 0} suspended={suspended} />
        </div>
        {g === "finished" && (
          <div className="flex w-4 shrink-0 flex-col items-center text-xs font-bold leading-5 tabular-nums sm:text-sm">
            <span>{f.goalsHome ?? "—"}</span>
            <span>{f.goalsAway ?? "—"}</span>
          </div>
        )}
        <IconStats aria-hidden="true" className="h-8 w-8 shrink-0 rounded-lg border border-line p-1.5 text-muted transition-colors group-hover:border-chartHit/40 group-hover:text-chartHit" />
      </Link>
    </div>
  );
}
function TeamLine({ name, logo, fallback, winner = false, loser = false, redCard = false, suspended = false }: { name: string; logo: string | null; fallback?: string | null; winner?: boolean; loser?: boolean; redCard?: boolean; suspended?: boolean }) {
  return <div className={`flex min-w-0 items-center gap-2 text-xs sm:text-sm ${winner ? "font-bold" : "font-normal"} ${loser || suspended ? "text-muted" : ""}`}><Shield src={logo} fallbackSrc={fallback} alt="" size={20} /><span className={`min-w-0 truncate ${suspended ? "line-through decoration-loss decoration-2" : ""}`}>{name}</span>{redCard && <span aria-label="Tarjeta roja" title="Tarjeta roja" className="h-3.5 w-2.5 shrink-0 rounded-[2px] bg-red-500" />}</div>;
}