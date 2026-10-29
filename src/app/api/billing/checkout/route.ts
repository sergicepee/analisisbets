import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { hasSubscriberAccess } from "@/lib/subscriptions";
import { stripePriceId, stripeSecretKey, type BillingPlan } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para suscribirte." }, { status: 401 });
  if (await hasSubscriberAccess(user.id)) return NextResponse.json({ error: "Tu suscripción Premium ya está activa." }, { status: 409 });

  let plan: BillingPlan;
  try {
    const body = await request.json() as { plan?: string };
    if (body.plan !== "weekly" && body.plan !== "monthly" && body.plan !== "annual") return NextResponse.json({ error: "Elige un plan válido." }, { status: 400 });
    plan = body.plan;
  } catch {
    return NextResponse.json({ error: "No se pudo leer el plan seleccionado." }, { status: 400 });
  }

  const secret = stripeSecretKey();
  const price = stripePriceId(plan);
  if (!secret || !price) return NextResponse.json({ error: "Este plan todavía no está configurado." }, { status: 503 });

  const origin = process.env.SITE_URL || new URL(request.url).origin;
  const form = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    "client_reference_id": user.id,
    "metadata[user_id]": user.id,
    "subscription_data[metadata][user_id]": user.id,
    success_url: `${origin}/premium?estado=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/premium?estado=cancelado`,
  });
  if (user.email) form.set("customer_email", user.email);

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
    });
    const result = await response.json() as { url?: string; error?: { message?: string } };
    if (!response.ok || !result.url) {
      console.error("Stripe checkout error:", result.error?.message ?? response.status);
      return NextResponse.json({ error: "No se pudo iniciar el pago. Inténtalo de nuevo más tarde." }, { status: 502 });
    }
    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Stripe checkout request failed:", error);
    return NextResponse.json({ error: "No se pudo conectar con Stripe." }, { status: 502 });
  }
}
