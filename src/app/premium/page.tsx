import Link from "next/link";
import { Header } from "@/components/Header";
import { Notice, Panel } from "@/components/ui";
import { BRAND } from "@/lib/config";

export default function Page() {
  return (
    <>
      <Header back="/" />
      <main className="space-y-4 px-4 pt-6 lg:mx-auto lg:max-w-2xl">
        <span className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1 text-[11px] font-bold tracking-wider text-brand">PRÓXIMAMENTE</span>
        <h1 className="text-3xl font-black">{BRAND.name} Premium</h1>
        <p className="text-sm text-slate-300">Todos los datos del partido que necesitas, en un solo lugar.</p>
        <Panel title="Qué incluirá">
          <ul className="space-y-2 text-sm">
            {["Probabilidades de goles", "Tiros y tiros a puerta", "Estadísticas de córners", "Estadísticas de tarjetas"].map((t) => (
              <li key={t} className="flex gap-2"><span className="text-brand">✓</span>{t}</li>
            ))}
          </ul>
        </Panel>
        <Notice>Los planes de pago aún no están disponibles: ahora mismo todas las estadísticas se muestran sin restricciones para quien tiene cuenta o no. Esta página es una maqueta para definir la monetización más adelante.</Notice>
        <Link href="/" className="chip chip-on">Volver a los partidos</Link>
      </main>
    </>
  );
}
