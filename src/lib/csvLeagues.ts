export type CsvLeague = {
  code: string;
  id: number;
  name: string;
  country: string;
  flag: string;
  timeZone: string;
};

export const CSV_LEAGUES: CsvLeague[] = [
  { code: "E0", id: 39, name: "Premier League", country: "England", flag: "https://flagcdn.com/gb-eng.svg", timeZone: "Europe/London" },
  { code: "SP1", id: 140, name: "La Liga", country: "Spain", flag: "https://flagcdn.com/es.svg", timeZone: "Europe/Madrid" },
  { code: "F1", id: 61, name: "Ligue 1", country: "France", flag: "https://flagcdn.com/fr.svg", timeZone: "Europe/Paris" },
  { code: "I1", id: 135, name: "Serie A", country: "Italy", flag: "https://flagcdn.com/it.svg", timeZone: "Europe/Rome" },
  { code: "D1", id: 78, name: "Bundesliga", country: "Germany", flag: "https://flagcdn.com/de.svg", timeZone: "Europe/Berlin" },
];

export const csvLeagueById = (id: number) => CSV_LEAGUES.find((league) => league.id === id) ?? null;
export const csvLeagueByCode = (code: string) => CSV_LEAGUES.find((league) => league.code === code) ?? null;
