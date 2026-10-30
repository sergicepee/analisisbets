import "server-only";
import { createAuthServer } from "./auth";

export async function getFavoriteFixtureIds(userId: string, fixtureIds: number[]) {
  if (!fixtureIds.length) return { favoriteIds: new Set<number>(), error: false };

  const { data, error } = await createAuthServer()
    .from("favorite_fixtures")
    .select("fixture_id")
    .eq("user_id", userId)
    .in("fixture_id", fixtureIds);

  if (error) {
    console.error("Could not load user favorite fixtures:", error);
    return { favoriteIds: new Set<number>(), error: true };
  }
  return {
    favoriteIds: new Set<number>((data ?? []).map((row) => Number(row.fixture_id))),
    error: false,
  };
}

export async function getUserFavoriteFixtureIds(userId: string) {
  const { data, error } = await createAuthServer()
    .from("favorite_fixtures")
    .select("fixture_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Could not load user favorite fixtures:", error);
    return { fixtureIds: [], error: true };
  }
  return {
    fixtureIds: (data ?? []).map((row) => Number(row.fixture_id)).filter(Number.isSafeInteger),
    error: false,
  };
}

export async function getUserFollowedTeams(userId: string) {
  const { data, error } = await createAuthServer()
    .from("followed_teams")
    .select("team_id, team_name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Could not load user followed teams:", error);
    return { teams: [], error: true };
  }
  return {
    teams: (data ?? [])
      .map((row) => ({ id: Number(row.team_id), name: row.team_name }))
      .filter((team) => Number.isSafeInteger(team.id) && typeof team.name === "string"),
    error: false,
  };
}

export async function getTeamFollowStatus(userId: string, teamId: number) {
  const { data, error } = await createAuthServer()
    .from("followed_teams")
    .select("team_id")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    console.error("Could not load user team follow status:", error);
    return { following: false, error: true };
  }
  return { following: !!data, error: false };
}
