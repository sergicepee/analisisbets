import "server-only";
import { apiEnabled, FORM_MATCHES } from "./config";
import type {
  Fixture, FixtureLineup, LeagueAvg, LeagueCardLeader, LeagueInfo, StoredStats, TeamProfile,
} from "./types";
import { canonicalTeamName } from "./csvFixtures";
import {
  getEspnFixture,
  getEspnFixtureLineups,
  getEspnFixtureStats,
  getEspnFixturesByDate,
  getEspnLeagueCountry,
  getEspnLeagueAverage,
  getEspnLeagueCardLeaders,
  getEspnLeagueFixtures,
  getEspnLeagueInfo,
  getEspnLeagueInfos,
  getEspnLeagueSeasons,
  getEspnLeagueTopScorers,
  getEspnLeagues,
  getEspnSeasonMatchSeries,
  getEspnTeams,
  getEspnTeamFixtures,
  getEspnTeamProfile,
  searchEspnTeams,
} from "./espn";

function teamNameKey(name: string): string {
  return canonicalTeamName(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Stable image IDs fill in missing ESPN team badges.
const knownTeamIds: Record<string, number> = {
  "alaves": 542, "athletic club": 531, "atletico madrid": 530, "barcelona": 529,
  "celta vigo": 538, "elche": 797, "espanyol": 540, "getafe": 546,
  "levante": 539, "osasuna": 727, "rayo vallecano": 728, "real betis": 543,
  "real madrid": 541, "real sociedad": 548, "sevilla": 536, "valencia": 532,
  "villarreal": 533, "malaga": 535, "racing santander": 4665, "deportivo la coruna": 544,
  "hull": 64, "nottm forest": 65, "tottenham": 47, "stoke": 70, "derby": 68, "verona": 504,
};

function knownTeamLogo(name: string): string | null {
  const id = knownTeamIds[teamNameKey(name)];
  return id ? `https://media.api-sports.io/football/teams/${id}.png` : null;
}

const logoCountrySlugs: Record<string, string> = {
  england: "england", spain: "spain", germany: "germany", italy: "italy", france: "france",
};

const logoNameAliases: Record<string, string> = {
  andorra: "FC_Andorra", "fc andorra": "FC_Andorra", castellon: "Castellón", "celta b": "Celta",
  dortmund: "Borussia_Dortmund", "ein frankfurt": "Eintracht_Frankfurt", elversberg: "SV_Elversberg",
  "fc koln": "Cologne", hamburg: "Hamburger_SV", leverkusen: "Bayer_Leverkusen", "m gladbach": "Borussia_Mönchengladbach",
  mainz: "Mainz_05", paderborn: "SC_Paderborn", stuttgart: "VfB_Stuttgart",
  bielefeld: "Arminia_Bielefeld", bochum: "VfL_Bochum", braunschweig: "Eintracht_Braunschweig",
  cottbus: "Energie_Cottbus", darmstadt: "SV_Darmstadt_98", dresden: "Dynamo_Dresden",
  "greuther furth": "Greuther_Fürth", hannover: "Hannover_96", heidenheim: "FC_Heidenheim",
  hertha: "Hertha_BSC", kaiserslautern: "FC_Kaiserslautern", karlsruhe: "Karlsruher_SC",
  magdeburg: "FC_Magdeburg", nurnberg: "FC_Nürnberg", osnabruck: "Osnabrück", wolfsburg: "Wolfsburg",
  "sociedad b": "Real_Sociedad", "sp gijon": "Sporting_Gijón",
  clermont: "Clermont_Foot", "red star": "Red_Star_FC", "st etienne": "AS_Saint-Étienne",
  "paris sg": "Paris_Saint-Germain_(PSG)", "nott m forest": "Nottingham_Forest", hull: "Hull_City",
  tottenham: "Tottenham_Hotspur", stoke: "Stoke_City", derby: "Derby_County", verona: "Hellas_Verona",
  coventry: "Coventry_City", leeds: "Leeds_United", liverpool: "Liverpool_FC",
  wolves: "Wolverhampton_Wanderers", blackburn: "Blackburn_Rovers", bolton: "Bolton_Wanderers",
  preston: "Preston_North_End", lincoln: "Lincoln_City", norwich: "Norwich_City",
  "west brom": "West_Bromwich_Albion", swansea: "Swansea_City", charlton: "Charlton_Athletic",
  qpr: "Queens_Park_Rangers", "sheffield utd": "Sheffield_United",
  birmingham: "Birmingham_City", cardiff: "Cardiff_City", wrexham: "Wrexham_AFC",
  "sc paderborn 07": "SC_Paderborn", "1899 hoffenheim": "Hoffenheim", "fc schalke 04": "Schalke_04",
  "fsv mainz 05": "Mainz_05", "1 fc koln": "Cologne", "sc freiburg": "Freiburg", "fc augsburg": "Augsburg",
  "1 fc heidenheim": "FC_Heidenheim", "vfl osnabruck": "Osnabrück", "vfl wolfsburg": "Wolfsburg",
  "1 fc kaiserslautern": "FC_Kaiserslautern", "1 fc nurnberg": "FC_Nürnberg", "fc st pauli": "St_Pauli",
  "ac milan": "Milan", como: "Como_1907", frosinone: "Frosinone_Calcio", "vicenza virtus": "Vicenza",
  sudtirol: "Suditrol", carrarese: "Carrarese_Calcio", mantova: "Mantova_1911",
  avellino: "US_Avellino_1912", cesena: "Cesena_FC", lorient: "Lorient_FC",
  lyon: "Olympique_Lyonnais", "estac troyes": "Troyes", "le mans": "Le_Mans_FC",
  "stade brestois 29": "Brest", "paris saint germain": "Paris_Saint-Germain_(PSG)",
  strasbourg: "RC_Strasbourg_Alsace", lens: "RC_Lens", "le havre": "Le_Havre_AC",
  monaco: "AS_Monaco", metz: "FC_Metz", "saint etienne": "AS_Saint-Étienne",
  dijon: "Dijon_FCO", "red star fc 93": "Red_Star_FC", reims: "Stade_de_Reims",
  guingamp: "EA_Guingamp", sochaux: "FC_Sochaux-Montbéliard", pau: "Pau_FC",
  nancy: "Nancy_Lorraine", rodez: "Rodez_AF", laval: "Stade_Lavallois", grenoble: "Grenoble_Foot_38",
  "real sociedad ii": "Real_Sociedad", "ad ceuta fc": "Ceuta", "granada cf": "Granada",
  leganes: "Leganés", cordoba: "Córdoba", "sporting gijon": "Sporting_Gijón", almeria: "Almería",
  "deportivo la coruna": "Deportivo_La_Coruña", malaga: "Málaga",
  cadiz: "Cádiz_CF", "celta de vigo ii": "Celta", valladolid: "Real_Valladolid",
  burgos: "Burgos_CF", eldense: "CD_Eldense", alaves: "Deportivo_Alavés",
  "athletic club": "Athletic_Club_Bilbao", "celta vigo": "Celta",
};

function logoTeamKey(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function repositoryTeamLogo(name: string, country: string): string | null {
  const countrySlug = logoCountrySlugs[country.toLowerCase()];
  if (!countrySlug) return null;
  // Logos are served from the repository's country/team SVG folders.
  const label = logoNameAliases[logoTeamKey(name)] ?? name.trim().replace(/\s+/g, "_");
  const file = `${label}.svg`;
  return `https://raw.githubusercontent.com/JoseArroyave/football-logos/main/logos/${countrySlug}/${encodeURIComponent(file)}`;
}
export function getTeamLogoUrl(name: string, country: string): string | null {
  return knownTeamLogo(name) ?? repositoryTeamLogo(name, country);
}
const badgeSlugAliases: Record<string, string> = {
  "real madrid": "real-madrid", "real sociedad": "real-sociedad", "athletic club": "athletic-bilbao",
  "atletico madrid": "atletico-madrid", "real betis": "real-betis", "man city": "manchester-city",
  "man united": "manchester-united", "west brom": "west-bromwich-albion", "wolves": "wolverhampton-wanderers",
  "paris saint germain": "paris-saint-germain", "ac milan": "ac-milan", "inter": "inter-milan",
  andorra: "fc-andorra", castellon: "castellon", "celta b": "celta", dortmund: "borussia-dortmund",
  "ein frankfurt": "eintracht-frankfurt", elversberg: "sv-elversberg", "fc koln": "fc-cologne",
  hamburg: "hamburger-sv", leverkusen: "bayer-leverkusen", "m gladbach": "borussia-monchengladbach",
  mainz: "mainz-05", paderborn: "sc-paderborn", stuttgart: "vfb-stuttgart", bielefeld: "arminia-bielefeld",
  bochum: "vfl-bochum", braunschweig: "eintracht-braunschweig", cottbus: "energie-cottbus",
  darmstadt: "sv-darmstadt-98", dresden: "dynamo-dresden", "greuther furth": "greuther-furth",
  hannover: "hannover-96", heidenheim: "fc-heidenheim", hertha: "hertha-bsc", kaiserslautern: "fc-kaiserslautern",
  karlsruhe: "karlsruher-sc", magdeburg: "1-fc-magdeburg", nurnberg: "fc-nurnberg", osnabruck: "vfl-osnabruck",
  "sociedad b": "real-sociedad", "sp gijon": "sporting-gijon",
  verona: "hellas-verona", clermont: "clermont-foot", "red star": "red-star-fc", "st etienne": "saint-etienne",
  hull: "hull-city", "nott m forest": "nottingham-forest", tottenham: "tottenham-hotspur", stoke: "stoke-city", derby: "derby-county",
};
export function getTeamLogoFallbackUrl(name: string, country: string): string | null {
  if (knownTeamLogo(name)) return repositoryTeamLogo(name, country);
  const slugCountry = logoCountrySlugs[country.toLowerCase()];
  if (!slugCountry) return repositoryTeamLogo(name, country);
  const key = teamNameKey(name);
  const slug = badgeSlugAliases[key] ?? key.replace(/\s+/g, "-");
  return `https://cdn.jsdelivr.net/gh/leoratzlaff/football-badges@latest/logos/${slugCountry}/${slug}.png`;
}

function addEspnTeamLogos(fixtures: Fixture[]): Fixture[] {
  return fixtures.map((fixture) => ({
    ...fixture,
    home: { ...fixture.home, logoFallback: getTeamLogoFallbackUrl(fixture.home.name, fixture.country) },
    away: { ...fixture.away, logoFallback: getTeamLogoFallbackUrl(fixture.away.name, fixture.country) },
  }));
}

// ── Partidos ──
export async function getFixturesByDate(date: string, isToday: boolean): Promise<Fixture[]> {
  void isToday;
  if (!apiEnabled) return [];
  return addEspnTeamLogos(await getEspnFixturesByDate(date));
}

export async function getFixture(id: number, leagueId?: number, date?: string): Promise<Fixture | null> {
  if (!apiEnabled || id < 0) return null;
  try {
    const fixture = await getEspnFixture(id, leagueId, date);
    return fixture ? addEspnTeamLogos([fixture])[0] : null;
  } catch (error) {
    console.error(`No se pudo cargar el partido ESPN ${id}:`, error);
    throw error;
  }
}

/** Estadísticas finales de un partido para liquidar mercados históricos. */
export async function getFixtureStatsFor(f: Fixture): Promise<StoredStats> {
  if (apiEnabled && f.id > 0) {
    try {
      const stats = await getEspnFixtureStats(f);
      if (stats) return stats;
    } catch (error) {
      console.error(`No se pudieron cargar las estadísticas ESPN del partido ${f.id}:`, error);
    }
  }
  return {
    fixtureId: f.id, leagueId: f.leagueId, season: f.season,
    homeId: f.home.id, awayId: f.away.id,
    home: { shots: null, shotsOn: null, corners: null, cards: null },
    away: { shots: null, shotsOn: null, corners: null, cards: null },
    goalsHome: f.goalsHome ?? 0, goalsAway: f.goalsAway ?? 0, hasData: false,
  };
}

export async function getFixtureLineups(fixture: Fixture): Promise<FixtureLineup[]> {
  if (!apiEnabled || fixture.id < 0) return [];
  try {
    return await getEspnFixtureLineups(fixture);
  } catch (error) {
    console.error(`No se pudieron cargar las alineaciones ESPN del partido ${fixture.id}:`, error);
    throw error;
  }
}

// ── Perfil de un equipo: últimos N partidos (+ estadísticas reales opcionales) ──
type TeamProfileOptions = { limit?: number; venue?: "home" | "away"; withHalfTime?: boolean };
export async function getTeamProfile(
  teamId: number,
  withStats = true,
  season?: number,
  beforeTimestamp = Infinity,
  leagueId?: number,
  options?: TeamProfileOptions,
): Promise<TeamProfile> {
  const limit = options?.limit ?? FORM_MATCHES;
  if (!apiEnabled || teamId < 0) return { teamId, rows: [] };
  try {
    return await getEspnTeamProfile(teamId, withStats, season, beforeTimestamp, leagueId, limit, options?.venue, options?.withHalfTime);
  } catch (error) {
    console.error(`No se pudo cargar el perfil ESPN del equipo ${teamId}:`, error);
    throw error;
  }
}

// ── Media de liga ──
export async function getLeagueAverages(leagueId: number, season: number): Promise<LeagueAvg | null> {
  if (!apiEnabled) return null;
  try {
    return await getEspnLeagueAverage(leagueId, season);
  } catch (error) {
    console.error(`No se pudo calcular la media ESPN de la liga ${leagueId}:`, error);
    return null;
  }
}

// ── Ligas ──
export async function getLeagues(): Promise<LeagueInfo[]> {
  if (apiEnabled) return getEspnLeagues();
  return getEspnLeagueInfos();
}

export async function getLeagueById(leagueId: number): Promise<LeagueInfo | null> {
  return getEspnLeagueInfo(leagueId);
}

// ── Equipos: búsqueda y partidos ──
export interface TeamHit { id: number; name: string; logo: string | null; logoFallback?: string | null; country: string; leagueId?: number }
export async function searchTeams(q: string): Promise<TeamHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  if (!apiEnabled || term.length < 3) return [];
  try {
    const currentSeason = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const results = await searchEspnTeams(term, currentSeason);
    return results.map((team) => ({
      ...team, logoFallback: getTeamLogoFallbackUrl(team.name, team.country),
    }));
  } catch (error) {
    console.error(`No se pudo buscar "${term}" en ESPN:`, error);
    throw error;
  }
}

export async function getLeagueTeams(leagueId: number, season?: number) {
  if (!apiEnabled || !season) return [];
  try {
    const teams = await getEspnTeams(leagueId, season);
    const country = getEspnLeagueCountry(leagueId);
    return teams.map((team) => ({ ...team, logoFallback: getTeamLogoFallbackUrl(team.name, country) }));
  } catch (error) {
    console.error(`No se pudieron cargar los equipos ESPN de la liga ${leagueId}:`, error);
    throw error;
  }
}
export async function getLeagueSeasons(leagueId: number) {
  if (!apiEnabled) return [];
  try {
    return await getEspnLeagueSeasons(leagueId);
  } catch (error) {
    console.error(`No se pudieron consultar las temporadas ESPN de la liga ${leagueId}:`, error);
    throw error;
  }
}

export async function getLeagueFixtures(leagueId: number, season: number): Promise<Fixture[]> {
  if (!apiEnabled) return [];
  try {
    return addEspnTeamLogos(await getEspnLeagueFixtures(leagueId, season));
  } catch (error) {
    console.error(`No se pudo cargar el calendario ESPN de la liga ${leagueId}:`, error);
    throw error;
  }
}

export type LeagueStandingsZone = { teamId: number; description: string };

export async function getLeagueStandingsZones(leagueId: number, season: number): Promise<LeagueStandingsZone[]> {
  void leagueId;
  void season;
  return [];
}

export type LeagueTopScorer = {
  id: number;
  name: string;
  photo: string | null;
  teamName: string;
  teamLogo: string | null;
  goals: number;
  assists: number;
  appearances: number;
};

export async function getLeagueCardLeaders(leagueId: number, season: number): Promise<LeagueCardLeader[]> {
  if (!apiEnabled) return [];
  try {
    return await getEspnLeagueCardLeaders(leagueId, season);
  } catch (error) {
    console.error(`No se pudieron cargar los líderes de tarjetas ESPN de la liga ${leagueId}:`, error);
    return [];
  }
}

export async function getLeagueTopScorers(leagueId: number, season: number): Promise<LeagueTopScorer[]> {
  if (!apiEnabled) return [];
  try {
    return await getEspnLeagueTopScorers(leagueId, season);
  } catch (error) {
    console.error(`No se pudieron cargar los goleadores ESPN de la liga ${leagueId}:`, error);
    return [];
  }
}

export async function getTeamSeasonProfile(teamId: number, leagueId: number, season: number): Promise<TeamProfile> {
  if (!apiEnabled) return { teamId, rows: [] };
  try {
    return await getEspnTeamProfile(teamId, true, season, Infinity, leagueId, 60);
  } catch (error) {
    console.error(`No se pudo cargar el perfil de temporada ESPN del equipo ${teamId}:`, error);
    throw error;
  }
}
export async function getTeamSeasonMatchSeries(
  teamId: number,
  name: string,
  leagueId: number,
  season: number,
  teams: Array<{ id: number; name: string }>,
) {
  if (!apiEnabled) return [];
  const team = teams.find((item) => teamNameKey(item.name) === teamNameKey(name));
  const espnTeamId = team?.id ?? teamId;
  try {
    return await getEspnSeasonMatchSeries(espnTeamId, leagueId, season);
  } catch (error) {
    console.error(`No se pudo cargar la serie ESPN de ${name}:`, error);
    throw error;
  }
}
export async function getTeamUpcomingFixtures(teamId: number, n = 15, leagueId?: number): Promise<Fixture[]> {
  if (!apiEnabled) return [];
  try {
    return addEspnTeamLogos(await getEspnTeamFixtures(teamId, leagueId, n, true));
  } catch (error) {
    console.error(`No se pudieron cargar los próximos partidos ESPN del equipo ${teamId}:`, error);
    throw error;
  }
}
export async function getTeamRecentFixtures(teamId: number, n = 5, leagueId?: number): Promise<Fixture[]> {
  if (!apiEnabled) return [];
  try {
    return addEspnTeamLogos(await getEspnTeamFixtures(teamId, leagueId, n, false));
  } catch (error) {
    console.error(`No se pudieron cargar los últimos partidos ESPN del equipo ${teamId}:`, error);
    throw error;
  }
}
