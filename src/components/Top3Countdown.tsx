"use client";

import { useEffect, useState } from "react";
import { IconCalendar } from "@/components/icons";

const MADRID = "Europe/Madrid";
const madridFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MADRID,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function madridMidnight(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return NaN;

  // Convierte la medianoche de Madrid a UTC, teniendo en cuenta el horario de verano.
  let timestamp = Date.UTC(year, month - 1, day);
  for (let i = 0; i < 2; i += 1) {
    const parts = Object.fromEntries(madridFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    timestamp -= localAsUtc - timestamp;
  }
  return timestamp;
}

function madridDateLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function Top3Countdown({ date }: { date: string }) {
  const target = madridMidnight(date);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (now === null || !Number.isFinite(target) || target <= now) return null;

  const totalSeconds = Math.floor((target - now) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const units = days >= 2
    ? [[days, "DÍAS"], [hours, "HORAS"], [minutes, "MINUTOS"], [seconds, "SEGUNDOS"]] as const
    : [[Math.floor(totalSeconds / 3600), "HORAS"], [minutes, "MINUTOS"], [seconds, "SEGUNDOS"]] as const;

  return (
    <section aria-label="Cuenta atrás para la jornada" className="flex flex-col gap-4 rounded-2xl border border-brand/30 bg-brand/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 text-brand sm:h-14 sm:w-14">
          <IconCalendar className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div>
          <h2 className="text-base font-extrabold sm:text-xl">Cuenta atrás para la jornada</h2>
          <p className="mt-1 text-xs text-muted sm:text-sm">{madridDateLabel(date)} a las 00:00 · Europe/Madrid</p>
        </div>
      </div>
      <div className={`grid w-full gap-2 sm:w-auto sm:gap-3 ${units.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {units.map(([value, label]) => (
          <div key={label} className="flex min-w-0 flex-col items-center justify-center rounded-xl border border-line bg-bg/70 px-1 py-2 sm:min-w-[76px] sm:px-3 sm:py-2.5">
            <span className="text-2xl font-black leading-none text-brand sm:text-3xl">{String(value).padStart(2, "0")}</span>
            <span className="mt-1 text-[8px] font-semibold text-muted sm:text-[9px]">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
