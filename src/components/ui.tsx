import type { ComponentType, ReactNode } from "react";
import type { Tone } from "@/lib/metrics";
import { Shield } from "./Shield";
import { num, pct } from "@/lib/format";
import { t } from "@/lib/i18n";

const BAR: Record<Tone, string> = { up: "bg-chartHit", flat: "bg-warn", down: "bg-loss", none: "bg-muted/40" };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function StatCard({
  label, Icon, value, fill = 0, tone = "none", refLabel = "Media liga", refValue, variant = "default",
}: {
  label: string; Icon?: ComponentType<{ className?: string }>; value: string; fill?: number; tone?: Tone; refLabel?: string; refValue?: string | null; variant?: "default" | "tile";
}) {
  return (
    <div className={variant === "tile" ? "flex min-w-0 flex-col rounded-xl bg-[#0f0f0f] p-2.5 sm:p-3" : "card flex min-w-0 flex-col p-3 sm:p-4"}>
      <div className={`${variant === "tile" ? "min-h-6" : "min-h-8"} text-xs leading-4 text-muted sm:min-h-0`}>{label}</div>
      <div className={`${variant === "tile" ? "mt-0.5" : "mt-1"} flex min-w-0 items-center gap-2 text-xl font-extrabold sm:text-2xl ${variant === "tile" ? "text-slate-100" : ""}`}>
        {variant === "tile" ? <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${BAR[tone]}`} /> : Icon && <Icon className="h-4 w-4 shrink-0 text-muted sm:h-5 sm:w-5" />}
        <span className="truncate">{value}</span>
      </div>
      <div className={`${variant === "tile" ? "mt-1.5" : "mt-2"} h-1.5 overflow-hidden rounded bg-line`}><div className={`h-full rounded ${BAR[tone]}`} style={{ width: `${clamp(fill)}%` }} /></div>
      {refValue && <div className={`${variant === "tile" ? "mt-1" : "mt-2"} text-[11px] text-muted`}>{t(refLabel)}: <b className="text-brand">{refValue}</b></div>}
    </div>
  );
}

export function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card min-w-0 p-3 sm:p-4">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2"><h3 className="min-w-0 text-sm font-bold leading-5 sm:text-base">{title}</h3>{right}</div>
      {children}
    </section>
  );
}

export function TeamPair({
  title, totalLabel, total, home, away, homeName, awayName, homeLogo, awayLogo, d = 1,
}: {
  title: string; totalLabel: string; total: number | null; home: number | null; away: number | null;
  homeName: string; awayName: string; homeLogo: string | null; awayLogo: string | null; d?: number;
}) {
  const comparable = home !== null && away !== null && home >= 0 && away >= 0 && home + away > 0;
  const homeShare = comparable ? (home / (home + away)) * 100 : 0;
  const awayShare = 100 - homeShare;
  return (
    <Panel title={title}>
      <div className="flex items-center justify-between gap-2 border-b border-line pb-3 text-xs text-muted sm:text-sm">
        <span>{totalLabel}</span><span className="rounded-lg bg-win/20 px-3 py-1 text-base font-extrabold text-win">{num(total, d)}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        {[[homeLogo, homeName, home], [awayLogo, awayName, away]].map(([logo, name, v], i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Shield src={logo as string | null} alt={name as string} size={34} />
            <div className="max-w-full truncate text-xs font-semibold">{name as string}</div>
            <div className="rounded-lg bg-warn/20 px-3 py-1 text-lg font-extrabold text-warn">{num(v as number | null, d)}</div>
          </div>
        ))}
      </div>
      {comparable && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-semibold">
            <span className="text-win">{pct(homeShare)}</span>
            <span className="text-muted">{pct(awayShare)}</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-line" aria-label={`${homeName} ${pct(homeShare)} · ${awayName} ${pct(awayShare)}`}>
            <div className="h-full bg-win transition-[width]" style={{ width: `${homeShare}%` }} />
            <div className="h-full bg-muted transition-[width]" style={{ width: `${awayShare}%` }} />
          </div>
        </div>
      )}
    </Panel>
  );
}

export type TrendRow = { label: string; a: number | null; b: number | null; m: number | null; kind: "pct" | "num" };
const chip = (v: number | null, kind: "pct" | "num") => {
  if (v === null) return <span className="text-muted">—</span>;
  if (kind === "num") return <span className="rounded-lg bg-card2 px-2.5 py-1 font-bold">{num(v, 1)}</span>;
  const c = v >= 65 ? "bg-chartHit/15 text-chartHit" : v <= 35 ? "bg-loss/15 text-loss" : "bg-warn/20 text-warn";
  return <span className={`rounded-lg px-2.5 py-1 font-bold ${c}`}>{pct(v)}</span>;
};
export function TrendTable({ title, rows, aName, bName, note, sub, totalHead = "Partido" }: { title: string; rows: TrendRow[]; aName: string; bName: string; note?: string; sub?: string; totalHead?: string }) {
  return (
    <Panel title={title}>
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-center text-xs sm:text-sm">
          <thead className="text-xs text-muted">
            <tr><th className="w-[32%] pb-2 text-left font-medium">{t("Métrica")}</th><th className="w-[22%] pb-2 font-medium"><span className="block truncate">{aName}</span>{sub && <div className="truncate text-[9px] font-normal opacity-70 sm:text-[10px]">{sub}</div>}</th><th className="w-[22%] pb-2 font-medium"><span className="block truncate">{bName}</span>{sub && <div className="truncate text-[9px] font-normal opacity-70 sm:text-[10px]">{sub}</div>}</th><th className="w-[24%] pb-2 font-medium">{t(totalHead)}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <td className="py-2.5 pr-1 text-left leading-tight text-slate-300">{r.label}</td>
                <td>{chip(r.a, r.kind)}</td><td>{chip(r.b, r.kind)}</td><td>{chip(r.m, r.kind)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="mt-3 text-[11px] leading-snug text-muted">{note}</p>}
    </Panel>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" }) {
  return <div className={`rounded-xl border px-3 py-2.5 text-xs leading-snug ${tone === "warn" ? "border-warn/40 bg-warn/10 text-warn" : "border-line bg-card text-muted"}`}>{children}</div>;
}
