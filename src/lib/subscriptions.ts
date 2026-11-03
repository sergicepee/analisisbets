import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSupabase } from "./supabase";

export type DeveloperPreviewMode = "subscriber" | "regular";

const DEVELOPER_PREVIEW_COOKIE = "pickzone_developer_subscription_preview";

export function isDeveloperUser(userId: string): boolean {
  const allowedIds = (process.env.DEVELOPER_USER_IDS ?? "")
    .split(/[,\s]+/)
    .filter(Boolean);
  return allowedIds.includes(userId);
}

function developerPreviewSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function signDeveloperPreview(payload: string): string {
  const secret = developerPreviewSecret();
  if (!secret) throw new Error("Developer preview requires SUPABASE_SERVICE_ROLE_KEY.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createDeveloperPreviewToken(userId: string, mode: DeveloperPreviewMode): string {
  const payload = Buffer.from(JSON.stringify({ userId, mode })).toString("base64url");
  return `${payload}.${signDeveloperPreview(payload)}`;
}

export async function getDeveloperPreviewMode(userId: string): Promise<DeveloperPreviewMode | null> {
  if (!isDeveloperUser(userId)) return null;
  if (!developerPreviewSecret()) return null;
  const token = cookies().get(DEVELOPER_PREVIEW_COOKIE)?.value;
  if (!token) return null;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  let actualSignature: Buffer;
  try {
    actualSignature = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  const expectedSignature = Buffer.from(signDeveloperPreview(payload), "base64url");
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      mode?: unknown;
    };
    if (data.userId !== userId || (data.mode !== "subscriber" && data.mode !== "regular")) return null;
    return data.mode;
  } catch {
    return null;
  }
}

export async function getDisplaySubscriberAccess(userId: string): Promise<{
  active: boolean;
  error: boolean;
  developerMode: DeveloperPreviewMode | null;
}> {
  const developerMode = await getDeveloperPreviewMode(userId);
  if (developerMode) return {
    active: developerMode === "subscriber",
    error: false,
    developerMode,
  };
  const access = await getSubscriberAccess(userId);
  return {
    ...access,
    developerMode: null,
  };
}

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
