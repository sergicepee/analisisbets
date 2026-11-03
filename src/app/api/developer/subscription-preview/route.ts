import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import {
  createDeveloperPreviewToken,
  isDeveloperUser,
  type DeveloperPreviewMode,
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para cambiar el modo de desarrollador." }, { status: 401 });
  if (!isDeveloperUser(user.id)) return NextResponse.json({ error: "Esta cuenta no tiene permisos de desarrollador." }, { status: 403 });

  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  let mode: DeveloperPreviewMode;
  try {
    const body = await request.json() as { mode?: unknown };
    if (body.mode !== "subscriber" && body.mode !== "regular") {
      return NextResponse.json({ error: "Elige un modo de vista válido." }, { status: 400 });
    }
    mode = body.mode;
  } catch {
    return NextResponse.json({ error: "No se pudo leer el modo seleccionado." }, { status: 400 });
  }

  let token: string;
  try {
    token = createDeveloperPreviewToken(user.id, mode);
  } catch (error) {
    console.error("Could not sign developer subscription preview:", error);
    return NextResponse.json({ error: "El modo de desarrollador no está configurado en el servidor." }, { status: 503 });
  }

  const response = NextResponse.json({ mode });
  response.cookies.set("pickzone_developer_subscription_preview", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
