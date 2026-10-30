const LIGUE_1_LOGO = "https://assets.football-logos.cc/logos/france/512x512/ligue-1.bcb13eb0.png";

export function getLeagueLogoUrl(leagueId: number, logo?: string | null): string {
  if (leagueId === 61) return LIGUE_1_LOGO;
  return logo ?? `https://media.api-sports.io/football/leagues/${leagueId}.png`;
}
