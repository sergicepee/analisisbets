"use client";

import { useState, type ReactNode } from "react";
import { IconCalendar, IconMatches, IconStats, IconTrophy } from "./icons";
import { I18nText, useT } from "./I18nProvider";

export function TeamPageTabs({
  results,
  upcoming,
  statistics,
  standings,
  resultCount,
  upcomingCount,
}: {
  results: ReactNode;
  upcoming: ReactNode;
  statistics: ReactNode;
  standings?: ReactNode;
  resultCount: number;
  upcomingCount: number;
}) {
  const [section, setSection] = useState<"matches" | "statistics" | "standings">("matches");
  const [matchView, setMatchView] = useState<"results" | "upcoming">("results");
  const t = useT();

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <div role="tablist" aria-label={t("Secciones del equipo")} className="flex w-full border-b border-line px-1">
        <button
          type="button"
          role="tab"
          id="team-matches-tab"
          aria-controls="team-matches-panel"
          aria-selected={section === "matches"}
          onClick={() => setSection("matches")}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap border-b-2 px-1 py-3 text-xs font-bold sm:gap-2 sm:px-2 sm:text-sm ${section === "matches" ? "border-brand text-brand" : "border-transparent text-muted"}`}
        >
          <IconMatches className="h-4 w-4 shrink-0" />
          <I18nText text="Partidos" />
        </button>
        <button
          type="button"
          role="tab"
          id="team-statistics-tab"
          aria-controls="team-statistics-panel"
          aria-selected={section === "statistics"}
          onClick={() => setSection("statistics")}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap border-b-2 px-1 py-3 text-xs font-bold sm:gap-2 sm:px-2 sm:text-sm ${section === "statistics" ? "border-brand text-brand" : "border-transparent text-muted"}`}
        >
          <IconStats className="h-4 w-4 shrink-0" />
          <I18nText text="Estadísticas" />
        </button>
        {standings && (
          <button
            type="button"
            role="tab"
            id="team-standings-tab"
            aria-controls="team-standings-panel"
            aria-selected={section === "standings"}
            onClick={() => setSection("standings")}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap border-b-2 px-1 py-3 text-xs font-bold sm:gap-2 sm:px-2 sm:text-sm ${section === "standings" ? "border-brand text-brand" : "border-transparent text-muted"}`}
          >
            <IconTrophy className="h-4 w-4 shrink-0" />
            <I18nText text="Clasificación" />
          </button>
        )}
      </div>

      {section === "matches" ? (
        <div role="tabpanel" id="team-matches-panel" aria-labelledby="team-matches-tab">
          <div className="grid grid-cols-2 gap-2 border-b border-line p-3">
            <button
              type="button"
              aria-pressed={matchView === "results"}
              onClick={() => setMatchView("results")}
              className={`flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-bold ${matchView === "results" ? "bg-brand text-black" : "bg-card2 text-muted"}`}
            >
              <IconMatches className="h-4 w-4" />
              <I18nText text="Resultados" />
              <span className="text-xs opacity-70">{resultCount}</span>
            </button>
            <button
              type="button"
              aria-pressed={matchView === "upcoming"}
              onClick={() => setMatchView("upcoming")}
              className={`flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-bold ${matchView === "upcoming" ? "bg-brand text-black" : "bg-card2 text-muted"}`}
            >
              <IconCalendar className="h-4 w-4" />
              <I18nText text="Próximos" />
              <span className="text-xs opacity-70">{upcomingCount}</span>
            </button>
          </div>
          {matchView === "results" ? results : upcoming}
        </div>
      ) : section === "statistics" ? (
        <div role="tabpanel" id="team-statistics-panel" aria-labelledby="team-statistics-tab" className="space-y-3 p-3 sm:p-4">{statistics}</div>
      ) : (
        <div role="tabpanel" id="team-standings-panel" aria-labelledby="team-standings-tab">{standings}</div>
      )}
    </section>
  );
}
