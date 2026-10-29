import Link from "next/link";
import { addDays, dmy, todayStr } from "@/lib/format";
import { IconCalendar, IconNext, IconPrev } from "./icons";

export function DateNav({ date, base, extra = "", quick = true }: { date: string; base: string; extra?: string; quick?: boolean }) {
  const href = (d: string) => `${base}?date=${d}${extra}`;
  const today = todayStr();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link href={href(addDays(date, -1))} aria-label="Día anterior" className="p-2"><IconPrev className="h-5 w-5" /></Link>
        <div className="flex items-center gap-2 text-base font-semibold">
          <IconCalendar className="h-4 w-4 text-brand" /> {dmy(date)}
        </div>
        <Link href={href(addDays(date, 1))} aria-label="Día siguiente" className="p-2"><IconNext className="h-5 w-5" /></Link>
      </div>
      {quick && (
        <div className="grid grid-cols-3 gap-2">
          {[["Ayer", addDays(today, -1)], ["Hoy", today], ["Mañana", addDays(today, 1)]].map(([l, d]) => (
            <Link key={l} href={href(d)} className={`rounded-full border py-2 text-center text-sm font-medium ${date === d ? "border-brand bg-brand text-black" : "border-line bg-card2 text-slate-300"}`}>{l}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
