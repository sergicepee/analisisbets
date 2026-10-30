import Link from "next/link";
import { BRAND } from "@/lib/config";
import { LINES } from "@/lib/metrics";
import { num } from "@/lib/format";
import { I18nText } from "./I18nProvider";
import { IconLock } from "./icons";
import { Shield } from "./Shield";

type Tab = "goles" | "tiros" | "corners" | "tarjetas";
type Teams = { home: { name: string; logo: string | null }; away: { name: string; logo: string | null } };

const PREVIEW: Record<Tab, { summary: string; pairs: string[]; trend: string; rows: string[] }> = {
  goles: {
    summary: "Total esperado",
    pairs: ["Goles esperados", "Potencial de gol 1.er tiempo", "Potencial de gol 2.º tiempo"],
    trend: "Tendencias de goles",
    rows: ["Goles esperados", ...LINES.goals.map((line) => `Más de ${num(line)}`), "Ambos equipos marcan"],
  },
  tiros: {
    summary: "Promedio esperado",
    pairs: ["Tiros totales", "TAP"],
    trend: "Tendencias de TAP",
    rows: ["Promedio de TAP", ...LINES.shotsOn.map((line) => `Más de ${num(line)}`)],
  },
  corners: {
    summary: "Córners esperados",
    pairs: ["Córners"],
    trend: "Tendencias de córners",
    rows: ["Promedio de córners", ...LINES.corners.map((line) => `Más de ${num(line)}`)],
  },
  tarjetas: {
    summary: "Total esperado de tarjetas",
    pairs: ["Tarjetas"],
    trend: "Tendencias de tarjetas",
    rows: ["Promedio de tarjetas", ...LINES.cards.map((line) => `Más de ${num(line)}`)],
  },
};

const BLUR_TONES = ["bg-chartHit", "bg-warn", "bg-brand"] as const;

function BlurredValue({ size = "short", tone = 0 }: { size?: "short" | "medium"; tone?: number }) {
  const color = BLUR_TONES[((tone % BLUR_TONES.length) + BLUR_TONES.length) % BLUR_TONES.length];
  return <span aria-hidden="true" className={`inline-block h-5 rounded-md ${color} blur-[10px] opacity-55 ${size === "medium" ? "w-14" : "w-9"}`} />;
}

function LockCard({ compact = false }: { compact?: boolean }) {
  return <div className={`rounded-2xl border border-line bg-card text-center shadow-xl ${compact ? "px-2 py-2" : "px-4 py-3"}`}>
    <IconLock className="mx-auto h-5 w-5" />
    <h2 className="mt-1 text-sm font-extrabold"><I18nText text="Solo para suscriptores" /></h2>
    {!compact && <p className="mt-1 text-sm text-muted"><I18nText text={`Desbloquea todas las estadísticas con ${BRAND.name} Premium`} /></p>}
    <Link href="/premium" className="mt-2 inline-flex rounded-full bg-brand px-4 py-1.5 text-xs font-extrabold text-black"><I18nText text="Ver planes" /></Link>
  </div>;
}

function PairPreview({ title, summary, teams }: { title: string; summary: string; teams: Teams }) {
  return <section className="card p-3 sm:p-4">
    <div className="flex items-center justify-between gap-2 border-b border-line pb-2 text-sm text-muted"><h3 className="font-bold text-fg"><I18nText text={title} /></h3><span className="truncate text-xs"><I18nText text={summary} /></span></div>
    <div className="grid grid-cols-2 items-center gap-2 pt-3 text-center md:grid-cols-[minmax(0,1fr)_minmax(180px,220px)_minmax(0,1fr)] md:gap-3">
      <div className="flex min-w-0 flex-col items-center gap-1"><Shield src={teams.home.logo} alt={teams.home.name} size={34} /><span className="max-w-full truncate text-xs">{teams.home.name}</span><BlurredValue tone={0} /></div>
      <div className="col-start-2 row-start-1 flex min-w-0 flex-col items-center gap-1 md:col-start-3"><Shield src={teams.away.logo} alt={teams.away.name} size={34} /><span className="max-w-full truncate text-xs">{teams.away.name}</span><BlurredValue tone={2} /></div>
      <div className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1"><LockCard compact /></div>
    </div>
  </section>;
}

function TrendPreview({ title, rows, teams }: { title: string; rows: string[]; teams: Teams }) {
  return <section className="card relative isolate overflow-hidden p-3 sm:p-4">
    <h3 className="font-bold"><I18nText text={title} /></h3>
    <div className="mt-3 grid grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,1fr))] items-end gap-1 border-b border-line pb-2 text-[10px] text-muted md:gap-2 md:text-xs">
      <span><I18nText text="Métrica" /></span><span className="truncate text-center">{teams.home.name}</span><span className="truncate text-center">{teams.away.name}</span><span className="truncate text-center"><I18nText text="Total del partido" /></span>
    </div>
    {rows.map((row, index) => <div key={`${row}-${index}`} className="grid grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,1fr))] items-center gap-1 border-b border-line/70 py-2 text-[11px] md:gap-2 md:py-2.5 md:text-xs">
      <span className="min-w-0 leading-tight"><I18nText text={row} /></span>
      <span className="flex justify-center"><BlurredValue size={index % 2 ? "short" : "medium"} tone={index} /></span>
      <span className="flex justify-center"><BlurredValue size={index % 3 ? "medium" : "short"} tone={index + 1} /></span>
      <span className="flex justify-center"><BlurredValue size={index % 2 ? "medium" : "short"} tone={index + 2} /></span>
    </div>)}
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[min(220px,72%)] -translate-x-1/2 -translate-y-1/2">
        <LockCard />
      </div>
    </div>
  </section>;
}

export function PremiumLockedPreview({ tab, home, away }: { tab: Tab; home: Teams["home"]; away: Teams["away"] }) {
  const preview = PREVIEW[tab];
  const teams = { home, away };
  return <div className="min-w-0 space-y-3">
    {preview.pairs.map((title) => <PairPreview key={title} title={title} summary={preview.summary} teams={teams} />)}
    <TrendPreview title={preview.trend} rows={preview.rows} teams={teams} />
  </div>;
}
