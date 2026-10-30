import Link from "next/link";
import { addDays, todayStr } from "@/lib/format";
import { IconNext, IconPrev } from "./icons";
import { DatePicker } from "./DatePicker";
import { I18nText } from "./I18nProvider";

export function DateNav({ date, base, extra = "", quick = true }: { date: string; base: string; extra?: string; quick?: boolean }) {
  const href = (d: string) => `${base}?date=${d}${extra}`;
  const today = todayStr();
  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between">
        <Link href={href(addDays(date, -1))} aria-label="Día anterior" className="p-1.5 sm:p-2"><IconPrev className="h-4 w-4 sm:h-5 sm:w-5" /></Link>
        <DatePicker date={date} base={base} extra={extra} />
        <Link href={href(addDays(date, 1))} aria-label="Día siguiente" className="p-1.5 sm:p-2"><IconNext className="h-4 w-4 sm:h-5 sm:w-5" /></Link>
      </div>
      {quick && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {[["Ayer", addDays(today, -1)], ["Hoy", today], ["Mañana", addDays(today, 1)]].map(([l, d]) => (
            <Link key={l} href={href(d)} className={`rounded-full border py-1.5 text-center text-xs font-medium sm:py-2 sm:text-sm ${date === d ? "border-brand bg-brand text-black" : "border-line bg-card2 text-slate-300"}`}><I18nText text={l} /></Link>
          ))}
        </div>
      )}
    </div>
  );
}
