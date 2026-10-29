import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export const authUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
export const authKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const authConfigured = () => !!(authUrl() && authKey());

/** Cliente de Supabase con la sesión del usuario (cookies). Respeta RLS. */
export function createAuthServer() {
  const store = cookies();
  return createServerClient(authUrl(), authKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* desde Server Component: lo gestiona el middleware */ }
      },
    },
  });
}

export async function getUser() {
  if (!authConfigured()) return null;
  try {
    const { data } = await createAuthServer().auth.getUser();
    return data.user ?? null;
  } catch { return null; }
}

/** Evita redirecciones abiertas: solo rutas internas. */
export const safeNext = (n: string | null | undefined, fallback = "/cuenta") =>
  n && n.startsWith("/") && !n.startsWith("//") ? n : fallback;
