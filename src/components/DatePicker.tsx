"use client";

import { useRouter } from "next/navigation";
import { IconCalendar } from "./icons";
import { useT } from "./I18nProvider";

export function DatePicker({ date, base, extra }: { date: string; base: string; extra: string }) {
  const router = useRouter();
  const t = useT();

  function selectDate(value: string) {
    if (value) router.push(`${base}?date=${value}${extra}`);
  }

  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold transition-colors hover:bg-black/10 sm:gap-2 sm:text-base">
      <IconCalendar aria-hidden="true" className="h-3.5 w-3.5 text-brand sm:h-4 sm:w-4" />
      <span>{date.split("-").reverse().join(".")}</span>
      <input
        type="date"
        value={date}
        onChange={(event) => selectDate(event.currentTarget.value)}
        aria-label={t("Seleccionar fecha")}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
