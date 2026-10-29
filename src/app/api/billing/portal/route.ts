import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { getStripeCustomerId, hasSubscriberAccess } from "@/lib/subscriptions";
import { stripeSecretKey } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para gestionar tu suscripción." }, { status: 401 });
  if (!(await hasSubscriberAccess(user.id))) return NextResponse.json({ error: "No hay una suscripción activa en esta cuenta." }, { status: 404 });
  const secret = stripeSecretKey();
  const customer = await getStripeCustomerId(user.id);
  if (!secret || !customer) return NextResponse.json({ error: "No se pudo encontrar tu suscripción de Stripe." }, { status: 404 });

  const origin = process.env.SITE_URL || new URL(request.url).origin;
  try {
    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ customer, return_url: `${origin}/premium` }),
      cache: "no-store",
    });
    const result = await response.json() as { url?: string };
    if (!response.ok || !result.url) return NextResponse.json({ error: "Stripe no pudo abrir la gestión de la suscripción. Comprueba que el Customer Portal está activado." }, { status: 502 });
    return NextResponse.json({ url: result.url });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Stripe." }, { status: 502 });
  }
}
