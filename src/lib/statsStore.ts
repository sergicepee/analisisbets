import { getSupabase } from "./supabase";
import { MIN_LEAGUE_SAMPLE } from "./config";
import type { LeagueAvg, StoredStats } from "./types";

const mem = new Map<number, StoredStats>();

export async function getStored(fixtureId: number): Promise<StoredStats | null> {
  const m = mem.get(fixtureId);
  if (m) return m;
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.from("fixture_stats").select("*").eq("fixture_id", fixtureId).maybeSingle();
    if (!data) return null;
    const s = fromRow(data);
    mem.set(fixtureId, s);
    return s;
  } catch { return null; }
}

export async function saveStored(s: StoredStats) {
  mem.set(s.fixtureId, s);
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("fixture_stats").upsert({
      fixture_id: s.fixtureId, league_id: s.leagueId, season: s.season,
      home_id: s.homeId, away_id: s.awayId, home: s.home, away: s.away,
      goals_home: s.goalsHome, goals_away: s.goalsAway, has_data: s.hasData,
    });
  } catch { /* ignorar */ }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): StoredStats {
  return {
    fixtureId: r.fixture_id, leagueId: r.league_id, season: r.season,
    homeId: r.home_id, awayId: r.away_id, home: r.home, away: r.away,
    goalsHome: r.goals_home, goalsAway: r.goals_away, hasData: r.has_data,
  };
}

async function listLeague(leagueId: number, season: number): Promise<StoredStats[]> {
  const sb = getSupabase();
  if (!sb) return [...mem.values()].filter((s) => s.leagueId === leagueId && s.season === season);
  try {
    const { data } = await sb.from("fixture_stats").select("*").eq("league_id", leagueId).eq("season", season).limit(1000);
    return (data ?? []).map(fromRow);
  } catch { return []; }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Media de liga calculada con los partidos que ya hemos guardado. null si hay muy pocos. */
export async function leagueAvgFromStore(leagueId: number, season: number): Promise<LeagueAvg | null> {
  const rows = await listLeague(leagueId, season);
  if (rows.length < MIN_LEAGUE_SAMPLE) return null;
  const tot = (s: StoredStats, k: "shots" | "shotsOn" | "corners" | "cards") =>
    s.home[k] !== null && s.away[k] !== null ? (s.home[k] as number) + (s.away[k] as number) : null;
  const stat = (k: "shots" | "shotsOn" | "corners" | "cards") =>
    mean(rows.filter((r) => r.hasData).map((r) => tot(r, k)).filter((x): x is number => x !== null));
  const goals = rows.map((r) => r.goalsHome + r.goalsAway);
  const pct = (f: (r: StoredStats) => boolean) => (rows.filter(f).length / rows.length) * 100;
  return {
    n: rows.length,
    goals: mean(goals),
    shots: stat("shots"), shotsOn: stat("shotsOn"), corners: stat("corners"), cards: stat("cards"),
    over15: pct((r) => r.goalsHome + r.goalsAway > 1.5),
    over25: pct((r) => r.goalsHome + r.goalsAway > 2.5),
    btts: pct((r) => r.goalsHome > 0 && r.goalsAway > 0),
  };
}
