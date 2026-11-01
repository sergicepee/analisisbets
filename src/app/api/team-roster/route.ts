import { NextResponse, type NextRequest } from "next/server";
import { getTeamRoster } from "@/lib/apifootball";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const teamId = Number(request.nextUrl.searchParams.get("teamId"));
  const leagueId = Number(request.nextUrl.searchParams.get("leagueId"));
  const season = Number(request.nextUrl.searchParams.get("season"));
  const latestSeason = new Date().getMonth() >= 5 ? new Date().getFullYear() : new Date().getFullYear() - 1;

  if (!Number.isSafeInteger(teamId) || teamId <= 0 ||
      !Number.isSafeInteger(leagueId) || leagueId <= 0 ||
      !Number.isSafeInteger(season) || season < 1900 || season > latestSeason + 1) {
    return NextResponse.json({ error: "Equipo, competición o temporada no válidos." }, { status: 400 });
  }

  try {
    const roster = await getTeamRoster(teamId, leagueId, season);
    return NextResponse.json(roster);
  } catch (error) {
    console.error(`No se pudo cargar la plantilla del equipo ${teamId} en ${season}:`, error);
    return NextResponse.json({ error: "No se pudo cargar la plantilla. Inténtalo de nuevo más tarde." }, { status: 502 });
  }
}
