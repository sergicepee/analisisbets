import "server-only";
import { getSupabase } from "./supabase";

/** Comprueba el acceso Premium en servidor; falla cerrado si no hay configuración o suscripción. */
export async function hasSubscriberAccess(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || !["active", "trialing"].includes(data.status)) return false;
  return !data.current_period_end || new Date(data.current_period_end).getTime() > Date.now();
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("provider,provider_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || data?.provider !== "stripe") return null;
  return data.provider_customer_id ?? null;
}
