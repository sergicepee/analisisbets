import Link from "next/link";
import { BRAND } from "@/lib/config";

const ITEMS = ["Probabilidades de goles", "Tiros y tiros a puerta", "Estadísticas de córners", "Estadísticas de tarjetas"];

export function PremiumBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-win/40 bg-gradient-to-br from-[#0b2a16] via-[#07120c] to-bg p-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-win/20 blur-3xl" />
      <span className="rounded-full border border-win/50 bg-win/10 px-3 py-1 text-[11px] font-bold tracking-wider text-brand">PRÓXIMAMENTE</span>
      <h3 className="mt-3 text-2xl font-black">{BRAND.name} Premium</h3>
      <p className="mt-1 max-w-xs text-sm text-slate-300">Todos los datos del partido que necesitas, en un solo lugar.</p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {ITEMS.map((t) => <li key={t} className="flex items-center gap-2"><span className="text-brand">✓</span>{t}</li>)}
      </ul>
      <Link href="/premium" className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-extrabold text-black">Ver planes</Link>
    </section>
  );
}
