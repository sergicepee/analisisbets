import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/config";
import { IconLock } from "./icons";
import { Shield } from "./Shield";

type Tab = "goles" | "tiros" | "corners" | "tarjetas";

const PREVIEW: Record<Tab, { title: string; summary: string; rows: string[] }> = {
  goles: { title: "Goles esperados", summary: "Total esperado", rows: ["Goles esperados", "Más de 1,5", "Más de 2,5", "Ambos equipos marcan"] },
  tiros: { title: "Tiros y TAP", summary: "Promedio esperado", rows: ["Promedio de tiros", "Más de 18,5", "Tiros a puerta", "Más de 8,5 TAP"] },
  corners: { title: "Córners", summary: "Córners esperados", rows: ["Promedio de córners", "Más de 7,5", "Más de 8,5", "Más de 9,5"] },
  tarjetas: { title: "Tarjetas", summary: "Tarjetas esperadas", rows: ["Promedio de tarjetas", "Más de 2,5", "Más de 3,5", "Más de 4,5"] },
};

function LockedSection({ children }: { children: ReactNode }) {
  return <section className="card relative isolate overflow-hidden p-4">
    <div aria-hidden="true" className="select-none blur-[3px] opacity-60">{children}</div>
    <div className="absolute inset-0 z-10 flex items-center justify-center p-3">
      <div className="max-w-xs rounded-2xl border border-line bg-card/95 px-5 py-4 text-center shadow-xl backdrop-blur-sm">
        <IconLock className="mx-auto h-5 w-5" />
        <h2 className="mt-1 text-base font-extrabold">Solo para suscriptores</h2>
        <p className="mt-1 text-sm text-muted">Desbloquea todas las estadísticas con {BRAND.name} Premium</p>
        <Link href="/premium" className="mt-3 inline-flex rounded-full bg-brand px-5 py-2 text-sm font-extrabold text-black">Ver planes</Link>
      </div>
    </div>
  </section>;
}

export function PremiumLockedPreview({ tab, home, away }: { tab: Tab; home: { name: string; logo: string | null }; away: { name: string; logo: string | null } }) {
  const preview = PREVIEW[tab];
  return <div className="min-w-0 space-y-3">
    <LockedSection>
      <div className="flex items-center justify-between border-b border-line pb-3 text-sm text-muted"><span>{preview.summary}</span><span className="rounded-lg bg-chartHit/30 px-4 py-2 text-lg font-bold">2,6</span></div>
      <div className="grid grid-cols-3 items-center gap-2 pt-3 text-center">
        <div className="flex flex-col items-center gap-1"><h3 className="font-bold">{preview.title}</h3><Shield src={home.logo} alt="" size={30} /><span className="text-xs">{home.name}</span><span className="rounded-lg bg-brand/30 px-4 py-2 font-bold">1,4</span></div>
        <div className="text-xs text-muted">LOCAL<br />VS<br />VISITANTE</div>
        <div className="flex flex-col items-center gap-1"><span className="invisible text-sm">&nbsp;</span><Shield src={away.logo} alt="" size={30} /><span className="text-xs">{away.name}</span><span className="rounded-lg bg-warn/30 px-4 py-2 font-bold">1,2</span></div>
      </div>
    </LockedSection>
    <LockedSection>
      <h3 className="font-bold">Tendencias de {preview.title.toLowerCase()}</h3>
      <div className="mt-3 grid grid-cols-4 gap-2 border-b border-line pb-2 text-[10px] text-muted"><span>Métrica</span><span className="truncate text-center">{home.name}</span><span className="truncate text-center">{away.name}</span><span className="text-center">Partido</span></div>
      {preview.rows.map((row, index) => <div key={row} className="grid grid-cols-4 items-center gap-2 border-b border-line/70 py-2 text-xs"><span>{row}</span><span className={`mx-auto rounded-lg px-2 py-1 font-bold ${index % 2 ? "bg-brand/30" : "bg-chartHit/30"}`}>{index % 2 ? "72%" : "2,4"}</span><span className="mx-auto rounded-lg bg-warn/30 px-2 py-1 font-bold">{index % 2 ? "64%" : "1,8"}</span><span className="mx-auto rounded-lg bg-brand/30 px-2 py-1 font-bold">{index % 2 ? "81%" : "4,2"}</span></div>)}
    </LockedSection>
  </div>;
}
