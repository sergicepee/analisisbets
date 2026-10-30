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
