"use client";

import Link from "next/link";
import { useState } from "react";
import { I18nText } from "./I18nProvider";
import { IconCard, IconCorner, IconLock, IconTarget } from "./icons";
import { Shield } from "./Shield";

type Tab = "tiros" | "corners" | "tarjetas";
type Teams = { home: { name: string; logo: string | null }; away: { name: string; logo: string | null } };

const num = (value: number, locale: string) =>
  value.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const BLUR_TONES = ["bg-chartHit", "bg-warn", "bg-brand"] as const;

function BlurredValue({ size = "short", tone = 0 }: { size?: "short" | "medium"; tone?: number }) {
  const color = BLUR_TONES[((tone % BLUR_TONES.length) + BLUR_TONES.length) % BLUR_TONES.length];
  return <span aria-hidden="true" className={`inline-block h-5 rounded-md ${color} blur-[10px] opacity-55 ${size === "medium" ? "w-14" : "w-9"}`} />;
}

function PremiumUnlockBanner({ text = "Desbloquea las estadísticas de córners con Premium" }: { text?: string }) {
  return (
    <Link href="/premium" className="flex items-center justify-center gap-2 rounded-xl bg-brand px-3 py-3 text-center text-xs font-extrabold text-black shadow-lg shadow-brand/10">
      <IconLock className="h-4 w-4" />
      <I18nText text={text} />
    </Link>
  );
}

function LockedSelector<T extends string>({ value, options, onChange, label }: {
  value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-full border border-line bg-bg/70 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-w-0 flex-1 rounded-full px-2 py-2 text-[10px] font-bold transition sm:px-4 sm:text-xs ${value === option.value ? "bg-brand text-slate-950" : "text-muted hover:bg-white/5 hover:text-fg"}`}
        >
          <I18nText text={option.label} />
        </button>
      ))}
    </div>
  );
}

function LockedStatsTable({ teams, rows, firstColumn = "Métrica" }: {
  teams: Teams; rows: string[]; firstColumn?: string;
}) {
  return (
    <div className="min-w-0">
      <table className="w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-[3px] text-[9px] sm:text-xs">
        <colgroup><col style={{ width: "38%" }} /><col style={{ width: "21%" }} /><col style={{ width: "21%" }} /><col style={{ width: "20%" }} /></colgroup>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="rounded-l-md bg-card2 px-2 py-2 text-left font-semibold"><I18nText text={firstColumn} /></th>
            {[teams.home, teams.away].map((team) => (
              <th key={team.name} scope="col" className="bg-card2 px-1 py-2 text-center font-semibold">
                <span className="flex min-w-0 flex-col items-center gap-1">
                  <Shield src={team.logo} alt="" size={18} />
                  <span className="w-full truncate">{team.name}</span>
                </span>
              </th>
            ))}
            <th scope="col" className="rounded-r-md bg-card2 px-1 py-2 text-center font-semibold"><I18nText text="Medio" /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <th scope="row" className="rounded-l-lg bg-card2 px-2 py-2 text-left font-medium leading-tight"><I18nText text={row} /></th>
              {[0, 1, 2].map((index) => (
                <td key={index} className={`bg-card2 px-1 py-1 text-center ${index === 2 ? "rounded-r-lg" : ""}`}>
                  <span className="flex min-h-9 items-center justify-center rounded-lg bg-brand/10 text-brand"><IconLock className="h-3.5 w-3.5" /></span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CornersLockedPreview({ teams, locale }: { teams: Teams; locale: string }) {
  const [view, setView] = useState<"match" | "team">("match");
  const rows = view === "match"
    ? Array.from({ length: 8 }, (_, index) => `Más de ${index + 6}`)
    : [
        "Córners ganados/partido",
        "Córners en contra/partido",
        ...(["Córners ganados", "Córners en contra"] as const).flatMap((side) =>
          [2.5, 3.5, 4.5].map((line) => `Más de ${num(line, locale)} · ${side}`),
        ),
      ];
  return (
    <div className="min-w-0 space-y-3">
      <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <IconCorner className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-extrabold"><I18nText text="Estadísticas de Córners" /></h2>
          <span className="text-xs text-muted"><I18nText text="¿Cuántos córners habrá?" /></span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-card2 p-3">
          {[teams.home, teams.away].map((team, index) => (
            <div key={team.name} className={`${index === 0 ? "col-start-1" : "col-start-3"} row-start-1 flex min-w-0 flex-col items-center gap-1 text-center`}>
              <Shield src={team.logo} alt="" size={25} />
              <span className="w-full truncate text-[10px] font-semibold sm:text-xs">{team.name}</span>
              <BlurredValue size="medium" tone={index} />
              <span className="text-[9px] leading-tight text-muted"><I18nText text="Córners ganados/partido" /></span>
            </div>
          ))}
          <div className="col-start-2 row-start-1 text-center">
            <span className="block text-[9px] text-muted"><I18nText text="Total esperado" /></span>
            <BlurredValue size="medium" tone={2} />
          </div>
        </div>
        <div className="mt-3"><PremiumUnlockBanner /></div>
      </section>
      <section className="min-w-0 rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3">
          <LockedSelector
            value={view}
            onChange={setView}
            label="Desglose de córners"
            options={[{ value: "match", label: "Córners totales" }, { value: "team", label: "Córners del equipo" }]}
          />
        </div>
        <LockedStatsTable teams={teams} rows={rows} firstColumn={view === "match" ? "Córners de partido" : "Córners del equipo"} />
        {view === "match" && (
          <p className="mt-2 flex items-center gap-1 text-[10px] leading-relaxed text-muted">
            <I18nText text="Media de liga" />: <IconLock className="h-3 w-3 text-brand" />
          </p>
        )}
      </section>
    </div>
  );
}

function CardsLockedPreview({ teams, locale }: { teams: Teams; locale: string }) {
  const [view, setView] = useState<"match" | "team">("match");
  const unlockText = "Desbloquea las estadísticas de tarjetas con Premium";
  const rows = view === "match"
    ? [2.5, 3.5, 4.5, 5.5, 6.5].map((line) => `Más de ${num(line, locale)}`)
    : [
        "Tarjetas recibidas/partido",
        "Tarjetas del rival/partido",
        ...(["Tarjetas recibidas", "Tarjetas del rival"] as const).flatMap((side) =>
          [0.5, 1.5, 2.5].map((line) => `Más de ${num(line, locale)} · ${side}`),
        ),
      ];
  return (
    <div className="min-w-0 space-y-3">
      <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <IconCard className="h-4 w-4 text-brand" />
          <h2 className="text-sm font-extrabold"><I18nText text="Estadísticas de Tarjetas" /></h2>
          <span className="text-xs text-muted"><I18nText text="¿Cuántas tarjetas habrá?" /></span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-card2 p-3 text-center">
          {[teams.home, teams.away].map((team, index) => (
            <div key={team.name} className={`${index === 0 ? "col-start-1" : "col-start-3"} row-start-1 flex min-w-0 flex-col items-center gap-1`}>
              <Shield src={team.logo} alt="" size={25} />
              <span className="w-full truncate text-xs font-semibold">{team.name}</span>
              <BlurredValue tone={index} />
              <span className="text-[10px] text-muted"><I18nText text="Tarjetas recibidas/partido" /></span>
            </div>
          ))}
          <div className="col-start-2 row-start-1 text-center text-xs text-muted">
            <I18nText text="Total esperado" />
            <div><BlurredValue size="medium" tone={1} /></div>
          </div>
        </div>
        <div className="mt-3"><PremiumUnlockBanner text={unlockText} /></div>
        <div className="mt-3">
          <div className="mb-2">
            <LockedSelector
              value={view}
              onChange={setView}
              label="Desglose de tarjetas"
              options={[{ value: "match", label: "Tarjetas totales" }, { value: "team", label: "Tarjetas del equipo" }]}
            />
          </div>
          <LockedStatsTable teams={teams} rows={rows} />
        </div>
      </section>
      <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-extrabold"><I18nText text="Jugadores con más tarjetas" /></h2>
          <span className="text-xs text-muted"><I18nText text="Amarillas y rojas en la temporada" /></span>
        </div>
        <PremiumUnlockBanner text={unlockText} />
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[teams.home, teams.away].map((team) => (
            <div key={team.name} className="rounded-xl bg-card2 p-3">
              <div className="mb-2 flex items-center gap-2"><Shield src={team.logo} alt="" size={20} /><span className="truncate text-xs font-bold">{team.name}</span></div>
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="mb-2 flex items-center justify-between gap-2 last:mb-0">
                  <BlurredValue size={index % 2 ? "medium" : "short"} tone={index} />
                  <span className="flex gap-1"><BlurredValue size="short" tone={1} /><BlurredValue size="short" tone={2} /></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ShotsLockedPreview({ teams, locale }: { teams: Teams; locale: string }) {
  const [scope, setScope] = useState<"match" | "team">("match");
  const unlockText = "Desbloquea el análisis de tiros con Premium";
  const metrics = scope === "match"
    ? [
        { title: "Tiros totales del partido", lines: [18.5, 20.5, 22.5, 24.5, 26.5, 28.5, 30.5, 32.5] },
        { title: "Tiros a puerta del partido", lines: [3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5] },
      ]
    : [
        { title: "Tiros totales por equipo", lines: [8.5, 10.5, 12.5, 14.5, 16.5, 18.5] },
        { title: "Tiros a puerta por equipo", lines: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5] },
      ];
  const tables = metrics.map((metric) => ({
    title: metric.title,
    rows: ["Promedio por partido", ...metric.lines.map((line) => `Más de ${num(line, locale)}`)],
  }));
  return (
    <div className="min-w-0 space-y-3">
      <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <IconTarget className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-extrabold"><I18nText text="Estadísticas de Tiros" /></h2>
          </div>
          <p className="mt-1 text-xs text-muted"><I18nText text="Proyección por equipo y total del partido" /></p>
        </div>
        <div className="space-y-2">
          {["Tiros totales", "Tiros a puerta"].map((title, metricIndex) => (
            <section key={title} className="rounded-xl bg-card2 p-3">
              <h3 className="mb-2 text-xs font-bold"><I18nText text={title} /></h3>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                {[teams.home, null, teams.away].map((team, index) => team ? (
                  <div key={team.name} className={`row-start-1 flex min-w-0 flex-col items-center gap-1 text-center ${index === 0 ? "col-start-1" : "col-start-3"}`}>
                    <Shield src={team.logo} alt="" size={24} />
                    <span className="w-full truncate text-[10px] font-semibold sm:text-xs">{team.name}</span>
                    <BlurredValue size="medium" tone={index + metricIndex} />
                    <span className="text-[9px] leading-tight text-muted">
                      <I18nText text={metricIndex === 0 ? "Tiros totales/partido" : "Tiros a puerta/partido"} />
                    </span>
                  </div>
                ) : (
                  <div key="total" className="col-start-2 row-start-1 text-center">
                    <span className="block text-[9px] text-muted"><I18nText text="Total esperado" /></span>
                    <BlurredValue size="medium" tone={metricIndex + 2} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-3"><PremiumUnlockBanner text={unlockText} /></div>
      </section>
      <section className="rounded-2xl border border-line bg-card p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h2 className="text-sm font-extrabold"><I18nText text="Tendencias de tiros" /></h2>
          <span className="text-xs text-muted"><I18nText text="Últimos partidos con estadísticas disponibles" /></span>
        </div>
        <PremiumUnlockBanner text={unlockText} />
        <div className="mt-3">
          <LockedSelector
            value={scope}
            onChange={setScope}
            label="Ámbito de las tendencias de tiros"
            options={[{ value: "match", label: "Partido" }, { value: "team", label: "Por equipo" }]}
          />
        </div>
        <div className="mt-3 space-y-4">
          {tables.map((table) => (
            <div key={table.title}>
              <h3 className="mb-2 text-xs font-bold"><I18nText text={table.title} /></h3>
              <LockedStatsTable teams={teams} rows={table.rows} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PremiumLockedPreview({ tab, home, away, locale }: {
  tab: Tab; home: Teams["home"]; away: Teams["away"]; locale: string;
}) {
  const teams = { home, away };
  if (tab === "tiros") return <ShotsLockedPreview teams={teams} locale={locale} />;
  if (tab === "corners") return <CornersLockedPreview teams={teams} locale={locale} />;
  if (tab === "tarjetas") return <CardsLockedPreview teams={teams} locale={locale} />;
  return null;
}
