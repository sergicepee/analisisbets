"use client";

import { I18nText } from "@/components/I18nProvider";
import type { MatchPeriod } from "@/lib/types";

const PERIODS: Array<{ value: MatchPeriod; label: string }> = [
  { value: "full", label: "Partido completo" },
  { value: "first", label: "1.ª parte" },
  { value: "second", label: "2.ª parte" },
];

export function PeriodTabs({ value, onChange, label }: {
  value: MatchPeriod;
  onChange: (value: MatchPeriod) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="grid grid-cols-3 gap-1 rounded-full border border-line bg-bg/70 p-1">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          type="button"
          role="tab"
          aria-selected={value === period.value}
          onClick={() => onChange(period.value)}
          className={`min-w-0 rounded-full px-1.5 py-2 text-[9px] font-bold transition sm:px-3 sm:text-xs ${value === period.value ? "bg-brand text-slate-950" : "text-muted hover:bg-white/5 hover:text-fg"}`}
        >
          <I18nText text={period.label} />
        </button>
      ))}
    </div>
  );
}
