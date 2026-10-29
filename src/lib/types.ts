export type Metric = "goals" | "shots" | "shotsOn" | "corners" | "cards";
export type StatusGroup = "live" | "finished" | "upcoming" | "pending" | "other";

export interface TeamRef { id: number; name: string; logo: string | null }
export interface FixtureEvent {
  minute: number; extra: number | null; teamId: number;
  player: string; type: string; detail: string;
}
export interface Fixture {
  id: number; timestamp: number;
  leagueId: number; leagueName: string; country: string;
  flag: string | null; leagueLogo: string | null; season: number; round: string;
  venue: string | null;
  statusShort: string; statusLong: string; elapsed: number | null;
  home: TeamRef; away: TeamRef;
  goalsHome: number | null; goalsAway: number | null;
  htHome: number | null; htAway: number | null;
  events: FixtureEvent[];
}

/** Estadísticas reales de un equipo en un partido. null = no disponible. */
export interface MatchStat {
  shots: number | null; shotsOn: number | null; corners: number | null; cards: number | null;
}
export interface StoredStats {
  fixtureId: number; leagueId: number; season: number;
  homeId: number; awayId: number;
  home: MatchStat; away: MatchStat;
  goalsHome: number; goalsAway: number;
  hasData: boolean;
}
export interface TeamRow {
  fixtureId: number; ts: number; isHome: boolean;
  goalsFor: number; goalsAgainst: number;
  htFor: number | null; htAgainst: number | null;
  result: "W" | "D" | "L";
  sFor: MatchStat | null; sAgainst: MatchStat | null;
}
export interface TeamProfile { teamId: number; rows: TeamRow[] }

export interface Prediction {
  home: number; draw: number; away: number; advice: string | null;
}
export interface LeagueInfo {
  id: number; name: string; type: string; country: string; flag: string | null; logo: string | null;
}
/** Medias POR PARTIDO (suma de ambos equipos) y % de la competición. */
export interface LeagueAvg {
  n: number;
  goals: number | null; shots: number | null; shotsOn: number | null;
  corners: number | null; cards: number | null;
  over15: number | null; over25: number | null; btts: number | null;
}
