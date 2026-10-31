import { IconSoccerBall, IconSubstitution } from "@/components/icons";
import { I18nText } from "@/components/I18nProvider";
import { Shield } from "@/components/Shield";
import { statusGroup } from "@/lib/format";
import type { Fixture, FixtureEvent } from "@/lib/types";

function timelineDescription(event: FixtureEvent) {
  const detail = event.detail.toLowerCase();
  if (/disallow|overturn|cancel/.test(detail)) return "Gol anulado";
  if (event.type === "Goal") {
    if (event.ownGoal) return "Gol en propia puerta";
    if (detail.includes("penalty")) return "Gol de penalti";
    return "Gol";
  }
  if (event.type === "Card") return event.redCard ? "Tarjeta roja" : "Tarjeta amarilla";
  if (event.type === "Substitution") return "Cambio";
  return event.detail;
}

function TimelineMarker({ event }: { event: FixtureEvent }) {
  if (event.type === "Card") {
    return <span aria-hidden="true" className={`h-4 w-2.5 shrink-0 rounded-[2px] ${event.redCard ? "bg-red-500" : "bg-yellow-400"}`} />;
  }
  if (event.type === "VAR" || /var/i.test(event.detail)) {
    return <span className="rounded bg-card2 px-1.5 py-0.5 text-[9px] font-black text-muted">VAR</span>;
  }
  if (event.type === "Substitution") return <IconSubstitution size={16} />;
  if (event.type === "Goal") return <IconSoccerBall size={16} />;
  return null;
}

function TimelineEvent({ event, fixture }: { event: FixtureEvent; fixture: Fixture }) {
  const isHome = event.teamId === fixture.home.id;
  const description = timelineDescription(event);
  const playerName = event.player || (isHome ? fixture.home.name : fixture.away.name);
  const minute = `${event.minute}${event.extra === null ? "" : `+${event.extra}`}′`;
  const playerImage = event.playerPhoto
    ? <img src={event.playerPhoto} alt="" className="size-7 shrink-0 rounded-full object-cover" />
    : null;
  const eventInfo = (
    <div className="min-w-0">
      <p className="truncate text-xs font-bold text-fg">{playerName}</p>
      <p className="text-[10px] leading-tight text-muted"><I18nText text={description} /></p>
      {event.type === "Substitution" && event.secondaryPlayer && (
        <p className="truncate text-[10px] leading-tight text-muted">{event.secondaryPlayer}</p>
      )}
    </div>
  );
  const marker = <TimelineMarker event={event} />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-center gap-1 py-2">
      <div className={`flex min-w-0 items-center gap-2 ${isHome ? "justify-end text-right" : ""}`}>
        {isHome && playerImage}
        {isHome && eventInfo}
        {isHome && marker}
      </div>
      <div className="text-center text-xs font-bold tabular-nums text-fg">{minute}</div>
      <div className={`flex min-w-0 items-center gap-2 ${isHome ? "" : "justify-start"}`}>
        {!isHome && marker}
        {!isHome && eventInfo}
        {!isHome && playerImage}
      </div>
    </div>
  );
}

export function MatchTimeline({ fixture }: { fixture: Fixture }) {
  const group = statusGroup(fixture);
  const events = [...fixture.events]
    .filter((event) => event.teamId === fixture.home.id || event.teamId === fixture.away.id)
    .sort((a, b) => b.minute - a.minute || (b.extra ?? 0) - (a.extra ?? 0));
  const score = fixture.goalsHome !== null && fixture.goalsAway !== null
    ? `${fixture.goalsHome} - ${fixture.goalsAway}`
    : "— - —";
  const status = group === "live"
    ? fixture.statusShort === "HT" ? "Descanso" : "En juego"
    : group === "finished" ? "Final" : null;
  const started = group === "live" || group === "finished" || events.length > 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-line bg-card p-3 sm:p-4">
      <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wide"><I18nText text="Cronología" /></h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Shield src={fixture.home.logo} alt="" size={20} />
          <span className="truncate text-xs font-bold">{fixture.home.name}</span>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="truncate text-xs font-bold">{fixture.away.name}</span>
          <Shield src={fixture.away.logo} alt="" size={20} />
        </div>
      </div>
      <div className="my-4 flex items-center gap-2">
        <span className="h-px flex-1 bg-line" />
        <span className="inline-flex items-center gap-2 rounded-full bg-card2 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted">
          {status && <I18nText text={status} />}
          <span className="text-fg">{score}</span>
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>
      {events.length ? (
        <div className="divide-y divide-line/70">
          {events.map((event, index) => (
            <TimelineEvent
              key={`${event.minute}-${event.extra ?? 0}-${event.teamId}-${event.type}-${event.playerId ?? index}`}
              event={event}
              fixture={fixture}
            />
          ))}
        </div>
      ) : (
        <p className="py-5 text-center text-xs text-muted"><I18nText text="Aún no hay eventos registrados." /></p>
      )}
      {started && (
        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-line" />
          <span className="rounded-full bg-card2 px-3 py-1"><I18nText text="Inicio del partido" /></span>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
    </section>
  );
}
