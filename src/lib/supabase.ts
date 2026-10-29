import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Cliente solo-servidor (service role). Devuelve null si no está configurado. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return (client = null);
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js 14 cachea fetch GET por defecto: lo desactivamos para leer siempre datos frescos.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}
export const hasSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
