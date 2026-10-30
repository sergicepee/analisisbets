"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { IconCalendar } from "./icons";

export function DatePicker({ date, base, extra }: { date: string; base: string; extra: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function selectDate(value: string) {
    if (value) router.push(`${base}?date=${value}${extra}`);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          const input = inputRef.current;
          if (!input) return;
          if (input.showPicker) input.showPicker();
          else input.click();
        }}
        aria-label="Seleccionar fecha"
        className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold transition-colors hover:bg-black/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:gap-2 sm:text-base"
      >
      <IconCalendar className="h-3.5 w-3.5 text-brand sm:h-4 sm:w-4" />
      <span>{date.split("-").reverse().join(".")}</span>
      </button>
      <input
        ref={inputRef}
        type="date"
        value={date}
        onChange={(event) => selectDate(event.currentTarget.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute left-0 top-full h-px w-px opacity-0"
      />
    </div>
  );
}
