import { NextResponse, type NextRequest } from "next/server";
import { getLeagues, searchTeams } from "@/lib/apifootball";
import { countryEs } from "@/lib/format";

export const dynamic = "force-dynamic";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
}

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json({ error: "La búsqueda debe tener entre 2 y 80 caracteres." }, { status: 400 });
  }

  try {
    const normalized = normalize(query);
    const [allLeagues, teams] = await Promise.all([
      getLeagues(),
      searchTeams(query),
    ]);
    const leagues = allLeagues.filter((league) =>
      normalize(league.name).includes(normalized) ||
      normalize(countryEs(league.country, league.flag)).includes(normalized),
    ).slice(0, 10);
    return NextResponse.json({ leagues, teams: teams.slice(0, 10) });
  } catch (error) {
    console.error("Could not search teams and leagues:", error);
    return NextResponse.json({ error: "No se pudo completar la búsqueda." }, { status: 500 });
  }
}
