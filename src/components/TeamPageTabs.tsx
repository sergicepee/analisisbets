"use client";

import { useState, type ReactNode } from "react";
import { IconCalendar, IconMatches, IconStats } from "./icons";
import { I18nText, useT } from "./I18nProvider";

export function TeamPageTabs({
  results,
  upcoming,
  statistics,
  resultCount,
  upcomingCount,
}: {
  results: ReactNode;
  upcoming: ReactNode;
  statistics: ReactNode;
  resultCount: number;
  upcomingCount: number;
}) {
  const [section, setSection] = useState<"matches" | "statistics">("matches");
  const [matchView, setMatchView] = useState<"results" | "upcoming">("results");
  const t = useT();

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <div role="tablist" aria-label={t("Secciones del equipo")} className="flex border-b border-line px-3">
        <button
          type="button"
          role="tab"
          id="team-matches-tab"
          aria-controls="team-matches-panel"
          aria-selected={section === "matches"}
          onClick={() => setSection("matches")}
          className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold ${section === "matches" ? "border-brand text-brand" : "border-transparent text-muted"}`}
        >
          <IconMatches className="h-4 w-4" />
          <I18nText text="Partidos" />
        </button>
        <button
          type="button"
          role="tab"
          id="team-statistics-tab"
          aria-controls="team-statistics-panel"
          aria-selected={section === "statistics"}
          onClick={() => setSection("statistics")}
          className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-bold ${section === "statistics" ? "border-brand text-brand" : "border-transparent text-muted"}`}
        >
          <IconStats className="h-4 w-4" />
          <I18nText text="Estadísticas" />
        </button>
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
      ) : (
        <div role="tabpanel" id="team-statistics-panel" aria-labelledby="team-statistics-tab" className="space-y-3 p-3 sm:p-4">{statistics}</div>
      )}
    </section>
  );
}
