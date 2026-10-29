import "server-only";

export type BillingPlan = "monthly" | "annual";

export function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY ?? "";
}

export function stripePriceId(plan: BillingPlan) {
  return plan === "monthly" ? process.env.STRIPE_PRICE_MONTHLY_ID ?? "" : process.env.STRIPE_PRICE_ANNUAL_ID ?? "";
}

export type StripePlanDetails = { amount: string; interval: string };

export async function getStripePlanDetails(plan: BillingPlan): Promise<StripePlanDetails | null> {
  const secret = stripeSecretKey();
  const priceId = stripePriceId(plan);
  if (!secret || !priceId) return null;

  try {
    const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const price = await response.json() as { unit_amount?: number | null; currency?: string; recurring?: { interval?: string; interval_count?: number } | null };
    if (typeof price.unit_amount !== "number" || !price.currency || !price.recurring?.interval) return null;
    if (price.recurring.interval !== (plan === "monthly" ? "month" : "year")) return null;
    if ((price.recurring.interval_count ?? 1) !== 1) return null;
    const amount = new Intl.NumberFormat("es-ES", { style: "currency", currency: price.currency }).format(price.unit_amount / 100);
    const interval = price.recurring.interval === "year" ? "año" : price.recurring.interval === "month" ? "mes" : price.recurring.interval;
    return { amount, interval };
  } catch {
    return null;
  }
}
