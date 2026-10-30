import { NextResponse, type NextRequest } from "next/server";
import { createAuthServer, getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function leagueFrom(request: NextRequest) {
  try {
    const body = await request.json() as { leagueId?: unknown; leagueName?: unknown; country?: unknown; logo?: unknown };
    if (!Number.isSafeInteger(body.leagueId) || typeof body.leagueName !== "string" || typeof body.country !== "string") return null;
    const name = body.leagueName.trim();
    const country = body.country.trim();
    if ((body.leagueId as number) <= 0 || !name || name.length > 100 || !country || country.length > 100) return null;
    if (body.logo !== null && body.logo !== undefined && (typeof body.logo !== "string" || body.logo.length > 500)) return null;
    return { id: body.leagueId as number, name, country, logo: typeof body.logo === "string" ? body.logo : null };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para seguir ligas." }, { status: 401 });
  const league = await leagueFrom(request);
  if (!league) return NextResponse.json({ error: "Liga no válida." }, { status: 400 });

  const { error } = await createAuthServer().from("followed_leagues").upsert(
    { user_id: user.id, league_id: league.id, league_name: league.name, country: league.country, logo: league.logo },
    { onConflict: "user_id,league_id", ignoreDuplicates: false },
  );
  if (error) {
    console.error("Could not follow league:", error);
    return NextResponse.json({ error: "No se pudo seguir la liga. Comprueba la configuración de la base de datos." }, { status: 500 });
  }
  return NextResponse.json({ following: true });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para seguir ligas." }, { status: 401 });
  const league = await leagueFrom(request);
  if (!league) return NextResponse.json({ error: "Liga no válida." }, { status: 400 });

  const { error } = await createAuthServer()
    .from("followed_leagues")
    .delete()
    .eq("user_id", user.id)
    .eq("league_id", league.id);
  if (error) {
    console.error("Could not unfollow league:", error);
    return NextResponse.json({ error: "No se pudo dejar de seguir la liga." }, { status: 500 });
  }
  return NextResponse.json({ following: false });
}
