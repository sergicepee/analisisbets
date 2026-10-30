import "server-only";
import { apiEnabled } from "./config";
import { getTz } from "./prefs";
import type {
  Fixture, LeagueAvg, LeagueInfo, StoredStats, TeamProfile,
} from "./types";
import { canonicalTeamName, csvTeamId, getCsvFixture, getCsvFixtures, getCsvFixturesByDate } from "./csvFixtures";
import { getCsvLeagueAverage, getCsvLeagueFixtures, getCsvLeagueSeasons, getCsvLeagueTeams, getCsvStatsForFixture, getCsvTeamMatchSeries, getCsvTeamProfile } from "./csvHistory";
import { CSV_LEAGUES } from "./csvLeagues";
import {
  getEspnFixture,
  getEspnFixtureStats,
  getEspnFixturesByDate,
  getEspnLeagueCountry,
  getEspnLeagueAverage,
  getEspnLeagueFixtures,
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

// ESPN and CSV team IDs differ; these stable image IDs preserve CSV badges.
// Este mapa permite mostrar escudos a los partidos del CSV también en local,
// donde puede no estar configurada la clave para consultar /teams.
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

async function addCsvTeamLogos(fixtures: Fixture[]): Promise<Fixture[]> {
  if (!fixtures.length) return fixtures;
  return fixtures.map((fixture) => ({
    ...fixture,
    home: { ...fixture.home, logo: fixture.home.logo ?? knownTeamLogo(fixture.home.name) ?? repositoryTeamLogo(fixture.home.name, fixture.country), logoFallback: getTeamLogoFallbackUrl(fixture.home.name, fixture.country) },
    away: { ...fixture.away, logo: fixture.away.logo ?? knownTeamLogo(fixture.away.name) ?? repositoryTeamLogo(fixture.away.name, fixture.country), logoFallback: getTeamLogoFallbackUrl(fixture.away.name, fixture.country) },
  }));
}

function fixtureKey(fixture: Fixture): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: getTz() }).format(fixture.timestamp * 1000);
  return [
    fixture.leagueId,
    date,
    teamNameKey(fixture.home.name),
    teamNameKey(fixture.away.name),
  ].join("|");
}

function mergeFixtureSources(primary: Fixture[], fallback: Fixture[]): Fixture[] {
  const seenIds = new Set<number>();
  const seenMatches = new Set<string>();
  return [...primary, ...fallback]
    .filter((fixture) => {
      const key = fixtureKey(fixture);
      if (seenIds.has(fixture.id) || seenMatches.has(key)) return false;
      seenIds.add(fixture.id);
      seenMatches.add(key);
      return true;
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function addEspnTeamLogos(fixtures: Fixture[]): Fixture[] {
  return fixtures.map((fixture) => ({
    ...fixture,
    home: { ...fixture.home, logoFallback: getTeamLogoFallbackUrl(fixture.home.name, fixture.country) },
    away: { ...fixture.away, logoFallback: getTeamLogoFallbackUrl(fixture.away.name, fixture.country) },
  }));
}

// In CSV mode, a kickoff time alone is not enough to call a fixture finished.
// The fixtures CSV supplies the schedule; football-data supplies final scores and statistics.
async function updateCsvFixtureStates(fixtures: Fixture[]): Promise<Fixture[]> {
  const now = Date.now() / 1000;
  return Promise.all(fixtures.map(async (fixture) => {
    if (fixture.statusShort === "SUSP") return { ...fixture, goalsHome: null, goalsAway: null };
    if (fixture.timestamp > now) {
      return { ...fixture, statusShort: "NS", statusLong: "Not Started", elapsed: null, goalsHome: null, goalsAway: null };
    }
    const stats = await getCsvStatsForFixture(fixture);
    if (stats) {
      return {
        ...fixture, statusShort: "FT", statusLong: "Match Finished",
        goalsHome: stats.goalsHome, goalsAway: stats.goalsAway,
        htHome: stats.htHome, htAway: stats.htAway,
        redCardsHome: stats.redHome, redCardsAway: stats.redAway,
      };
    }
    return {
      ...fixture, statusShort: "NS", statusLong: "Pendiente de actualizar",
      elapsed: null, goalsHome: null, goalsAway: null,
    };
  }));
}

// ── Partidos ──
export async function getFixturesByDate(date: string, isToday: boolean): Promise<Fixture[]> {
  void isToday;
  let localFixtures: Fixture[] = [];
  try {
    localFixtures = await getCsvFixturesByDate(date);
  } catch (error) {
    console.error(`No se pudo cargar el respaldo CSV para ${date}:`, error);
  }
  if (apiEnabled) {
    try {
      const espnFixtures = await getEspnFixturesByDate(date);
      const fallbackFixtures = await updateCsvFixtureStates(await addCsvTeamLogos(localFixtures));
      return mergeFixtureSources(addEspnTeamLogos(espnFixtures), fallbackFixtures);
    } catch (error) {
      if (!localFixtures.length) throw error;
      console.error(`ESPN no disponible para ${date}; se usa el calendario CSV:`, error);
    }
  }
  return updateCsvFixtureStates(await addCsvTeamLogos(localFixtures));
}

export async function getFixture(id: number, leagueId?: number, date?: string): Promise<Fixture | null> {
  if (apiEnabled && id > 0) {
    try {
      const fixture = await getEspnFixture(id, leagueId, date);
      if (fixture) return fixture;
    } catch (error) {
      console.error(`No se pudo cargar el partido ESPN ${id}:`, error);
      throw error;
    }
  }
  const csvFixture = await getCsvFixture(id);
  if (csvFixture) return (await updateCsvFixtureStates(await addCsvTeamLogos([csvFixture])))[0];
  return null;
}

/** Estadísticas finales de un partido para liquidar mercados históricos. */
export async function getFixtureStatsFor(f: Fixture): Promise<StoredStats> {
  let csvStats: Awaited<ReturnType<typeof getCsvStatsForFixture>> = null;
  let csvStatsLoaded = false;
  const loadCsvStats = async () => {
    if (csvStatsLoaded) return csvStats;
    csvStatsLoaded = true;
    try {
      csvStats = await getCsvStatsForFixture(f);
    } catch (error) {
      console.error(`No se pudieron cargar las estadísticas CSV del partido ${f.id}:`, error);
    }
    return csvStats;
  };
  if (apiEnabled && f.id > 0) {
    try {
      const stats = await getEspnFixtureStats(f);
      if (stats?.hasData) {
        csvStats = await loadCsvStats();
        if (!csvStats) return stats;
        const merge = (primary: StoredStats["home"], fallback: StoredStats["home"]) => ({
          shots: primary.shots ?? fallback.shots,
          shotsOn: primary.shotsOn ?? fallback.shotsOn,
          corners: primary.corners ?? fallback.corners,
          cards: primary.cards ?? fallback.cards,
        });
        const home = merge(stats.home, csvStats.home), away = merge(stats.away, csvStats.away);
        return {
          ...stats, home, away,
          hasData: [home, away].some((team) => Object.values(team).some((value) => value !== null)),
        };
      }
    } catch (error) {
      console.error(`No se pudieron cargar las estadísticas ESPN del partido ${f.id}:`, error);
    }
  }
  csvStats = await loadCsvStats();
  if (csvStats) return csvStats;
  return {
    fixtureId: f.id, leagueId: f.leagueId, season: f.season,
    homeId: f.home.id, awayId: f.away.id,
    home: { shots: null, shotsOn: null, corners: null, cards: null },
    away: { shots: null, shotsOn: null, corners: null, cards: null },
    goalsHome: f.goalsHome ?? 0, goalsAway: f.goalsAway ?? 0, hasData: false,
  };
}

// ── Perfil de un equipo: últimos N partidos (+ estadísticas reales opcionales) ──
export async function getTeamProfile(teamId: number, withStats = true, season?: number, beforeTimestamp = Infinity, leagueId?: number, teamName?: string): Promise<TeamProfile> {
  if (teamId < 0) return getCsvTeamProfile(teamId, withStats, beforeTimestamp, leagueId);
  let espnProfile: TeamProfile | null = null;
  if (apiEnabled) {
    try {
      const profile = await getEspnTeamProfile(teamId, withStats, season, beforeTimestamp, leagueId);
      if (profile.rows.length) {
        const hasStats = profile.rows.some((row) => row.sFor !== null || row.sAgainst !== null);
        if (!withStats || hasStats) return profile;
        espnProfile = profile;
      }
    } catch (error) {
      console.error(`No se pudo cargar el perfil ESPN del equipo ${teamId}:`, error);
    }
  }
  const localProfile = teamName
    ? await getCsvTeamProfile(csvTeamId(teamName), withStats, beforeTimestamp, leagueId, season).catch((error: unknown) => {
      console.error(`No se pudo cargar el perfil CSV del equipo ${teamName}:`, error);
      return null;
    })
    : null;
  if (localProfile?.rows.length && localProfile.rows.some((row) => row.sFor !== null || row.sAgainst !== null)) {
    return { ...localProfile, teamId };
  }
  return espnProfile ?? (localProfile ? { ...localProfile, teamId } : { teamId, rows: [] });
}

// ── Media de liga ──
export async function getLeagueAverages(leagueId: number, season: number): Promise<LeagueAvg | null> {
  let average: LeagueAvg | null = null;
  if (apiEnabled) {
    try {
      average = await getEspnLeagueAverage(leagueId, season);
    } catch (error) {
      console.error(`No se pudo calcular la media ESPN de la liga ${leagueId}:`, error);
    }
  }
  try {
    const csvAverage = await getCsvLeagueAverage(leagueId, season);
    if (!average) return csvAverage;
    if (!csvAverage) return average;
    return {
      ...average,
      goals: average.goals ?? csvAverage.goals,
      shots: average.shots ?? csvAverage.shots,
      shotsOn: average.shotsOn ?? csvAverage.shotsOn,
      corners: average.corners ?? csvAverage.corners,
      cards: average.cards ?? csvAverage.cards,
      over15: average.over15 ?? csvAverage.over15,
      over25: average.over25 ?? csvAverage.over25,
      btts: average.btts ?? csvAverage.btts,
    };
  } catch (error) {
    console.error(`No se pudo calcular la media CSV de la liga ${leagueId}:`, error);
    return average;
  }
}

// ── Ligas ──
export async function getLeagues(): Promise<LeagueInfo[]> {
  if (apiEnabled) return getEspnLeagues();
  return CSV_LEAGUES.map((league) => ({
    id: league.id, name: league.name, type: "League",
    logo: `https://media.api-sports.io/football/leagues/${league.id}.png`,
    country: league.country, flag: league.flag,
  }));
}

// ── Equipos: búsqueda y partidos ──
export interface TeamHit { id: number; name: string; logo: string | null; logoFallback?: string | null; country: string; leagueId?: number }
export async function searchTeams(q: string): Promise<TeamHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const normalized = term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
  if (apiEnabled && term.length >= 3) {
    try {
      const currentSeason = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;
      const results = await searchEspnTeams(term, currentSeason);
      if (results.length) return results.map((team) => ({
        ...team, logoFallback: getTeamLogoFallbackUrl(team.name, team.country),
      }));
    } catch (error) {
      console.error(`No se pudo buscar "${term}" en ESPN:`, error);
    }
  }
  {
    const found = await Promise.all(CSV_LEAGUES.map(async (league) => (await getCsvLeagueTeams(league.id))
      .filter((team) => team.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "").includes(normalized))
      .map((team) => ({ id: team.id, name: team.name, logo: getTeamLogoUrl(team.name, league.country), logoFallback: getTeamLogoFallbackUrl(team.name, league.country), country: league.country, leagueId: league.id }))));
    return [...new Map(found.flat().map((team) => [team.id, team])).values()]
      .sort((a, b) => {
        const aPrefix = a.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "").startsWith(normalized);
        const bPrefix = b.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "").startsWith(normalized);
        return Number(bPrefix) - Number(aPrefix) || a.name.localeCompare(b.name);
      })
      .slice(0, 20);
  }
}

export async function getLeagueTeams(leagueId: number, season?: number) {
  if (apiEnabled && season) {
    try {
      const teams = await getEspnTeams(leagueId, season);
      if (teams.length) {
        const country = getEspnLeagueCountry(leagueId);
        return teams.map((team) => ({ ...team, logoFallback: getTeamLogoFallbackUrl(team.name, country) }));
      }
    } catch (error) {
      console.error(`No se pudieron cargar los equipos ESPN de la liga ${leagueId}:`, error);
    }
  }
  const local = await getCsvLeagueTeams(leagueId, season);
  const country = CSV_LEAGUES.find((l) => l.id === leagueId)?.country ?? "";
  return local.map((team) => ({
    ...team, logo: getTeamLogoUrl(team.name, country),
    logoFallback: getTeamLogoFallbackUrl(team.name, country),
  }));
}
export async function getLeagueSeasons(leagueId: number) {
  const local = await getCsvLeagueSeasons(leagueId);
  if (!apiEnabled) return local;
  try {
    return [...new Set([...await getEspnLeagueSeasons(leagueId), ...local])].sort((a, b) => b - a);
  } catch (error) {
    console.error(`No se pudieron consultar las temporadas ESPN de la liga ${leagueId}:`, error);
    return local;
  }
}

export async function getLeagueFixtures(leagueId: number, season: number): Promise<Fixture[]> {
  let fallback: Fixture[] = [];
  try {
    const local = (await getCsvFixtures()).filter((fixture) => fixture.leagueId === leagueId && fixture.season === season);
    if (local.length) {
      const withMatchDetails = await Promise.all(local.map(async (fixture) => {
        const stats = await getCsvStatsForFixture(fixture);
        return stats
          ? {
            ...fixture,
            goalsHome: stats.goalsHome,
            goalsAway: stats.goalsAway,
            htHome: stats.htHome,
            htAway: stats.htAway,
            redCardsHome: stats.redHome,
            redCardsAway: stats.redAway,
          }
          : fixture;
      }));
      fallback = await addCsvTeamLogos(withMatchDetails);
    } else {
      fallback = await addCsvTeamLogos(await getCsvLeagueFixtures(leagueId, season));
    }
  } catch (error) {
    console.error(`No se pudo cargar el calendario CSV de la liga ${leagueId}:`, error);
  }
  if (apiEnabled) {
    try {
      const fixtures = await getEspnLeagueFixtures(leagueId, season);
      if (fixtures.length) return mergeFixtureSources(addEspnTeamLogos(fixtures), fallback);
    } catch (error) {
      console.error(`No se pudo cargar el calendario ESPN de la liga ${leagueId}:`, error);
    }
  }
  return fallback;
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

export async function getLeagueTopScorers(leagueId: number, season: number): Promise<LeagueTopScorer[]> {
  if (!apiEnabled) return [];
  try {
    return await getEspnLeagueTopScorers(leagueId, season);
  } catch (error) {
    console.error(`No se pudieron cargar los goleadores ESPN de la liga ${leagueId}:`, error);
    return [];
  }
}

export async function getTeamSeasonProfile(teamId: number, name: string, leagueId: number, season: number): Promise<TeamProfile> {
  let espnProfile: TeamProfile | null = null;
  if (apiEnabled) {
    try {
      const profile = await getEspnTeamProfile(teamId, true, season, Infinity, leagueId, 60);
      if (profile.rows.length) {
        if (profile.rows.some((row) => row.sFor !== null || row.sAgainst !== null)) return profile;
        espnProfile = profile;
      }
    } catch (error) {
      console.error(`No se pudo cargar el perfil de temporada ESPN del equipo ${teamId}:`, error);
    }
  }
  const local = await getCsvTeamProfile(csvTeamId(name), true, Infinity, leagueId, season, 60).catch((error: unknown) => {
    console.error(`No se pudo cargar el perfil CSV de temporada del equipo ${name}:`, error);
    return null;
  });
  if (!local) return espnProfile ?? { teamId, rows: [] };
  if (local.rows.length && local.rows.some((row) => row.sFor !== null || row.sAgainst !== null)) return { ...local, teamId };
  return espnProfile ?? { ...local, teamId };
}
export async function getTeamSeasonMatchSeries(name: string, leagueId: number, season: number) {
  let espnSeries: Awaited<ReturnType<typeof getEspnSeasonMatchSeries>> = [];
  if (apiEnabled) {
    try {
      const teams = await getLeagueTeams(leagueId, season);
      const team = teams.find((item) => item.name === name)
        ?? teams.find((item) => canonicalTeamName(item.name) === canonicalTeamName(name));
      if (team) {
        const series = await getEspnSeasonMatchSeries(team.id, leagueId, season);
        if (series.length) espnSeries = series;
      }
    } catch (error) {
      console.error(`No se pudo cargar la serie ESPN de ${name}:`, error);
    }
  }
  try {
    const csvSeries = await getCsvTeamMatchSeries(csvTeamId(name), leagueId, season);
    const statCount = (series: typeof csvSeries) => series.reduce((count, game) =>
      count + ["shots", "shotsOn", "corners", "cards"].reduce((total, key) =>
        total + (game.own[key as keyof typeof game.own] !== null ? 1 : 0), 0), 0);
    return statCount(csvSeries) > statCount(espnSeries) ? csvSeries : espnSeries.length ? espnSeries : csvSeries;
  } catch (error) {
    console.error(`No se pudo cargar la serie CSV de ${name}:`, error);
    return espnSeries;
  }
}
export async function getTeamUpcomingFixtures(teamId: number, n = 15, leagueId?: number, teamName?: string): Promise<Fixture[]> {
  if (apiEnabled) {
    try {
      const fixtures = await getEspnTeamFixtures(teamId, leagueId, n, true);
      if (fixtures.length) return addEspnTeamLogos(fixtures);
    } catch (error) {
      console.error(`No se pudieron cargar los próximos partidos ESPN del equipo ${teamId}:`, error);
    }
  }
  const fixtures = await getCsvFixtures();
  const now = Date.now() / 1000;
  const csvId = teamName ? csvTeamId(teamName) : teamId;
  const local = await addCsvTeamLogos(fixtures.filter((f) => f.timestamp >= now && (f.home.id === csvId || f.away.id === csvId) && (!leagueId || f.leagueId === leagueId)).sort((a, b) => a.timestamp - b.timestamp).slice(0, n));
  return local;
}
export async function getTeamRecentFixtures(teamId: number, n = 5, leagueId?: number, teamName?: string): Promise<Fixture[]> {
  if (apiEnabled) {
    try {
      const fixtures = await getEspnTeamFixtures(teamId, leagueId, n, false);
      if (fixtures.length) return addEspnTeamLogos(fixtures);
    } catch (error) {
      console.error(`No se pudieron cargar los últimos partidos ESPN del equipo ${teamId}:`, error);
    }
  }
  const fixtures = await getCsvFixtures();
  const now = Date.now() / 1000;
  const csvId = teamName ? csvTeamId(teamName) : teamId;
  const local = await addCsvTeamLogos(fixtures.filter((f) =>
    f.timestamp < now &&
    ["FT", "AET", "PEN"].includes(f.statusShort) &&
    f.goalsHome !== null && f.goalsAway !== null &&
    (f.home.id === csvId || f.away.id === csvId) &&
    (!leagueId || f.leagueId === leagueId),
  ).sort((a, b) => b.timestamp - a.timestamp).slice(0, n));
  const withRedCards = await Promise.all(local.map(async (fixture) => {
    const stats = await getCsvStatsForFixture(fixture);
    return stats
      ? { ...fixture, redCardsHome: stats.redHome, redCardsAway: stats.redAway }
      : fixture;
  }));
  return withRedCards;
}
