const LIGUE_1_LOGO = "https://assets.football-logos.cc/logos/france/512x512/ligue-1.bcb13eb0.png";
const ESPN_LEAGUE_LOGOS: Record<number, number> = {
  2: 2, 3: 4, 39: 23, 40: 24, 61: 9, 62: 9, 78: 10, 79: 10,
  88: 11, 94: 14, 135: 12, 136: 12, 140: 15, 141: 15,
};

export function getLeagueLogoUrl(leagueId: number, logo?: string | null): string {
  if (leagueId === 61) return LIGUE_1_LOGO;
  const espnId = ESPN_LEAGUE_LOGOS[leagueId];
  return logo ?? (espnId ? `https://a.espncdn.com/i/leaguelogos/soccer/500/${espnId}.png` : `https://media.api-sports.io/football/leagues/${leagueId}.png`);
}
