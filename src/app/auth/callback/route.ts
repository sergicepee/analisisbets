import { NextResponse, type NextRequest } from "next/server";
import { createAuthServer, safeNext } from "@/lib/auth";

// Recibe el retorno de Google y de los enlaces de email (confirmar cuenta / recuperar contraseña).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    const { error } = await createAuthServer().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
