import { NextResponse, type NextRequest } from "next/server";
import { createAuthServer, getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function teamFrom(request: NextRequest): Promise<{ id: number; name: string } | null> {
  try {
    const body = await request.json() as { teamId?: unknown; teamName?: unknown };
    if (!Number.isSafeInteger(body.teamId) || typeof body.teamName !== "string") return null;
    const name = body.teamName.trim();
    if (!name || name.length > 100) return null;
    return { id: body.teamId as number, name };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar equipos seguidos." }, { status: 401 });
  const team = await teamFrom(request);
  if (!team) return NextResponse.json({ error: "Equipo no válido." }, { status: 400 });

  const { error } = await createAuthServer().from("followed_teams").upsert(
    { user_id: user.id, team_id: team.id, team_name: team.name },
    { onConflict: "user_id,team_id", ignoreDuplicates: false },
  );
  if (error) {
    console.error("Could not follow team:", error);
    return NextResponse.json({ error: "No se pudo seguir al equipo. Comprueba la configuración de la base de datos." }, { status: 500 });
  }
  return NextResponse.json({ following: true });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar equipos seguidos." }, { status: 401 });
  const team = await teamFrom(request);
  if (!team) return NextResponse.json({ error: "Equipo no válido." }, { status: 400 });

  const { error } = await createAuthServer()
    .from("followed_teams")
    .delete()
    .eq("user_id", user.id)
    .eq("team_id", team.id);
  if (error) {
    console.error("Could not unfollow team:", error);
    return NextResponse.json({ error: "No se pudo dejar de seguir al equipo." }, { status: 500 });
  }
  return NextResponse.json({ following: false });
}
