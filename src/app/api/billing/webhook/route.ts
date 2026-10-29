import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { stripeSecretKey } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StripeSubscription = {
  id: string;
  customer: string | { id: string };
  status: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
};

function validSignature(header: string | null, payload: string, secret: string) {
  if (!header) return false;
  const parts = header.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !signatures.length) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    try {
      const candidate = Buffer.from(signature, "hex");
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    } catch { return false; }
  });
}

async function syncSubscription(subscription: StripeSubscription, userIdOverride?: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase service role is not configured");
  let userId = userIdOverride || subscription.metadata?.user_id;
  if (!userId) {
    const existing = await supabase.from("subscriptions").select("user_id").eq("provider_subscription_id", subscription.id).maybeSingle();
    if (existing.error) throw existing.error;
    userId = existing.data?.user_id;
  }
  if (!userId) throw new Error(`No user is linked to Stripe subscription ${subscription.id}`);

  const allowed = ["active", "trialing", "past_due", "canceled"];
  const status = allowed.includes(subscription.status)
    ? subscription.status
    : subscription.status === "unpaid" || subscription.status === "incomplete_expired" ? "expired" : "inactive";
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { error } = await supabase.from("subscriptions").upsert({
    user_id: userId,
    provider: "stripe",
    provider_customer_id: customerId,
    provider_subscription_id: subscription.id,
    status,
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

async function fetchSubscription(id: string): Promise<StripeSubscription> {
  const secret = stripeSecretKey();
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Stripe subscription lookup failed (${response.status})`);
  return await response.json() as StripeSubscription;
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripeSecretKey()) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const payload = await request.text();
  if (!validSignature(request.headers.get("stripe-signature"), payload, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    const event = JSON.parse(payload) as { type: string; data: { object: Record<string, unknown> } };
    const object = event.data.object;
    if (event.type === "checkout.session.completed" && object.mode === "subscription") {
      const subscriptionId = typeof object.subscription === "string" ? object.subscription : null;
      if (subscriptionId) {
        const subscription = await fetchSubscription(subscriptionId);
        const metadata = object.metadata as Record<string, string> | null;
        await syncSubscription(subscription, metadata?.user_id);
      }
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncSubscription(object as unknown as StripeSubscription);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
