"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

export function CalendarDatePicker({
  date,
  english,
  onSelect,
}: {
  date: string;
  english: boolean;
  onSelect: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(date.slice(0, 7));
  const rootRef = useRef<HTMLDivElement>(null);
  const calendarId = useId();
  const locale = english ? "en-GB" : "es-ES";
  const [yearPart, monthPart] = visibleMonth.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const firstDayOffset = (monthStart.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthStart);
  const displayDate = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00.000Z`));
  const weekdays = english
    ? ["M", "T", "W", "T", "F", "S", "S"]
    : ["L", "M", "X", "J", "V", "S", "D"];

  useEffect(() => {
    setVisibleMonth(date.slice(0, 7));
  }, [date]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function changeMonth(offset: number) {
    const next = new Date(Date.UTC(year, month - 1 + offset, 1));
    setVisibleMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  function selectDay(day: number) {
    const value = `${yearPart}-${monthPart}-${String(day).padStart(2, "0")}`;
    setOpen(false);
    if (value !== date) onSelect(value);
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={calendarId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line bg-bg px-3 text-left text-sm outline-none transition focus-visible:border-brand"
      >
        <span>{displayDate}</span>
        <IconCalendar aria-hidden="true" className="h-4 w-4 text-brand" />
      </button>
      {open && (
        <div
          id={calendarId}
          role="dialog"
          aria-label={english ? "Choose a match date" : "Elige la fecha de los partidos"}
          className="absolute left-0 top-full z-50 mt-2 w-full rounded-2xl border border-line bg-card p-3 shadow-2xl sm:w-[340px]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={english ? "Previous month" : "Mes anterior"}
              onClick={() => changeMonth(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <p aria-live="polite" className="text-sm font-bold capitalize">{monthLabel}</p>
            <button
              type="button"
              aria-label={english ? "Next month" : "Mes siguiente"}
              onClick={() => changeMonth(1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-muted transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekdays.map((weekday, index) => (
              <span key={`${weekday}-${index}`} className="flex h-8 items-center justify-center text-[10px] font-bold uppercase text-muted">
                {weekday}
              </span>
            ))}
            {cells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} aria-hidden="true" />;
              const value = `${yearPart}-${monthPart}-${String(day).padStart(2, "0")}`;
              const selected = date === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  aria-label={new Intl.DateTimeFormat(locale, {
                    dateStyle: "full",
                    timeZone: "UTC",
                  }).format(new Date(`${value}T12:00:00.000Z`))}
                  onClick={() => selectDay(day)}
                  className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${selected ? "bg-brand text-black" : "text-fg hover:bg-card2"}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
