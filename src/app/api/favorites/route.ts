import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createAuthServer, getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function fixtureIdFrom(request: NextRequest): Promise<number | null> {
  try {
    const body = await request.json() as { fixtureId?: unknown };
    return typeof body.fixtureId === "number" && Number.isSafeInteger(body.fixtureId)
      ? body.fixtureId
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar favoritos." }, { status: 401 });
  const fixtureId = await fixtureIdFrom(request);
  if (fixtureId === null) return NextResponse.json({ error: "ID de partido no válido." }, { status: 400 });

  const { error } = await createAuthServer().from("favorite_fixtures").upsert(
    { user_id: user.id, fixture_id: fixtureId },
    { onConflict: "user_id,fixture_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("Could not save user favorite fixture:", error);
    return NextResponse.json({ error: "No se pudo guardar el favorito. Comprueba la configuración de la base de datos." }, { status: 500 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ favorite: true });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar favoritos." }, { status: 401 });
  const fixtureId = await fixtureIdFrom(request);
  if (fixtureId === null) return NextResponse.json({ error: "ID de partido no válido." }, { status: 400 });

  const { error } = await createAuthServer()
    .from("favorite_fixtures")
    .delete()
    .eq("user_id", user.id)
    .eq("fixture_id", fixtureId);
  if (error) {
    console.error("Could not remove user favorite fixture:", error);
    return NextResponse.json({ error: "No se pudo quitar el favorito. Comprueba la configuración de la base de datos." }, { status: 500 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ favorite: false });
}
