"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Clock3, Plus, Search, Target, TrendingUp, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLang } from "./I18nProvider";
import { CalendarDatePicker } from "./DatePicker";
import type { BetStatus, TrackedBet } from "@/lib/bet-tracker";
import { Shield } from "./Shield";
import type { Fixture } from "@/lib/types";

type Props = {
  initialBets: TrackedBet[];
  fixturesForDate: Fixture[];
  fixturesDate: string;
  initialFixture: Fixture | null;
  fixtureLoadError: boolean;
  selectedFixtureError: boolean;
  timeZone: string;
};

type StatusFilter = "all" | "pending" | "settled";
type MarketChoice = "1X2" | "Goles" | "Tarjetas" | "Tiros" | "Córners" | "Otro";
type BetLegDraft = {
  fixtureId: string;
  eventDate: string;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  marketChoice: MarketChoice;
  customMarket: string;
  selection: string;
  odds: string;
};

const inputClass = "mt-1 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-fg outline-none transition focus:border-brand";
const labelClass = "block text-xs font-semibold text-muted";
const MARKET_CHOICES: MarketChoice[] = ["1X2", "Goles", "Tarjetas", "Tiros", "Córners", "Otro"];
const RESULT_SELECTIONS: Array<[string, string]> = [
  ["Gana el local", "Home win"],
  ["Empate", "Draw"],
  ["Gana el visitante", "Away win"],
];
const BOTH_TEAMS_TO_SCORE: Array<[string, string]> = [
  ["Ambos marcan: sí", "Both teams to score: yes"],
  ["Ambos marcan: no", "Both teams to score: no"],
];

type LineDirection = "over" | "under";
type ShotMetric = "shots" | "shotsOn";

function lineSettings(market: MarketChoice, shotMetric: ShotMetric) {
  if (market === "Goles") return { min: 0.5, max: 4.5, defaultValue: 1.5 };
  if (market === "Tarjetas") return { min: 1.5, max: 6.5, defaultValue: 3.5 };
  if (market === "Tiros") {
    return shotMetric === "shots"
      ? { min: 15.5, max: 29.5, defaultValue: 21.5 }
      : { min: 5.5, max: 10.5, defaultValue: 7.5 };
  }
  if (market === "Córners") return { min: 5.5, max: 11.5, defaultValue: 8.5 };
  return null;
}

function parseLineSelection(selection: string) {
  const match = selection.match(/(?:más\s+de|mas\s+de|menos\s+de|over|under)\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return null;
  return {
    line: Number(match[1].replace(",", ".")),
    direction: /(?:menos\s+de|under)/i.test(selection) ? "under" as const : "over" as const,
  };
}

function SelectionPicker({
  marketChoice,
  selection,
  english,
  translate,
  onChange,
}: {
  marketChoice: MarketChoice;
  selection: string;
  english: boolean;
  translate: (spanish: string, english: string) => string;
  onChange: (selection: string) => void;
}) {
  const parsedLine = parseLineSelection(selection);
  const [line, setLine] = useState(parsedLine?.line ?? lineSettings(marketChoice, "shots")?.defaultValue ?? 1.5);
  const [direction, setDirection] = useState<LineDirection>(parsedLine?.direction ?? "over");
  const [shotMetric, setShotMetric] = useState<ShotMetric>(
    /tiros a puerta|shots on target/i.test(selection) ? "shotsOn" : "shots",
  );
  const settings = lineSettings(marketChoice, shotMetric);

  useEffect(() => {
    const parsed = parseLineSelection(selection);
    const nextShotMetric: ShotMetric = /tiros a puerta|shots on target/i.test(selection) ? "shotsOn" : "shots";
    const nextSettings = lineSettings(marketChoice, nextShotMetric);
    setShotMetric(nextShotMetric);
    setLine(parsed && nextSettings && parsed.line >= nextSettings.min && parsed.line <= nextSettings.max
      ? parsed.line
      : nextSettings?.defaultValue ?? 1.5);
    setDirection(parsed?.direction ?? "over");
  }, [marketChoice, selection]);

  function selectionLabel(nextDirection = direction, nextLine = line, nextMetric = shotMetric) {
    const formattedLine = nextLine.toFixed(1).replace(".", english ? "." : ",");
    const marketLabel = marketChoice === "Goles" ? translate("goles", "goals")
      : marketChoice === "Tarjetas" ? translate("tarjetas", "cards")
        : marketChoice === "Tiros"
          ? nextMetric === "shotsOn" ? translate("tiros a puerta", "shots on target") : translate("tiros", "shots")
          : translate("córners", "corners");
    return `${translate(nextDirection === "over" ? "Más de" : "Menos de", nextDirection === "over" ? "Over" : "Under")} ${formattedLine} ${marketLabel}`;
  }

  function chooseLine(nextLine: number) {
    setLine(nextLine);
    onChange(selectionLabel(direction, nextLine));
  }

  return (
    <div className="space-y-3">
      {marketChoice === "1X2" && (
        <div className="grid grid-cols-3 gap-2">
          {RESULT_SELECTIONS.map(([spanish, englishSelection]) => {
            const value = translate(spanish, englishSelection);
            return (
              <button
                key={spanish}
                type="button"
                aria-pressed={selection === value}
                onClick={() => onChange(value)}
                className={`min-h-11 rounded-xl border px-2 py-2 text-center text-xs font-semibold transition ${selection === value ? "border-brand bg-brand/10 text-brand" : "border-line bg-bg text-muted hover:border-brand/50 hover:text-fg"}`}
              >
                {value}
              </button>
            );
          })}
        </div>
      )}
      {settings && (
        <>
          {marketChoice === "Tiros" && (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label={translate("Tipo de tiros", "Shot type")}>
              {([["shots", translate("Tiros totales", "Total shots")], ["shotsOn", translate("A puerta", "On target")]] as const).map(([metric, label]) => (
                <button
                  key={metric}
                  type="button"
                  aria-pressed={shotMetric === metric}
                  onClick={() => {
                    const nextMetric = metric as ShotMetric;
                    const nextSettings = lineSettings(marketChoice, nextMetric);
                    if (!nextSettings) return;
                    setShotMetric(nextMetric);
                    setLine(nextSettings.defaultValue);
                    onChange(selectionLabel(direction, nextSettings.defaultValue, nextMetric));
                  }}
                  className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold transition ${shotMetric === metric ? "border-brand bg-brand/10 text-brand" : "border-line bg-bg text-muted hover:border-brand/50"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-2xl bg-bg p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">{translate("Línea", "Line")}</span>
              <output className="rounded-lg bg-brand/10 px-3 py-1 text-lg font-black text-brand">{line.toFixed(1).replace(".", english ? "." : ",")}</output>
            </div>
            <label className="mt-2 block">
              <span className="sr-only">{translate("Arrastra para elegir la línea", "Drag to choose the line")}</span>
              <input
                type="range"
                min={settings.min}
                max={settings.max}
                step="1"
                value={line}
                onChange={(event) => chooseLine(Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-statOrange"
                aria-label={translate("Línea de la selección", "Selection line")}
              />
            </label>
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>{settings.min.toFixed(1)}</span>
              <span>{settings.max.toFixed(1)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={translate("Más o menos", "Over or under")}>
              {(["over", "under"] as const).map((nextDirection) => (
                <button
                  key={nextDirection}
                  type="button"
                  aria-pressed={direction === nextDirection}
                  onClick={() => {
                    setDirection(nextDirection);
                    onChange(selectionLabel(nextDirection));
                  }}
                  className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-bold transition ${direction === nextDirection ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:border-brand/50"}`}
                >
                  {translate(nextDirection === "over" ? "Más de" : "Menos de", nextDirection === "over" ? "Over" : "Under")}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {marketChoice === "Goles" && (
        <div className="grid grid-cols-2 gap-2">
          {BOTH_TEAMS_TO_SCORE.map(([spanish, englishSelection]) => {
            const value = translate(spanish, englishSelection);
            return (
              <button
                key={spanish}
                type="button"
                aria-pressed={selection === value}
                onClick={() => onChange(value)}
                className={`min-h-10 rounded-xl border px-2 py-2 text-xs font-semibold transition ${selection === value ? "border-brand bg-brand/10 text-brand" : "border-line bg-bg text-muted hover:border-brand/50 hover:text-fg"}`}
              >
                {value}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function profitFor(bet: TrackedBet) {
  if (bet.status === "won") return bet.stake * (bet.odds - 1);
  if (bet.status === "lost") return -bet.stake;
  return 0;
}

function marketName(choice: MarketChoice, english: boolean, customMarket: string) {
  if (choice === "Otro") return customMarket.trim();
  if (choice === "1X2") return choice;
  const englishLabels: Record<Exclude<MarketChoice, "1X2" | "Otro">, string> = {
    "Goles": "Goals",
    "Tarjetas": "Cards",
    "Tiros": "Shots",
    "Córners": "Corners",
  };
  return english ? englishLabels[choice] : choice;
}

function marketLabel(choice: MarketChoice, english: boolean) {
  if (choice === "Otro") return english ? "Other" : choice;
  return marketName(choice, english, "");
}

function BetLegEditor({
  leg,
  index,
  fixtures,
  english,
  dateLabel,
  fixtureTime,
  onChange,
  onSelectFixture,
  onRemove,
  canRemove,
  translate,
}: {
  leg: BetLegDraft;
  index: number;
  fixtures: Fixture[];
  english: boolean;
  dateLabel: (date: string) => string;
  fixtureTime: (fixture: Fixture) => string;
  onChange: (index: number, patch: Partial<BetLegDraft>) => void;
  onSelectFixture: (index: number, fixtureId: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  translate: (spanish: string, english: string) => string;
}) {
  const selectedFixture = fixtures.find((fixture) => String(fixture.id) === leg.fixtureId);

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-bg p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{translate("Selección", "Selection")} {index + 1}</h3>
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)} className="text-xs font-semibold text-loss hover:underline">
            {translate("Quitar", "Remove")}
          </button>
        )}
      </div>
      <label className={labelClass}>{translate("Partido", "Match")}
        <select value={leg.fixtureId} onChange={(event) => onSelectFixture(index, event.target.value)} className={inputClass}>
          <option value="">{translate("Introducir partido manualmente", "Enter match manually")}</option>
          {fixtures.map((fixture) => (
            <option key={fixture.id} value={fixture.id}>{fixture.home.name} vs. {fixture.away.name}</option>
          ))}
        </select>
      </label>
      {selectedFixture ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-card2 p-2.5">
          <Shield src={selectedFixture.home.logo} fallbackSrc={selectedFixture.home.logoFallback} alt="" size={30} />
          <div className="min-w-0 text-center">
            <p className="truncate text-xs font-bold">{selectedFixture.home.name} vs. {selectedFixture.away.name}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted">{selectedFixture.leagueName} · {dateLabel(leg.eventDate)} · {fixtureTime(selectedFixture)}</p>
          </div>
          <Shield src={selectedFixture.away.logo} fallbackSrc={selectedFixture.away.logoFallback} alt="" size={30} />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={labelClass}>{translate("Fecha", "Date")}
            <input type="date" value={leg.eventDate} onChange={(event) => onChange(index, { eventDate: event.target.value })} className={inputClass} required />
          </label>
          <label className={labelClass}>{translate("Liga (opcional)", "League (optional)")}
            <input value={leg.leagueName} onChange={(event) => onChange(index, { leagueName: event.target.value })} maxLength={100} className={inputClass} />
          </label>
          <label className={labelClass}>{translate("Equipo local", "Home team")}
            <input value={leg.homeTeam} onChange={(event) => onChange(index, { homeTeam: event.target.value })} maxLength={100} className={inputClass} required />
          </label>
          <label className={labelClass}>{translate("Equipo visitante", "Away team")}
            <input value={leg.awayTeam} onChange={(event) => onChange(index, { awayTeam: event.target.value })} maxLength={100} className={inputClass} required />
          </label>
        </div>
      )}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted">{translate("Mercado", "Market")}</p>
        <div className="flex flex-wrap gap-1.5">
          {MARKET_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={leg.marketChoice === choice}
              onClick={() => onChange(index, { marketChoice: choice, customMarket: "", selection: "" })}
              className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold ${leg.marketChoice === choice ? "border-brand bg-brand/10 text-brand" : "border-line text-muted"}`}
            >
              {marketLabel(choice, english)}
            </button>
          ))}
        </div>
      </div>
      {leg.marketChoice === "Otro" && (
        <label className={labelClass}>{translate("Escribe el mercado", "Enter the market")}
          <input value={leg.customMarket} onChange={(event) => onChange(index, { customMarket: event.target.value })} maxLength={80} className={inputClass} required />
        </label>
      )}
      <SelectionPicker
        marketChoice={leg.marketChoice}
        selection={leg.selection}
        english={english}
        translate={translate}
        onChange={(selection) => onChange(index, { selection })}
      />
      <label className={labelClass}>{translate("Selección", "Pick")}
        <input value={leg.selection} onChange={(event) => onChange(index, { selection: event.target.value })} maxLength={120} className={inputClass} placeholder={translate("Ajusta el deslizador o escribe una selección", "Move the slider or type a selection")} required />
      </label>
      <label className={labelClass}>{translate("Cuota de esta selección", "Odds for this selection")}
        <input type="number" min="1.001" max="1000" step="0.001" value={leg.odds} onChange={(event) => onChange(index, { odds: event.target.value })} className={inputClass} required />
      </label>
    </section>
  );
}

export function BetTracker({
  initialBets,
  fixturesForDate,
  fixturesDate,
  initialFixture,
  fixtureLoadError,
  selectedFixtureError,
  timeZone,
}: Props) {
  const router = useRouter();
  const en = useLang() === "en";
  const tr = (es: string, english: string) => en ? english : es;
  const locale = en ? "en-GB" : "es-ES";
  const money = (value: number) => new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
  const percent = (value: number | null) => value === null
    ? "—"
    : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value);
  const dateLabel = (value: string) => new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00.000Z`));
  const fixtureDate = (fixture: Fixture) => new Intl.DateTimeFormat("en-CA", { timeZone })
    .format(new Date(fixture.timestamp * 1000));
  const fixtureTime = (fixture: Fixture) => new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(fixture.timestamp * 1000));
  const createDraftLeg = (fixture: Fixture | null): BetLegDraft => ({
    fixtureId: fixture ? String(fixture.id) : "",
    eventDate: fixture ? fixtureDate(fixture) : fixturesDate,
    leagueName: fixture?.leagueName ?? "",
    homeTeam: fixture?.home.name ?? "",
    awayTeam: fixture?.away.name ?? "",
    marketChoice: "1X2",
    customMarket: "",
    selection: "",
    odds: "2.00",
  });
  const [bets, setBets] = useState(initialBets);
  const [selectedFixture, setSelectedFixture] = useState(initialFixture);
  const [showForm, setShowForm] = useState(initialFixture !== null);
  const [showFixturePicker, setShowFixturePicker] = useState(initialFixture === null);
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [showAllFixtures, setShowAllFixtures] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [betType, setBetType] = useState<"single" | "accumulator">("single");
  const [singleStep, setSingleStep] = useState<"selection" | "ticket">("selection");
  const [manualDate, setManualDate] = useState(fixturesDate);
  const [manualLeague, setManualLeague] = useState("");
  const [manualHome, setManualHome] = useState("");
  const [manualAway, setManualAway] = useState("");
  const [legs, setLegs] = useState<BetLegDraft[]>([]);
  const [finalOddsOverride, setFinalOddsOverride] = useState("");
  const [marketChoice, setMarketChoice] = useState<MarketChoice>("1X2");
  const [customMarket, setCustomMarket] = useState("");
  const [selection, setSelection] = useState("");
  const [oddsInput, setOddsInput] = useState("2.00");
  const [stakeInput, setStakeInput] = useState("10");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settlementError, setSettlementError] = useState("");

  const won = bets.filter((bet) => bet.status === "won");
  const lost = bets.filter((bet) => bet.status === "lost");
  const pending = bets.filter((bet) => bet.status === "pending");
  const settledBets = [...won, ...lost];
  const settledStake = settledBets.reduce((total, bet) => total + bet.stake, 0);
  const netProfit = settledBets.reduce((total, bet) => total + profitFor(bet), 0);
  const roi = settledStake > 0 ? netProfit / settledStake : null;
  const winRate = won.length + lost.length > 0 ? won.length / (won.length + lost.length) : null;
  const pendingStake = pending.reduce((total, bet) => total + bet.stake, 0);
  const marketSummary = Array.from(bets.reduce((summary, bet) => {
    if (bet.status !== "won" && bet.status !== "lost") return summary;
    const row = summary.get(bet.market) ?? { count: 0, stake: 0, profit: 0 };
    row.count += 1;
    row.stake += bet.stake;
    row.profit += profitFor(bet);
    summary.set(bet.market, row);
    return summary;
  }, new Map<string, { count: number; stake: number; profit: number }>()).entries())
    .map(([market, values]) => ({ market, ...values, roi: values.stake > 0 ? values.profit / values.stake : 0 }))
    .sort((a, b) => b.profit - a.profit);
  const visibleBets = bets.filter((bet) =>
    filter === "all" || (filter === "pending" ? bet.status === "pending" : bet.status !== "pending"),
  );
  const filteredFixtures = fixturesForDate.filter((fixture) =>
    `${fixture.home.name} ${fixture.away.name} ${fixture.leagueName}`.toLocaleLowerCase(locale)
      .includes(fixtureSearch.trim().toLocaleLowerCase(locale)),
  );
  const calculatedComboOdds = legs.length >= 2 && legs.every((leg) =>
    Number.isFinite(Number(leg.odds)) && Number(leg.odds) > 1 && Number(leg.odds) <= 1000,
  )
    ? legs.reduce((total, leg) => total * Number(leg.odds), 1)
    : null;
  const usableCalculatedComboOdds = calculatedComboOdds !== null && Number.isFinite(calculatedComboOdds) && calculatedComboOdds <= 1000000000
    ? calculatedComboOdds
    : null;
  const finalComboOdds = finalOddsOverride || (usableCalculatedComboOdds ? usableCalculatedComboOdds.toFixed(2) : "");
  const visibleFixtures = showAllFixtures ? filteredFixtures : filteredFixtures.slice(0, 8);
  const actualMarket = marketName(marketChoice, en, customMarket);
  const numericOdds = Number(oddsInput);
  const numericStake = Number(stakeInput);
  const activeOdds = betType === "accumulator" ? Number(finalComboOdds) : numericOdds;
  const potentialReturn = Number.isFinite(activeOdds) && activeOdds > 1 && Number.isFinite(numericStake) && numericStake > 0
    ? activeOdds * numericStake
    : null;
  const potentialProfit = potentialReturn !== null ? potentialReturn - numericStake : null;

  function chooseFixture(fixture: Fixture) {
    setSelectedFixture(fixture);
    setSingleStep("selection");
    setShowFixturePicker(false);
    if (betType === "accumulator") {
      setLegs((current) => current.map((leg, index) => index === 0 ? createDraftLeg(fixture) : leg));
    }
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function useManualEntry() {
    setSelectedFixture(null);
    setShowFixturePicker(false);
    setSingleStep("selection");
    setManualDate(fixturesDate);
    setManualLeague("");
    setManualHome("");
    setManualAway("");
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function showFixtureOptions() {
    setShowFixturePicker(true);
    setError("");
    setNotice("");
  }

  function changeBetType(nextType: "single" | "accumulator") {
    setBetType(nextType);
    setSingleStep("selection");
    setError("");
    setNotice("");
    if (nextType === "accumulator" && legs.length === 0) {
      setLegs([createDraftLeg(selectedFixture), createDraftLeg(selectedFixture)]);
    }
    if (nextType === "single") setFinalOddsOverride("");
  }

  function startBet(nextType: "single" | "accumulator") {
    setBetType(nextType);
    setSingleStep("selection");
    setShowForm(true);
    setShowFixturePicker(!selectedFixture);
    setError("");
    setNotice("");
    setMarketChoice("1X2");
    setCustomMarket("");
    setSelection("");
    setOddsInput("2.00");
    setStakeInput("10");
    setFinalOddsOverride("");
    if (!selectedFixture) {
      setManualDate(fixturesDate);
      setManualLeague("");
      setManualHome("");
      setManualAway("");
    }
    if (nextType === "accumulator" && legs.length === 0) {
      setLegs([createDraftLeg(selectedFixture), createDraftLeg(selectedFixture)]);
    }
  }

  function continueSingleBet() {
    if (!selectedFixture && (!manualDate || !manualHome.trim() || !manualAway.trim())) {
      setError(tr("Completa la fecha y los dos equipos para continuar.", "Enter the date and both teams to continue."));
      return;
    }
    if (!actualMarket.trim() || !selection.trim()) {
      setError(tr("Elige un mercado y una selección para continuar.", "Choose a market and selection to continue."));
      return;
    }
    setError("");
    setSingleStep("ticket");
  }

  function updateLeg(index: number, patch: Partial<BetLegDraft>) {
    setLegs((current) => current.map((leg, position) => position === index ? { ...leg, ...patch } : leg));
    setFinalOddsOverride("");
  }

  function chooseLegFixture(index: number, fixtureId: string) {
    const fixture = fixturesForDate.find((item) => String(item.id) === fixtureId);
    if (!fixture) {
      updateLeg(index, { fixtureId: "", eventDate: fixturesDate, leagueName: "", homeTeam: "", awayTeam: "" });
      return;
    }
    updateLeg(index, {
      fixtureId,
      eventDate: fixtureDate(fixture),
      leagueName: fixture.leagueName,
      homeTeam: fixture.home.name,
      awayTeam: fixture.away.name,
    });
  }

  async function submitBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const betDetails = betType === "accumulator"
        ? {
          betType,
          legs: legs.map((leg) => ({
            eventDate: leg.eventDate,
            leagueName: leg.leagueName,
            homeTeam: leg.homeTeam,
            awayTeam: leg.awayTeam,
            market: marketName(leg.marketChoice, en, leg.customMarket),
            selection: leg.selection,
            odds: Number(leg.odds),
          })),
          odds: Number(finalComboOdds),
        }
        : {
          betType,
          eventDate: selectedFixture ? fixtureDate(selectedFixture) : manualDate,
          leagueName: selectedFixture ? selectedFixture.leagueName : manualLeague,
          homeTeam: selectedFixture ? selectedFixture.home.name : manualHome,
          awayTeam: selectedFixture ? selectedFixture.away.name : manualAway,
          market: actualMarket,
          selection,
          odds: numericOdds,
        };
      const response = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...betDetails,
          stake: numericStake,
        }),
      });
      const result = await response.json() as { bet?: TrackedBet; error?: string };
      const savedBet = result.bet;
      if (!response.ok || !savedBet) throw new Error(result.error || tr("No se pudo guardar la apuesta.", "Could not save the bet."));
      setBets((current) => [savedBet, ...current].sort((a, b) =>
        b.eventDate.localeCompare(a.eventDate) || b.createdAt.localeCompare(a.createdAt),
      ));
      setShowForm(false);
      setSelectedFixture(null);
      setBetType("single");
      setLegs([]);
      setFinalOddsOverride("");
      setMarketChoice("1X2");
      setCustomMarket("");
      setSelection("");
      setSingleStep("selection");
      setManualDate(fixturesDate);
      setManualLeague("");
      setManualHome("");
      setManualAway("");
      setOddsInput("2.00");
      setStakeInput("10");
      setNotice(tr("Apuesta guardada.", "Bet saved."));
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : tr("Error al guardar la apuesta.", "Could not save the bet."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteBet(id: string) {
    if (busyId || !window.confirm(tr("¿Borrar esta apuesta del registro?", "Delete this bet from your record?"))) return;
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/bets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok || !result.deleted) throw new Error(result.error || tr("No se pudo borrar la apuesta.", "Could not delete the bet."));
      setBets((current) => current.filter((bet) => bet.id !== id));
      setNotice(tr("Apuesta borrada.", "Bet deleted."));
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : tr("Error al borrar la apuesta.", "Could not delete the bet."));
    } finally {
      setBusyId(null);
    }
  }

  const statusLabel = (status: BetStatus) => ({
    pending: tr("Pendiente", "Pending"),
    won: tr("Ganada", "Won"),
    lost: tr("Perdida", "Lost"),
    void: tr("Anulada", "Void"),
  })[status];

  useEffect(() => {
    if (pending.length === 0) return;
    let active = true;
    async function checkSettlements() {
      try {
        const response = await fetch("/api/bets/settle", { method: "POST", cache: "no-store" });
        const result = await response.json() as { bets?: TrackedBet[]; warning?: boolean; error?: string };
        if (!response.ok) throw new Error(result.error || tr("No se pudieron comprobar los resultados.", "Could not check match results."));
        if (!active) return;
        const settledBets = Array.isArray(result.bets) ? result.bets : [];
        if (settledBets.length > 0) {
          const settledById = new Map(settledBets.map((bet) => [bet.id, bet]));
          setBets((current) => current.map((bet) => settledById.get(bet.id) ?? bet));
          setNotice(tr("Resultados actualizados automáticamente.", "Results updated automatically."));
        }
        setSettlementError(result.warning
          ? tr("No se pudieron comprobar algunos partidos; se volverán a revisar automáticamente.", "Some matches could not be checked; they will be retried automatically.")
          : "");
      } catch (cause) {
        if (active) setSettlementError(cause instanceof Error && cause.message
          ? cause.message
          : tr("No se pudieron comprobar los resultados.", "Could not check match results."));
      }
    }

    void checkSettlements();
    const intervalId = window.setInterval(() => void checkSettlements(), 3 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [en, pending.length]);

  return (
    <div className="space-y-5">
      {bets.length === 0 ? (
        <section className="relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/10 via-card to-card p-5 sm:p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start gap-4">
            <span className="rounded-2xl bg-brand/15 p-3 text-brand">
              <Wallet aria-hidden="true" className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand">{tr("Tu espacio personal", "Your personal tracker")}</p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">{tr("Empieza a controlar tus apuestas", "Start tracking your bets")}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                {tr("Elige un partido de la lista o crea una apuesta manual. Verás aquí el balance y los resultados cuando registres la primera.", "Choose a match from the list or enter a bet manually. Your balance and results will appear here after your first entry.")}
              </p>
            </div>
          </div>
        </section>
      ) : (
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="card relative col-span-2 overflow-hidden border-brand/30 bg-gradient-to-br from-brand/15 via-card to-card p-4 sm:p-5">
          <div className="absolute -right-7 -top-8 h-28 w-28 rounded-full bg-brand/10 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tr("Balance neto", "Net profit")}</p>
              <p className={`mt-2 text-2xl font-black tabular-nums sm:text-3xl ${netProfit >= 0 ? "text-statGreen" : "text-statRed"}`}>{money(netProfit)}</p>
              <p className="mt-1 text-xs text-muted">{settledBets.length} {tr("apuestas resueltas", "settled bets")}</p>
            </div>
            <span className="rounded-2xl bg-brand/15 p-3 text-brand">
              <Wallet aria-hidden="true" className="h-5 w-5" />
            </span>
          </div>
        </div>
        {[
          { label: "ROI", value: percent(roi), detail: tr("Rentabilidad", "Return"), icon: TrendingUp, positive: (roi ?? 0) >= 0 },
          { label: tr("Acierto", "Win rate"), value: percent(winRate), detail: tr(`${won.length} ganadas`, `${won.length} won`), icon: Target, positive: true },
          { label: tr("Pendientes", "Pending"), value: String(pending.length), detail: money(pendingStake), icon: Clock3, positive: true },
        ].map(({ label, value, detail, icon: Icon, positive }) => (
          <div key={label} className="card min-w-0 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-muted">{label}</p>
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
            </div>
            <p className={`mt-2 truncate text-xl font-black tabular-nums sm:text-2xl ${positive ? "text-fg" : "text-statRed"}`}>{value}</p>
            <p className="mt-1 truncate text-[11px] text-muted">{detail}</p>
          </div>
        ))}
      </section>
      )}

      {fixtureLoadError && (
        <p role="status" className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm text-warn">
          {tr("No se pudieron cargar los partidos para esa fecha. Puedes registrar el encuentro manualmente.", "Matches for that date could not be loaded. You can enter the match manually.")}
        </p>
      )}
      {selectedFixtureError && (
        <p role="status" className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm text-warn">
          {tr("No se pudo precargar ese partido. Puedes elegir otro o introducirlo manualmente.", "That match could not be prefilled. Choose another or enter it manually.")}
        </p>
      )}
      {(!showForm || showFixturePicker) && (
      <section className="card space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand">{tr("Paso 1", "Step 1")}</p>
              <h2 className="mt-1 text-lg font-black">{tr("Elige el partido", "Choose the match")}</h2>
              <p className="mt-1 text-xs text-muted">{tr("Puedes elegir cualquier fecha; también aparecen los partidos terminados.", "Choose any date; finished matches are included too.")}</p>
            </div>
            <div className="grid w-full gap-2">
            <CalendarDatePicker date={fixturesDate} english={en} onSelect={(date) => router.push(`/mis-apuestas?date=${date}`)} />
            <button type="button" onClick={useManualEntry} className="min-h-11 w-full whitespace-nowrap rounded-xl border border-line px-4 text-xs font-semibold text-muted transition hover:border-brand hover:text-brand sm:w-auto sm:justify-self-start">
              {tr("Introducir manualmente", "Enter manually")}
            </button>
            </div>
          </div>
          {fixturesForDate.length > 0 && (
            <label className="block">
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  <Search aria-hidden="true" className="h-4 w-4" />
                </span>
              <input
                type="search"
                value={fixtureSearch}
                onChange={(event) => setFixtureSearch(event.target.value)}
                placeholder={tr("Buscar equipo o liga", "Search team or league")}
                aria-label={tr("Buscar partido", "Search matches")}
                className="min-h-11 w-full rounded-xl border border-line bg-bg pl-10 pr-4 text-sm outline-none focus:border-brand"
              />
              </span>
            </label>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleFixtures.map((fixture) => (
              <button
                key={fixture.id}
                type="button"
                onClick={() => chooseFixture(fixture)}
                className={`flex min-w-0 items-center gap-2 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/5 ${selectedFixture?.id === fixture.id ? "border-brand bg-brand/10" : "border-line bg-bg"}`}
              >
                <Shield src={fixture.home.logo} fallbackSrc={fixture.home.logoFallback} alt="" size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{fixture.home.name} <span className="font-normal text-muted">vs.</span> {fixture.away.name}</p>
                  <p className="mt-1 truncate text-[10px] text-muted">{fixture.leagueName}</p>
                </div>
                <Shield src={fixture.away.logo} fallbackSrc={fixture.away.logoFallback} alt="" size={30} />
                <span className="min-w-12 rounded-lg bg-card px-2 py-1 text-center text-xs font-black tabular-nums text-brand">
                  {fixture.goalsHome !== null && fixture.goalsAway !== null
                    ? `${fixture.goalsHome} - ${fixture.goalsAway}`
                    : fixtureTime(fixture)}
                </span>
              </button>
            ))}
            {filteredFixtures.length === 0 && (
              <p className="rounded-xl bg-bg px-3 py-4 text-center text-sm text-muted sm:col-span-2">
                {tr("No hay partidos para esta fecha o búsqueda. Puedes introducirlo manualmente.", "No matches for this date or search. You can enter the match manually.")}
              </p>
            )}
          </div>
          {filteredFixtures.length > 8 && (
            <button type="button" onClick={() => setShowAllFixtures((show) => !show)} className="w-full rounded-xl border border-line py-2.5 text-xs font-semibold text-muted transition hover:border-brand hover:text-brand">
              {showAllFixtures ? tr("Mostrar menos", "Show less") : tr(`Ver los ${filteredFixtures.length} partidos`, `Show all ${filteredFixtures.length} matches`)}
            </button>
          )}
      </section>
      )}

      {!showForm && (
        <section className="space-y-3">
          <div>
            <h2 className="font-bold">{tr("¿Qué quieres registrar?", "What would you like to add?")}</h2>
            <p className="mt-1 text-xs text-muted">
              {tr("Elige el tipo de ticket. El balance se calcula con las apuestas resueltas.", "Choose a ticket type. Balance uses settled bets only.")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => startBet("single")}
              className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-brand/40 bg-gradient-to-br from-brand/15 to-card p-4 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg hover:shadow-brand/10"
            >
              <span className="rounded-xl bg-brand p-2 text-black"><Plus aria-hidden="true" className="h-4 w-4" /></span>
              <span>
                <span className="block text-sm font-bold">{tr("Apuesta simple", "Single bet")}</span>
                <span className="mt-1 block text-[11px] text-muted">{tr("Un partido · una selección", "One match · one pick")}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => startBet("accumulator")}
              className="flex min-h-28 flex-col items-start justify-between rounded-2xl border border-line bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg hover:shadow-brand/10"
            >
              <span className="rounded-xl bg-card2 p-2 text-brand"><Target aria-hidden="true" className="h-4 w-4" /></span>
              <span>
                <span className="block text-sm font-bold">{tr("Combinada", "Accumulator")}</span>
                <span className="mt-1 block text-[11px] text-muted">{tr("Une varias selecciones", "Combine multiple picks")}</span>
              </span>
            </button>
          </div>
        </section>
      )}

      {error && <p role="alert" className="rounded-xl border border-loss/40 bg-loss/10 px-3 py-2.5 text-sm text-loss">{error}</p>}
      {settlementError && <p role="alert" className="rounded-xl border border-loss/40 bg-loss/10 px-3 py-2.5 text-sm text-loss">{settlementError}</p>}
      {notice && <p role="status" className="rounded-xl border border-statGreen/40 bg-statGreen/10 px-3 py-2.5 text-sm text-statGreen">{notice}</p>}

      {showForm && (
        <form key={`${betType}-${selectedFixture?.id ?? "manual"}`} onSubmit={submitBet} className="card space-y-5 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand">{tr("Nueva apuesta", "New bet")}</p>
              <h2 className="mt-1 text-lg font-black">{tr("Completa tu registro", "Complete your record")}</h2>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:text-fg">
              {tr("Cerrar", "Close")}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {([
              ["single", tr("Apuesta simple", "Single bet"), tr("Una selección", "One selection")],
              ["accumulator", tr("Combinada", "Accumulator"), tr("Varias selecciones", "Multiple selections")],
            ] as const).map(([type, label, description]) => (
              <button
                key={type}
                type="button"
                aria-pressed={betType === type}
                onClick={() => changeBetType(type)}
                className={`rounded-2xl border p-3 text-left transition ${betType === type ? "border-brand bg-brand/10" : "border-line bg-bg hover:border-brand/50"}`}
              >
                <span className={`block text-sm font-bold ${betType === type ? "text-brand" : "text-fg"}`}>{label}</span>
                <span className="mt-1 block text-[11px] text-muted">{description}</span>
              </button>
            ))}
          </div>

          {betType === "single" && (
            <div aria-label={tr("Progreso de la apuesta", "Bet progress")} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["selection", tr("1 · Selección", "1 · Selection")],
                  ["ticket", tr("2 · Cuota e importe", "2 · Odds and stake")],
                ] as const).map(([step, label]) => (
                  <div
                    key={step}
                    aria-current={singleStep === step ? "step" : undefined}
                    className={`rounded-xl px-3 py-2 text-xs font-bold ${singleStep === step ? "bg-brand/15 text-brand" : "bg-bg text-muted"}`}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-bg">
                <div className={`h-full rounded-full bg-brand transition-all ${singleStep === "ticket" ? "w-full" : "w-1/2"}`} />
              </div>
            </div>
          )}

          {betType === "single" && singleStep === "ticket" && (
            <div className="rounded-2xl border border-brand/25 bg-brand/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand">{tr("Tu selección", "Your selection")}</p>
                  <p className="mt-1 truncate text-sm font-bold">
                    {selectedFixture
                      ? `${selectedFixture.home.name} vs. ${selectedFixture.away.name}`
                      : `${manualHome} vs. ${manualAway}`}
                  </p>
                  <p className="mt-1 text-xs text-muted">{actualMarket} · {selection}</p>
                </div>
                <button type="button" onClick={() => setSingleStep("selection")} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-brand hover:border-brand">
                  {tr("Editar", "Edit")}
                </button>
              </div>
            </div>
          )}

          {betType === "single" && singleStep === "selection" && (selectedFixture ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <Shield src={selectedFixture.home.logo} fallbackSrc={selectedFixture.home.logoFallback} alt="" size={38} />
                <div className="min-w-0 text-center">
                  <p className="max-w-48 truncate text-sm font-bold">{selectedFixture.home.name} <span className="text-muted">vs.</span> {selectedFixture.away.name}</p>
                  <p className="mt-1 truncate text-xs text-muted">{selectedFixture.leagueName} · {dateLabel(fixtureDate(selectedFixture))} · {fixtureTime(selectedFixture)}</p>
                </div>
                <Shield src={selectedFixture.away.logo} fallbackSrc={selectedFixture.away.logoFallback} alt="" size={38} />
              </div>
              <button type="button" onClick={showFixtureOptions} className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-brand transition hover:border-brand">
                {tr("Cambiar partido", "Change match")}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {fixturesForDate.length > 0 && (
                <button type="button" aria-expanded={showFixturePicker} onClick={showFixtureOptions} className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-brand transition hover:border-brand">
                  {tr("Elegir un partido de la lista", "Choose a match from the list")}
                </button>
              )}
              <div className="grid gap-3 rounded-2xl border border-line bg-bg/60 p-3 sm:grid-cols-2">
                <label className={labelClass}>{tr("Fecha del partido", "Match date")}
                  <input className={inputClass} name="eventDate" type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} required />
                </label>
                <label className={labelClass}>{tr("Liga (opcional)", "League (optional)")}
                  <input className={inputClass} name="leagueName" maxLength={100} value={manualLeague} onChange={(event) => setManualLeague(event.target.value)} placeholder={tr("LaLiga", "LaLiga")} />
                </label>
                <label className={labelClass}>{tr("Equipo local", "Home team")}
                  <input className={inputClass} name="homeTeam" maxLength={100} value={manualHome} onChange={(event) => setManualHome(event.target.value)} required />
                </label>
                <label className={labelClass}>{tr("Equipo visitante", "Away team")}
                  <input className={inputClass} name="awayTeam" maxLength={100} value={manualAway} onChange={(event) => setManualAway(event.target.value)} required />
                </label>
              </div>
            </div>
          ))}

          {betType === "accumulator" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold">{tr("Selecciones de la combinada", "Accumulator selections")}</h3>
                  <p className="mt-1 text-xs text-muted">{tr("Añade al menos dos selecciones. Puedes combinar distintos partidos.", "Add at least two picks. You can combine different matches.")}</p>
                </div>
                <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{legs.length}</span>
              </div>
              {legs.map((leg, index) => (
                <BetLegEditor
                  key={index}
                  leg={leg}
                  index={index}
                  fixtures={fixturesForDate}
                  english={en}
                  dateLabel={dateLabel}
                  fixtureTime={fixtureTime}
                  onChange={updateLeg}
                  onSelectFixture={chooseLegFixture}
                  onRemove={(removeIndex) => {
                    setLegs((current) => current.filter((_, position) => position !== removeIndex));
                    setFinalOddsOverride("");
                  }}
                  canRemove={legs.length > 2}
                  translate={tr}
                />
              ))}
              <button
                type="button"
                onClick={() => setLegs((current) => [...current, createDraftLeg(selectedFixture)])}
                disabled={legs.length >= 20}
                className="w-full rounded-xl border border-dashed border-brand/50 py-3 text-sm font-bold text-brand transition hover:bg-brand/5 disabled:opacity-50"
              >
                + {tr("Añadir otra selección", "Add another selection")}
              </button>
            </section>
          )}

          {betType === "single" && singleStep === "selection" && (
            <>
          <section>
            <p className="mb-2 text-xs font-semibold text-muted">{tr("1 · Elige un mercado", "1 · Choose a market")}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MARKET_CHOICES.map((choice) => {
                const label = choice === "Goles" ? tr("Goles", "Goals")
                  : choice === "Tarjetas" ? tr("Tarjetas", "Cards")
                    : choice === "Tiros" ? tr("Tiros", "Shots")
                      : choice === "Córners" ? tr("Córners", "Corners")
                        : choice === "Otro" ? tr("Otro", "Other")
                          : choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={marketChoice === choice}
                    onClick={() => {
                      setMarketChoice(choice);
                      setSelection("");
                      setCustomMarket("");
                    }}
                    className={`min-h-14 rounded-2xl border px-3 py-2 text-left transition ${marketChoice === choice ? "border-brand bg-brand/10 text-brand shadow-sm shadow-brand/10" : "border-line bg-bg text-muted hover:border-brand/50"}`}
                  >
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-1 block text-[10px] font-medium opacity-75">
                      {choice === "1X2" ? tr("Local · empate · visitante", "Home · draw · away")
                        : choice === "Goles" ? tr("Total y ambos marcan", "Total and both teams to score")
                          : choice === "Tarjetas" ? tr("Total del partido", "Match total")
                            : choice === "Tiros" ? tr("Tiros y a puerta", "Shots and on target")
                              : choice === "Córners" ? tr("Total del partido", "Match total")
                                : tr("Mercado personalizado", "Custom market")}
                    </span>
                  </button>
                );
              })}
            </div>
            {marketChoice === "Otro" && (
              <label className={`${labelClass} mt-3`}>{tr("Escribe el mercado", "Enter the market")}
                <input className={inputClass} value={customMarket} onChange={(event) => setCustomMarket(event.target.value)} maxLength={80} placeholder={tr("Ej.: jugador, hándicap...", "E.g. player, handicap...")} required />
              </label>
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold text-muted">{tr("2 · ¿Qué has elegido?", "2 · What did you pick?")}</p>
            <SelectionPicker
              marketChoice={marketChoice}
              selection={selection}
              english={en}
              translate={tr}
              onChange={setSelection}
            />
            <label className={labelClass}>{tr("Selección", "Selection")}
              <input className={inputClass} value={selection} onChange={(event) => setSelection(event.target.value)} maxLength={120} placeholder={tr("Ajusta el deslizador o escribe una selección", "Move the slider or type a selection")} required />
            </label>
          </section>
            </>
          )}

          {betType === "single" ? (
            singleStep === "ticket" ? (
            <section className="space-y-3">
              <p className="mb-2 text-xs font-semibold text-muted">{tr("3 · Cuota e importe", "3 · Odds and stake")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>{tr("Cuota decimal", "Decimal odds")}
                  <input className={inputClass} name="odds" type="number" min="1.001" max="1000000000" step="0.001" value={oddsInput} onChange={(event) => setOddsInput(event.target.value)} required />
                </label>
                <label className={labelClass}>{tr("Importe (€)", "Stake (€)")}
                  <input className={inputClass} name="stake" type="number" min="0.01" max="1000000" step="0.01" value={stakeInput} onChange={(event) => setStakeInput(event.target.value)} required />
                </label>
              </div>
              {potentialReturn !== null && potentialProfit !== null && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-card2 p-3">
                    <p className="text-[11px] text-muted">{tr("Retorno total si acierta", "Total return if won")}</p>
                    <p className="mt-1 text-lg font-black">{money(potentialReturn)}</p>
                  </div>
                  <div className="rounded-xl bg-statGreen/10 p-3">
                    <p className="text-[11px] text-muted">{tr("Beneficio neto", "Net profit")}</p>
                    <p className="mt-1 text-lg font-black text-statGreen">{money(potentialProfit)}</p>
                  </div>
                </div>
              )}
              <p className="rounded-xl bg-bg px-3 py-2 text-xs text-muted">
                {tr("El retorno incluye lo apostado; el beneficio es la ganancia neta.", "Return includes your stake; profit is the net gain.")}
              </p>
            </section>
            ) : null
          ) : (
            <section className="space-y-3 rounded-2xl border border-brand/25 bg-brand/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted">{tr("Cuota final de la combinada", "Final accumulator odds")}</p>
                  <p className="mt-1 text-[11px] text-muted">{tr("Se calcula multiplicando las cuotas; puedes cambiarla por la cuota de tu casa.", "Calculated from the leg odds; you can replace it with your bookmaker's final odds.")}</p>
                </div>
                {usableCalculatedComboOdds !== null && (
                  <button type="button" onClick={() => setFinalOddsOverride("")} className="shrink-0 text-[11px] font-semibold text-brand underline underline-offset-2">
                    {tr("Usar calculada", "Use calculated")}
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>{tr("Cuota final", "Final odds")}
                  <input className={inputClass} name="odds" type="number" min="1.001" max="1000000000" step="0.001" value={finalComboOdds} onChange={(event) => setFinalOddsOverride(event.target.value)} required />
                </label>
                <label className={labelClass}>{tr("Importe (€)", "Stake (€)")}
                  <input className={inputClass} name="stake" type="number" min="0.01" max="1000000" step="0.01" value={stakeInput} onChange={(event) => setStakeInput(event.target.value)} required />
                </label>
              </div>
              {potentialReturn !== null && potentialProfit !== null && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-card2 p-3">
                    <p className="text-[11px] text-muted">{tr("Retorno total si acierta", "Total return if won")}</p>
                    <p className="mt-1 text-lg font-black">{money(potentialReturn)}</p>
                  </div>
                  <div className="rounded-xl bg-statGreen/10 p-3">
                    <p className="text-[11px] text-muted">{tr("Beneficio neto", "Net profit")}</p>
                    <p className="mt-1 text-lg font-black text-statGreen">{money(potentialProfit)}</p>
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="max-w-md text-xs text-muted">
              {betType === "single" && singleStep === "selection"
                ? tr("Elige el mercado y la selección. Después pondrás la cuota y el importe.", "Choose the market and selection. Next, enter the odds and stake.")
                : tr("Se guardará como pendiente. Podrás corregir el resultado cuando quieras.", "It will be saved as pending. You can change the result whenever you need.")}
            </p>
            {betType === "single" && singleStep === "selection" ? (
              <button type="button" onClick={continueSingleBet} className="min-h-11 rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-brand/10 transition hover:brightness-110">
                {tr("Continuar", "Continue")} →
              </button>
            ) : (
              <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-black shadow-lg shadow-brand/10 disabled:opacity-60">
                {saving ? tr("Guardando…", "Saving…") : tr("Guardar apuesta", "Save bet")}
              </button>
            )}
          </div>
        </form>
      )}

      {marketSummary.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-bold">{tr("Rendimiento por mercado", "Performance by market")}</h2>
            <p className="mt-1 text-xs text-muted">{tr("Solo incluye apuestas ganadas o perdidas; excluye pendientes y anuladas.", "Includes wins and losses only; excludes pending and void bets.")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{tr("Mercado", "Market")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tr("Apuestas", "Bets")}</th>
                  <th className="px-3 py-2 text-right font-medium">{tr("Balance", "Profit")}</th>
                  <th className="px-4 py-2 text-right font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {marketSummary.map((row) => (
                  <tr key={row.market} className="border-t border-line">
                    <td className="max-w-[180px] truncate px-4 py-2.5 font-semibold">{row.market}</td>
                    <td className="px-3 py-2.5 text-right">{row.count}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${row.profit >= 0 ? "text-statGreen" : "text-statRed"}`}>{money(row.profit)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${row.roi >= 0 ? "text-statGreen" : "text-statRed"}`}>{percent(row.roi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">{tr("Historial", "Bet history")} <span className="text-xs font-normal text-muted">({bets.length})</span></h2>
          <div className="flex rounded-full border border-line bg-card p-1">
            {([
              ["all", tr("Todas", "All")],
              ["pending", tr("Pendientes", "Pending")],
              ["settled", tr("Resueltas", "Settled")],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === key ? "bg-brand text-black" : "text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visibleBets.length === 0 ? (
          <div className="card flex flex-col items-center px-5 py-8 text-center sm:py-10">
            <span className="rounded-2xl bg-brand/10 p-3 text-brand">
              <Target aria-hidden="true" className="h-6 w-6" />
            </span>
            <p className="mt-3 font-bold">{bets.length === 0 ? tr("Tu historial empieza aquí", "Your history starts here") : tr("No hay apuestas para este filtro.", "No bets match this filter.")}</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              {bets.length === 0
                ? tr("Registra una apuesta para empezar a ver tus resultados y tu balance.", "Add a bet to start seeing your results and balance.")
                : tr("Prueba otro filtro para ver tus apuestas.", "Try another filter to see your bets.")}
            </p>
            {bets.length === 0 && !showForm && (
              <button type="button" onClick={() => startBet("single")} className="mt-4 min-h-11 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-black transition hover:brightness-110">
                {tr("Registrar primera apuesta", "Add your first bet")}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleBets.map((bet) => (
              <article key={bet.id} className="card grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <time dateTime={bet.eventDate}>{dateLabel(bet.eventDate)}</time>
                    {bet.leagueName && <><span aria-hidden="true">·</span><span>{bet.leagueName}</span></>}
                    <span className={`rounded-full px-2 py-0.5 font-bold ${bet.status === "pending" ? "bg-statOrange/15 text-statOrange" : bet.status === "won" ? "bg-statGreen/15 text-statGreen" : bet.status === "lost" ? "bg-statRed/15 text-statRed" : "bg-card2 text-muted"}`}>{statusLabel(bet.status)}</span>
                  </div>
                  {bet.betType === "accumulator" ? (
                    <p className="mt-1 text-sm font-bold">{tr("Combinada", "Accumulator")} · {bet.legs.length} {tr("selecciones", "selections")}</p>
                  ) : (
                    <p className="mt-1 truncate text-sm font-bold">{bet.homeTeam} <span className="font-normal text-muted">vs.</span> {bet.awayTeam}</p>
                  )}
                  {bet.betType === "accumulator" ? (
                    <ul className="mt-2 space-y-1.5">
                      {bet.legs.map((leg, index) => (
                        <li key={`${leg.eventDate}-${index}`} className="rounded-lg bg-bg px-2.5 py-2 text-xs">
                          <span className="font-semibold">{leg.homeTeam} vs. {leg.awayTeam}</span>
                          <span className="text-muted"> · {leg.market}: </span>
                          <span>{leg.selection}</span>
                          <span className="ml-1 font-bold text-brand">@ {leg.odds.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 truncate text-xs text-muted">{bet.market}: <span className="text-fg">{bet.selection}</span></p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>{tr("Cuota", "Odds")} <b>{bet.odds.toFixed(2)}</b></span>
                    <span>{tr("Importe", "Stake")} <b>{money(bet.stake)}</b></span>
                    {bet.status !== "pending" && <span className={profitFor(bet) >= 0 ? "text-statGreen" : "text-statRed"}>{tr("Balance", "Profit")} <b>{money(profitFor(bet))}</b></span>}
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    aria-label={bet.betType === "accumulator" ? tr("Borrar combinada", "Delete accumulator") : `${tr("Borrar apuesta", "Delete bet")}: ${bet.homeTeam} vs. ${bet.awayTeam}`}
                    disabled={busyId === bet.id}
                    onClick={() => void deleteBet(bet.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-muted transition hover:border-loss/50 hover:text-loss disabled:opacity-50"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
