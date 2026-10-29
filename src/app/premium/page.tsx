import Link from "next/link";
import { Header } from "@/components/Header";
import { Notice, Panel } from "@/components/ui";
import { SubscribeButton } from "@/components/SubscribeButton";
import { ManageSubscriptionButton } from "@/components/ManageSubscriptionButton";
import { getUser } from "@/lib/auth";
import { hasSubscriberAccess } from "@/lib/subscriptions";
import { getStripePlanDetails } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getUser();
  const active = user ? await hasSubscriberAccess(user.id) : false;
  const [monthly, annual] = await Promise.all([getStripePlanDetails("monthly"), getStripePlanDetails("annual")]);
  const state = searchParams.estado;

  return <>
    <Header back="/" />
    <main className="mx-auto max-w-3xl space-y-5 px-4 pb-10 pt-6">
      <div className="text-center">
        <span className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-[11px] font-bold tracking-wider text-brand">PICKZONE PREMIUM</span>
        <h1 className="mt-3 text-3xl font-black">Todas las estadísticas. Todo el análisis.</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">Desbloquea las pestañas de Goles, Tiros, Esquinas y Tarjetas en cada partido.</p>
      </div>

      {state === "cancelado" && <Notice>El pago se canceló. No se ha realizado ningún cargo.</Notice>}
      {state === "success" && !active && <Notice>Stripe ha recibido el pago. Estamos confirmando tu suscripción; el acceso se activará en cuanto llegue la confirmación.</Notice>}
      {active ? <Notice>Tu suscripción Premium está activa. Ya puedes abrir las pestañas de estadísticas de los partidos.</Notice> : null}
      {active && <ManageSubscriptionButton />}

      <div className="grid gap-4 sm:grid-cols-2">
        {([ ["monthly", "Mensual", monthly], ["annual", "Anual", annual] ] as const).map(([plan, title, price]) => (
          <Panel key={plan} title={title}>
            <div className="mb-4"><span className="text-3xl font-black">{price?.amount ?? "—"}</span><span className="ml-1 text-sm text-muted">{price ? `/${price.interval}` : "Precio por configurar"}</span></div>
            <p className="mb-4 text-sm text-muted">Acceso Premium completo mientras tu suscripción esté activa.</p>
            {active ? <Link href="/" className="block rounded-full border border-line px-5 py-3 text-center text-sm font-bold">Volver a Pickzone</Link>
              : user ? <SubscribeButton plan={plan} disabled={!price} />
                : <Link href="/login?next=%2Fpremium" className="block rounded-full bg-brand px-5 py-3 text-center text-sm font-extrabold text-black">Inicia sesión para suscribirte</Link>}
          </Panel>
        ))}
      </div>

      <Panel title="Qué incluye Premium">
        <ul className="space-y-2 text-sm">
          {["Análisis detallado de goles", "Tiros y tiros a puerta (TAP)", "Estadísticas de esquinas", "Estadísticas de tarjetas"].map((item) => <li key={item} className="flex gap-2"><span className="text-brand">✓</span>{item}</li>)}
        </ul>
      </Panel>

      {!active && <p className="text-center text-xs text-muted">El análisis General sigue siendo gratis. El pago se procesa de forma segura en Stripe.</p>}
      <div className="text-center"><Link href="/" className="text-sm font-bold text-muted hover:text-white">Volver a los partidos</Link></div>
    </main>
  </>;
}
