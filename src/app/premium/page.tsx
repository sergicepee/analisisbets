import Link from "next/link";
import { Header } from "@/components/Header";
import { Notice } from "@/components/ui";
import { SubscribeButton } from "@/components/SubscribeButton";
import { ManageSubscriptionButton } from "@/components/ManageSubscriptionButton";
import { IconBars, IconLock, IconMatches, IconTrophy } from "@/components/icons";
import { getUser } from "@/lib/auth";
import { getSubscriberAccess } from "@/lib/subscriptions";
import { getStripePlanDetails, type BillingPlan, type StripePlanDetails } from "@/lib/stripe";
import { I18nText } from "@/components/I18nProvider";

export const dynamic = "force-dynamic";

const formatAmount = (cents: number, currency = "EUR") => new Intl.NumberFormat("es-ES", {
  style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(cents / 100);

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getUser();
  const subscriptionAccess = user ? await getSubscriberAccess(user.id) : { active: false, error: false };
  const active = subscriptionAccess.active;
  const [weekly, monthly, annual] = await Promise.all([
    getStripePlanDetails("weekly"), getStripePlanDetails("monthly"), getStripePlanDetails("annual"),
  ]);
  const state = searchParams.estado;
  const plans: Array<{
    id: BillingPlan; title: string; cadence: string; price: StripePlanDetails | null;
    fallbackCents: number; dailyDays: number; popular?: boolean; bestValue?: boolean;
  }> = [
    { id: "weekly", title: "Semanal", cadence: "Cada semana", price: weekly, fallbackCents: 999, dailyDays: 7 },
    { id: "monthly", title: "Mensual", cadence: "Cada mes", price: monthly, fallbackCents: 1990, dailyDays: 30, popular: true },
    { id: "annual", title: "Anual", cadence: "Cada año", price: annual, fallbackCents: 9600, dailyDays: 365, bestValue: true },
  ];
  const sameCurrency = monthly && annual && monthly.currency === annual.currency;
  const annualRegularPrice = sameCurrency ? monthly.unitAmount * 12 : 24000;
  const annualDiscount = annual && sameCurrency
    ? Math.max(0, Math.round((1 - annual.unitAmount / annualRegularPrice) * 100))
    : 60;

  return <>
    <Header back="/" />
    <main className="mx-auto max-w-7xl space-y-5 px-4 pb-10 pt-6 lg:px-6">
      <header className="mx-auto max-w-2xl text-center">
        <span className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-[11px] font-bold tracking-wider text-brand">PICKZONE PREMIUM</span>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl"><I18nText text="Elige tu plan" /></h1>
        <p className="mt-2 text-sm text-muted"><I18nText text="El General sigue siendo gratis. Desbloquea todas las estadísticas avanzadas con Premium." /></p>
      </header>

      {state === "cancelado" && <Notice><I18nText text="El pago se canceló. No se ha realizado ningún cargo." /></Notice>}
      {state === "success" && !active && <Notice><I18nText text="Stripe ha recibido el pago. Estamos confirmando tu suscripción; el acceso se activará en cuanto llegue la confirmación." /></Notice>}
      {subscriptionAccess.error && <Notice tone="warn"><I18nText text="No se pudo comprobar el estado de tu suscripción. El checkout permanecerá desactivado para evitar cargos duplicados." /></Notice>}
      {active && <Notice><I18nText text="Tu suscripción Premium está activa. Ya puedes consultar las estadísticas avanzadas de Goles, Tiros, Esquinas y Tarjetas." /></Notice>}
      {active && <ManageSubscriptionButton />}

      <section aria-label="Premium" className="grid items-stretch gap-5 pt-2 md:grid-cols-3">
        {plans.map((plan) => {
          const cents = plan.price?.unitAmount ?? plan.fallbackCents;
          const currency = plan.price?.currency ?? "EUR";
          const daily = formatAmount(Math.round(cents / plan.dailyDays), currency);
          return <article key={plan.id} className={`relative flex min-w-0 flex-col rounded-3xl border p-5 pt-7 ${plan.popular ? "border-brand bg-gradient-to-b from-brand/10 to-card shadow-[0_0_35px_rgba(173,201,163,0.12)]" : "border-line bg-card"}`}>
            {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-1 text-xs font-extrabold text-black">♛ <I18nText text="Más popular" /></span>}
            {plan.bestValue && <span className="absolute right-4 top-4 rounded-full bg-brand/15 px-3 py-1 text-xs font-extrabold text-brand"><I18nText text="Mejor precio" /></span>}
            <h2 className="text-2xl font-black"><I18nText text={plan.title} /></h2>
                <p className="mt-1 text-sm text-muted"><I18nText text={plan.cadence} /></p>
            <div className="mt-5 min-h-[78px]">
              {plan.bestValue && <div className="mb-1 flex items-center gap-2 text-sm"><span className="text-muted line-through">{formatAmount(annualRegularPrice, sameCurrency ? monthly.currency : "EUR")}</span><span className="rounded-md bg-chartHit/15 px-2 py-0.5 text-xs font-extrabold text-chartHit">-{annualDiscount}%</span></div>}
              <div className={`text-4xl font-black ${plan.popular ? "text-brand" : ""}`}>{formatAmount(cents, currency)}</div>
              <p className="mt-1 text-xs text-muted">≈ {daily} <I18nText text="por día" /></p>
            </div>
            <p className="mt-4 min-h-[88px] text-sm leading-relaxed text-muted"><I18nText text="Renovación automática. Cancela desde la gestión de suscripción en Premium; mantendrás el acceso hasta que termine el periodo pagado." /></p>
            <ul className="mb-5 space-y-2 text-sm">
              {["Estadísticas avanzadas", "Análisis completo del partido", "Todas las ligas"].map((feature) => <li key={feature} className="flex gap-2"><span className="font-bold text-brand">✓</span><I18nText text={feature} /></li>)}
            </ul>
            <div className="mt-auto">
              {active ? <div className="rounded-full border border-line px-4 py-3 text-center text-sm font-bold text-muted"><I18nText text="Incluido en tu suscripción" /></div>
                : user ? <SubscribeButton plan={plan.id} disabled={!plan.price || subscriptionAccess.error} disabledReason={subscriptionAccess.error ? "No se pudo verificar tu suscripción" : undefined} />
                  : <Link href="/login?next=%2Fpremium" className="block rounded-full bg-brand px-5 py-3 text-center text-sm font-extrabold text-black"><I18nText text="Inicia sesión para suscribirte" /></Link>}
              {!plan.price && !active && <p className="mt-2 text-center text-[11px] text-muted"><I18nText text="El cobro se activará al conectar este precio en Stripe." /></p>}
            </div>
          </article>;
        })}
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-2xl font-black"><I18nText text="Todo incluido en Premium" /></h2>
        <p className="mt-1 text-sm text-muted"><I18nText text="Accede a todas las funciones y saca el máximo partido a Pickzone." /></p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [IconBars, "Estadísticas avanzadas", "Goles, tiros, TAP, córners, tarjetas y más."],
            [IconMatches, "Análisis completo del partido", "Información detallada para cada encuentro."],
            [IconTrophy, "Todas las ligas", "Explora las competiciones disponibles en Pickzone."],
            [IconLock, "En todos tus dispositivos", "Web y móvil, cuando quieras."],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof IconBars;
            return <div key={title as string} className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><FeatureIcon className="h-5 w-5" /></span><div><h3 className="text-sm font-bold"><I18nText text={title as string} /></h3><p className="mt-1 text-xs leading-relaxed text-muted"><I18nText text={description as string} /></p></div></div>;
          })}
        </div>
      </section>

      <section className="grid overflow-hidden rounded-2xl border border-line bg-card sm:grid-cols-3">
        <div className="flex items-start gap-3 p-4"><IconLock className="mt-0.5 h-5 w-5 shrink-0 text-muted" /><div><h3 className="text-sm font-bold"><I18nText text="Pago seguro" /></h3><p className="mt-1 text-xs text-muted"><I18nText text="Procesado de forma segura por Stripe." /></p></div></div>
        <div className="flex items-start gap-3 border-line p-4 sm:border-l"><IconMatches className="mt-0.5 h-5 w-5 shrink-0 text-muted" /><div><h3 className="text-sm font-bold"><I18nText text="Renovación automática" /></h3><p className="mt-1 text-xs text-muted"><I18nText text="Gestiona o cancela desde Premium." /></p></div></div>
        <div className="flex items-start gap-3 border-line p-4 sm:border-l"><IconTrophy className="mt-0.5 h-5 w-5 shrink-0 text-muted" /><div><h3 className="text-sm font-bold"><I18nText text="Soporte" /></h3><p className="mt-1 text-xs text-muted"><I18nText text="¿Tienes dudas? Contáctanos." /></p></div></div>
      </section>

      <p className="text-center text-xs text-muted"><I18nText text="Puedes cancelar tu renovación en cualquier momento desde la gestión de suscripción." /></p>
    </main>
  </>;
}
