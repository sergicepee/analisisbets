"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  getFallbackStandingsZones,
  getStandingsZoneStyle,
  makeLeagueStandings,
  type LeagueStandingTeam,
  type LeagueStandingsZone,
} from "@/lib/leagueStandings";
import type { Fixture } from "@/lib/types";
import { I18nText } from "./I18nProvider";
import { Shield } from "./Shield";

export function LeagueStandingsTable({
  leagueId,
  season,
  teams,
  fixtures,
  zones,
  currentTeamId,
  dataError,
  zoneError,
}: {
  leagueId: number;
  season: number;
  teams: LeagueStandingTeam[];
  fixtures: Fixture[];
  zones: LeagueStandingsZone[];
  currentTeamId?: number;
  dataError?: string | null;
  zoneError?: string | null;
}) {
  const standings = useMemo(() => makeLeagueStandings(fixtures, teams), [fixtures, teams]);
  const displayedZones = useMemo(
    () => zones.length ? zones : getFallbackStandingsZones(leagueId, standings),
    [leagueId, standings, zones],
  );
  const zonesByTeam = useMemo(() => new Map(displayedZones.map((zone) => [zone.teamId, zone.description])), [displayedZones]);
  const zoneLegend = useMemo(() => {
    const categories = new Map<string, ReturnType<typeof getStandingsZoneStyle>>();
    for (const zone of displayedZones) {
      const style = getStandingsZoneStyle(zone.description);
      categories.set(style.label, style);
    }
    return [...categories.values()];
  }, [displayedZones]);

  return (
    <div>
      {dataError && <p role="alert" className="border-b border-line px-4 py-2 text-xs text-loss"><I18nText text="No se pudo cargar la clasificación." /> {dataError}</p>}
      {!standings.length ? (
        <p className="px-4 py-10 text-center text-sm text-muted"><I18nText text="La clasificación estará disponible cuando haya resultados." /></p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="text-[10px] font-bold uppercase text-muted">
              <tr>
                <th className="w-8 px-2 py-2">#</th>
                <th className="px-1 py-2"><I18nText text="Equipo" /></th>
                <th className="w-11 px-1 py-2 text-center">PJ</th>
                <th className="w-12 px-1 py-2 text-center">DG</th>
                <th className="w-12 px-2 py-2 text-right">PTS</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, index) => {
                const description = zonesByTeam.get(row.id);
                const zone = description ? getStandingsZoneStyle(description) : null;
                const isCurrentTeam = row.id === currentTeamId;
                const goalDifference = row.goalsFor - row.goalsAgainst;
                return (
                  <tr key={row.id} aria-current={isCurrentTeam ? "true" : undefined} className={`border-t border-line ${isCurrentTeam ? "bg-brand/10" : ""}`}>
                    <td className="relative px-2 py-2.5 font-bold text-muted">
                      {isCurrentTeam
                        ? <span aria-hidden="true" className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-brand" />
                        : zone && <span aria-hidden="true" title={zone.label} className={`absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full ${zone.color}`} />}
                      {index + 1}
                    </td>
                    <td className="overflow-hidden px-1 py-2.5">
                      <Link href={`/equipo/${row.id}?league=${leagueId}&season=${season}&name=${encodeURIComponent(row.name)}`} className={`flex min-w-0 items-center gap-2 font-semibold hover:text-brand ${isCurrentTeam ? "text-brand" : ""}`}>
                        <Shield src={row.logo ?? null} fallbackSrc={row.logoFallback} alt="" size={22} />
                        <span className="truncate">{row.name}</span>
                      </Link>
                    </td>
                    <td className="px-1 py-2.5 text-center font-semibold text-muted">{row.played}</td>
                    <td className="px-1 py-2.5 text-center font-semibold text-muted">{goalDifference > 0 ? `+${goalDifference}` : goalDifference}</td>
                    <td className={`px-2 py-2.5 text-right font-black ${isCurrentTeam ? "text-brand" : ""}`}>{row.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {zoneLegend.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-line bg-card2/40 px-4 py-3 text-[10px] text-muted">
          {zoneLegend.map((zone) => <span key={zone.label}><i className={`mr-1.5 inline-block h-2 w-2 rounded-full ${zone.color}`} /><I18nText text={zone.label} /></span>)}
        </div>
      )}
      {zoneError && <p role="alert" className="border-t border-line px-4 py-2 text-xs text-loss"><I18nText text="No se pudieron cargar las zonas de clasificación." /> {zoneError}</p>}
    </div>
  );
}
