import type { ComponentType, ReactNode } from "react";
import type { Tone } from "@/lib/metrics";
import { Shield } from "./Shield";
import { num, pct } from "@/lib/format";

const BAR: Record<Tone, string> = { up: "bg-win", flat: "bg-warn", down: "bg-loss", none: "bg-muted/40" };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function StatCard({
  label, Icon, value, fill = 0, tone = "none", refLabel = "Media liga", refValue,
}: {
  label: string; Icon?: ComponentType<{ className?: string }>; value: string; fill?: number; tone?: Tone; refLabel?: string; refValue?: string | null;
}) {
  return (
    <div className="card p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
        {Icon && <Icon className="h-5 w-5 text-muted" />}{value}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-line"><div className={`h-full rounded ${BAR[tone]}`} style={{ width: `${clamp(fill)}%` }} /></div>
      {refValue && <div className="mt-2 text-[11px] text-muted">{refLabel}: <b className="text-brand">{refValue}</b></div>}
    </div>
  );
}

export function Panel({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">{title}</h3>{right}</div>
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
  return (
    <Panel title={title}>
      <div className="flex items-center justify-between border-b border-line pb-3 text-sm text-muted">
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
    </Panel>
  );
}

export type TrendRow = { label: string; a: number | null; b: number | null; m: number | null; kind: "pct" | "num" };
const chip = (v: number | null, kind: "pct" | "num") => {
  if (v === null) return <span className="text-muted">—</span>;
  if (kind === "num") return <span className="rounded-lg bg-card2 px-2.5 py-1 font-bold">{num(v, 1)}</span>;
  const c = v >= 65 ? "bg-win/20 text-win" : v <= 35 ? "bg-loss/20 text-loss" : "bg-warn/20 text-warn";
  return <span className={`rounded-lg px-2.5 py-1 font-bold ${c}`}>{pct(v)}</span>;
};
export function TrendTable({ title, rows, aName, bName, note, sub, totalHead = "Partido" }: { title: string; rows: TrendRow[]; aName: string; bName: string; note?: string; sub?: string; totalHead?: string }) {
  return (
    <Panel title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] text-center text-sm">
          <thead className="text-xs text-muted">
            <tr><th className="pb-2 text-left font-medium">Métrica</th><th className="pb-2 font-medium">{aName}{sub && <div className="text-[10px] font-normal opacity-70">{sub}</div>}</th><th className="pb-2 font-medium">{bName}{sub && <div className="text-[10px] font-normal opacity-70">{sub}</div>}</th><th className="pb-2 font-medium">{totalHead}</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <td className="py-2.5 text-left text-slate-300">{r.label}</td>
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
