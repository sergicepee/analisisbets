import Link from "next/link";
import { BRAND } from "@/lib/config";
import { I18nText } from "./I18nProvider";

const ITEMS = ["Probabilidades de goles", "Tiros y tiros a puerta", "Estadísticas de córners", "Estadísticas de tarjetas"];

export function PremiumBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand/40 bg-gradient-to-br from-[#202b1e] via-[#151a14] to-[#0b0c0b] p-5 text-[#f2f5f7]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand/20 blur-3xl" />
      <span className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-[11px] font-bold tracking-wider text-brand">PREMIUM</span>
      <h3 className="mt-3 text-2xl font-black">{BRAND.name} Premium</h3>
      <p className="mt-1 max-w-xs text-sm text-[#cbd5e1]"><I18nText text="Todos los datos del partido que necesitas, en un solo lugar." /></p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {ITEMS.map((item) => <li key={item} className="flex items-center gap-2"><span className="text-brand">✓</span><I18nText text={item} /></li>)}
      </ul>
      <Link href="/premium" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-extrabold text-black"><I18nText text="Ver planes" /></Link>
    </section>
  );
}
