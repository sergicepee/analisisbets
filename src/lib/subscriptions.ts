import "server-only";
import { getSupabase } from "./supabase";

export async function getSubscriberAccess(userId: string): Promise<{ active: boolean; error: boolean }> {
  const supabase = getSupabase();
  if (!supabase) {
    console.error("Could not check Premium access: Supabase service role is not configured.");
    return { active: false, error: true };
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Could not check Premium access:", error);
    return { active: false, error: true };
  }
  const active = !!data && ["active", "trialing"].includes(data.status)
    && (!data.current_period_end || new Date(data.current_period_end).getTime() > Date.now());
  return { active, error: false };
}

export async function getStripeCustomerId(userId: string): Promise<{ customerId: string | null; error: boolean }> {
  const supabase = getSupabase();
  if (!supabase) {
    console.error("Could not load Stripe customer: Supabase service role is not configured.");
    return { customerId: null, error: true };
  }
  const { data, error } = await supabase
    .from("subscriptions")
    .select("provider,provider_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Could not load Stripe customer:", error);
    return { customerId: null, error: true };
  }
  if (data?.provider !== "stripe") return { customerId: null, error: false };
  return { customerId: data.provider_customer_id ?? null, error: false };
}
