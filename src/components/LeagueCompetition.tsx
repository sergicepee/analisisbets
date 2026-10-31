"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import type { Fixture } from "@/lib/types";
import { IconStats } from "./icons";
import { FavoriteMatchButton } from "./FollowMatchButton";
import { FollowLeagueButton } from "./FollowLeagueButton";
import { Flag, Shield } from "./Shield";
import { useLang, useT } from "./I18nProvider";
import { LeagueStandingsTable } from "./LeagueStandingsTable";
import type { LeagueStandingTeam, LeagueStandingsZone } from "@/lib/leagueStandings";

type LeagueTopScorer = {
  id: number;
  name: string;
  photo: string | null;
  teamName: string;
  teamLogo: string | null;
  goals: number;
  assists: number;
  appearances: number;
};
type Tab = "calendar" | "table" | "scorers";
const UEFA_LEAGUE_IDS = new Set([2, 3, 848, 531]);
const STAGE_ORDER = ["league", "playoffs", "round-of-16", "quarterfinals", "semifinals", "final", "other"];

export function LeagueCompetition({
  leagueId,
  initialTab,
  leagueName,
  leagueLogo,
  isAuthenticated,
  initialFollowing,
  currentSeason,
  country,
  flag,
  season,
  seasons,
  teams,
  fixtures,
  standingsZones,
  standingsZoneError,
  scorers,
  favoriteIds,
  timeZone,
  scorerError,
}: {
  leagueId: number;
  initialTab: "calendar" | "table";
  leagueName: string;
  leagueLogo: string | null;
  isAuthenticated: boolean;
  initialFollowing: boolean;
  currentSeason: number;
  country: string;
  flag: string | null;
  season: number;
  seasons: number[];
  teams: LeagueStandingTeam[];
  fixtures: Fixture[];
  standingsZones: LeagueStandingsZone[];
  standingsZoneError: string | null;
  scorers: LeagueTopScorer[];
  favoriteIds: number[];
  timeZone: string;
  scorerError?: string | null;
}) {
  const t = useT();
  const lang = useLang();
  const locale = lang === "en" ? "en-GB" : "es-ES";
  const isEuropeanCompetition = UEFA_LEAGUE_IDS.has(leagueId);
  const stages = useMemo(() => getStages(fixtures, isEuropeanCompetition), [fixtures, isEuropeanCompetition]);
  const [selectedStage, setSelectedStage] = useState(() => findCurrentStage(fixtures, isEuropeanCompetition, timeZone));
  const [tab, setTab] = useState<Tab>(() =>
    initialTab === "table" && isEuropeanCompetition && findCurrentStage(fixtures, isEuropeanCompetition, timeZone) !== "league"
      ? "calendar"
      : initialTab,
  );
  const stageFixtures = useMemo(
    () => fixtures.filter((fixture) => getFixtureStage(fixture, isEuropeanCompetition) === selectedStage).sort((a, b) => a.timestamp - b.timestamp),
    [fixtures, isEuropeanCompetition, selectedStage],
  );
  const isKnockoutPhase = isEuropeanCompetition && isKnockoutStage(selectedStage);
  const hasMatchdays = !isEuropeanCompetition || selectedStage === "league";
  const canShowStandings = !isEuropeanCompetition || selectedStage === "league";
  const rounds = useMemo(() => makeRounds(stageFixtures, timeZone, selectedStage, isKnockoutPhase), [stageFixtures, timeZone, selectedStage, isKnockoutPhase]);
  const currentRoundIndex = findCurrentRoundIndex(rounds, timeZone);
  const isSeasonFinished = stageFixtures.length > 0 && stageFixtures.every(isFixtureFinished);
  const defaultRound = currentRoundIndex >= 0 ? currentRoundIndex : Math.max(0, rounds.length - 1);
  const [roundIndex, setRoundIndex] = useState(() => defaultRound);
  const roundNavRef = useRef<HTMLDivElement>(null);
  const activeRound = rounds[roundIndex];
  const roundFixtures = activeRound?.fixtures ?? [];
  const isCurrentRound = !isSeasonFinished && roundIndex === currentRoundIndex;
  const isFinishedRound = !!activeRound && isRoundFinished(activeRound.fixtures);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  useEffect(() => {
    const container = roundNavRef.current;
    const selected = container?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (container && selected) {
      const containerBounds = container.getBoundingClientRect();
      const selectedBounds = selected.getBoundingClientRect();
      const selectedLeft = selectedBounds.left - containerBounds.left + container.scrollLeft;
      const maxScroll = container.scrollWidth - container.clientWidth;
      container.scrollTo({
        left: Math.max(0, Math.min(maxScroll, selectedLeft - (container.clientWidth - selected.clientWidth) / 2)),
        behavior: "smooth",
      });
    }
  }, [roundIndex, rounds.length, tab]);

  return (
    <div className="space-y-4">
      <section className="relative isolate overflow-hidden rounded-3xl border border-slate-300/80 p-5 text-slate-900 shadow-sm sm:p-6" style={{ background: "#f1f3f0" }}>
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-32 z-0 flex h-96 w-96 items-center justify-center opacity-35 blur-[64px]">
          <Shield src={leagueLogo} fallbackSrc={null} alt="" size={300} />
        </div>
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-300/70 bg-white sm:h-24 sm:w-24">
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <Shield src={leagueLogo} fallbackSrc={null} alt={leagueName} size={56} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600"><Flag src={flag} />{country}</div>
            <h1 className="mt-0.5 truncate text-2xl font-black uppercase leading-tight sm:text-3xl">{leagueName}</h1>
            <FollowLeagueButton leagueId={leagueId} leagueName={leagueName} country={country} logo={leagueLogo} isAuthenticated={isAuthenticated} initialFollowing={initialFollowing} />
            <p className="mt-1 text-sm text-slate-600">{t("Temporada")} {season}/{season + 1}</p>
          </div>
        </div>
        <div className="relative mt-5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {seasons.map((year) => (
            <Link
              key={year}
              href={`/liga/${leagueId}?season=${year}&tab=${tab === "table" ? "table" : "calendar"}`}
              aria-current={year === season ? "page" : undefined}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${year === season ? "border-brand bg-brand text-slate-900" : "border-slate-300 bg-white/80 text-slate-700"}`}
            >
              {year}/{year + 1}{year === currentSeason && <span className="ml-1.5 text-[9px] uppercase">{t("Actual")}</span>}
            </Link>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-card">
        <div role="tablist" aria-label={t("Secciones de liga")} className="flex gap-4 overflow-x-auto border-b border-line px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([
            ["calendar", CalendarDays, "Calendario"],
            ...(canShowStandings ? [["table", ListOrdered, "Clasificación"] as const] : []),
          ] as const).map(([key, Icon, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); if (key === "calendar") setRoundIndex(defaultRound); }} className={`relative flex shrink-0 items-center gap-1.5 py-3 text-xs font-bold sm:text-sm ${tab === key ? "text-brand" : "text-muted"}`}>
              <Icon className="h-4 w-4" />
              {t(label)}
              {tab === key && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" />}
            </button>
          ))}
        </div>

        {isEuropeanCompetition && stages.length > 1 && (
          <div className="border-b border-line px-3 py-3">
            <label htmlFor="competition-stage" className="mb-1.5 block text-xs font-semibold text-muted">{t("Fase de la competición")}</label>
            <select
              id="competition-stage"
              value={selectedStage}
              onChange={(event) => {
                const nextStage = event.target.value;
                const nextIsKnockout = isKnockoutStage(nextStage);
                const nextFixtures = fixtures.filter((fixture) => getFixtureStage(fixture, isEuropeanCompetition) === nextStage);
                const nextRounds = makeRounds(nextFixtures, timeZone, nextStage, nextIsKnockout);
                setSelectedStage(nextStage);
                setRoundIndex(Math.max(0, findCurrentRoundIndex(nextRounds, timeZone)));
                if (nextStage !== "league") setTab("calendar");
              }}
              className="w-full rounded-xl border border-line bg-card2 px-3 py-2.5 text-sm font-bold text-fg sm:w-auto"
            >
              {stages.map((stage) => <option key={stage} value={stage}>{t(stageLabel(stage))}</option>)}
            </select>
          </div>
        )}

        {tab === "calendar" && (
          <div>
            {rounds.length > 0 ? (
              <>
                <div className="bg-[#202020] px-3 py-4">
                  {!hasMatchdays ? (
                    <div className="text-center">
                      <h2 className="font-display text-2xl font-extrabold uppercase leading-none">{t(isKnockoutPhase ? stageLabel(selectedStage) : "Calendario")}</h2>
                      <p className="mt-1 text-[11px] text-muted">{roundDateRange(stageFixtures, timeZone, locale)}</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <button type="button" aria-label={t("Jornada anterior")} disabled={roundIndex <= 0} onClick={() => setRoundIndex((index) => Math.max(0, index - 1))} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bg disabled:opacity-40"><ChevronLeft className="h-5 w-5" /></button>
                      <div className="min-w-0 text-center">
                        <h2 className="font-display text-2xl font-extrabold uppercase leading-none">{activeRound?.label}</h2>
                        <p className="mt-1 text-[11px] text-muted">
                          {roundDateRange(roundFixtures, timeZone, locale)}
                          {isCurrentRound && <span className="ml-1 rounded-full bg-brand/20 px-2 py-0.5 text-[9px] font-bold uppercase text-brand">{t("Jornada actual")}</span>}
                          {!isCurrentRound && isFinishedRound && <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase text-muted">{t(isEuropeanCompetition ? "Fase finalizada" : "Finalizada")}</span>}
                        </p>
                      </div>
                      <button type="button" aria-label={t("Jornada siguiente")} disabled={roundIndex >= rounds.length - 1} onClick={() => setRoundIndex((index) => Math.min(rounds.length - 1, index + 1))} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bg disabled:opacity-40"><ChevronRight className="h-5 w-5" /></button>
                    </div>
                  )}
                  {hasMatchdays && (
                    <div ref={roundNavRef} className="relative mt-3 flex snap-x snap-mandatory gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <span aria-hidden="true" className="w-[calc(50%_-_22px)] shrink-0" />
                      {rounds.map((round, index) => (
                        <button key={round.key} type="button" aria-pressed={roundIndex === index} onClick={() => setRoundIndex(index)} className={`relative grid h-9 min-w-9 snap-center shrink-0 place-items-center rounded-lg border px-2 text-xs font-bold transition-colors ${roundIndex === index ? "border-brand bg-brand text-black" : index < currentRoundIndex || (isSeasonFinished && index === currentRoundIndex) ? "border-black bg-[#090909] text-muted" : index === currentRoundIndex && !isSeasonFinished ? "border-brand bg-[#202020] text-fg" : "border-[#303030] bg-[#202020] text-muted"}`}>
                          {round.number ?? index + 1}
                          {index === currentRoundIndex && !isSeasonFinished && index !== roundIndex && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand" />}
                        </button>
                      ))}
                      <span aria-hidden="true" className="w-[calc(50%_-_22px)] shrink-0" />
                    </div>
                  )}
                  {hasMatchdays && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-muted">
                      <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#090909]" />{t("Jugado")}</span>
                      <span><i className="mr-1 inline-block h-2 w-2 rounded-sm border border-brand bg-[#202020]" />{t("Actual")}</span>
                      <span><i className="mr-1 inline-block h-2 w-2 rounded-sm border border-[#303030] bg-[#202020]" />{t("Por jugar")}</span>
                    </div>
                  )}
                </div>
                {isKnockoutPhase
                  ? <KnockoutTies fixtures={stageFixtures} timeZone={timeZone} locale={locale} isAuthenticated={isAuthenticated} favorites={favorites} />
                  : <div>
                    {groupFixturesByDate(roundFixtures, timeZone).map(([dateKey, dateFixtures]) => (
                      <div key={dateKey}>
                        <div className="flex items-center justify-between border-t border-line bg-card2/70 px-4 py-2 text-[10px] font-bold uppercase text-muted">
                          <span className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-brand" />{formatFixtureDate(dateFixtures[0].timestamp, timeZone, locale)}</span>
                          <span>{dateFixtures.length} {t(dateFixtures.length === 1 ? "partido" : "partidos")}</span>
                        </div>
                        {dateFixtures.map((fixture) => (
                          <LeagueFixtureRow key={fixture.id} fixture={fixture} date={dateKey} timeZone={timeZone} locale={locale} isAuthenticated={isAuthenticated} initialFavorite={favorites.has(fixture.id)} />
                        ))}
                      </div>
                    ))}
                  </div>}
              </>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted">{t("No hay calendario disponible para esta temporada.")}</p>
            )}
          </div>
        )}

        {tab === "table" && (
          <LeagueStandingsTable leagueId={leagueId} season={season} teams={teams} fixtures={isEuropeanCompetition ? stageFixtures : fixtures} zones={standingsZones} zoneError={standingsZoneError} />
        )}

        {tab === "scorers" && (
          <div className="divide-y divide-line">
            {scorerError ? <p role="alert" className="px-4 py-8 text-center text-sm text-loss">{scorerError}</p> : scorers.length ? scorers.map((scorer, index) => (
              <div key={scorer.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 text-sm font-bold text-muted">{index + 1}</span>
                <Shield src={scorer.photo} fallbackSrc={scorer.teamLogo} alt="" size={34} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{scorer.name}</div><div className="truncate text-xs text-muted">{scorer.teamName} · {scorer.appearances} {t("partidos")}</div></div>
                <div className="text-right"><b className="text-lg text-brand">{scorer.goals}</b><div className="text-[9px] uppercase text-muted">{t("Goles")}</div></div>
              </div>
            )) : <p className="px-4 py-10 text-center text-sm text-muted">{t("No hay datos de goleadores disponibles.")}</p>}
          </div>
        )}
      </section>
    </div>
  );
}

type FixtureRound = { key: string; label: string; number: number | null; fixtures: Fixture[] };

function getFixtureStage(fixture: Fixture, isEuropeanCompetition: boolean) {
  return isEuropeanCompetition ? fixture.stage ?? "other" : "league";
}

function getStages(fixtures: Fixture[], isEuropeanCompetition: boolean) {
  if (!isEuropeanCompetition) return [];
  return [...new Set(fixtures.map((fixture) => getFixtureStage(fixture, isEuropeanCompetition)))]
    .sort((a, b) => stageOrder(a) - stageOrder(b));
}

function stageOrder(stage: string) {
  const index = STAGE_ORDER.indexOf(stage);
  return index < 0 ? STAGE_ORDER.length : index;
}

function stageLabel(stage: string) {
  switch (stage) {
    case "league": return "Fase de liga";
    case "playoffs": return "Play-offs";
    case "round-of-16": return "Octavos de final";
    case "quarterfinals": return "Cuartos de final";
    case "semifinals": return "Semifinales";
    case "final": return "Final";
    case "other": return "Fase no identificada";
    default: return "Fase no identificada";
  }
}

function isKnockoutStage(stage: string) {
  return ["playoffs", "round-of-16", "quarterfinals", "semifinals", "final"].includes(stage);
}

function findCurrentStage(fixtures: Fixture[], isEuropeanCompetition: boolean, timeZone: string) {
  if (!isEuropeanCompetition || fixtures.length === 0) return "league";
  const now = Date.now() / 1000;
  const today = formatDateKey(now, timeZone);
  const fixtureStage = (fixture: Fixture) => getFixtureStage(fixture, isEuropeanCompetition);
  const liveFixture = fixtures.find((fixture) => ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"].includes(fixture.statusShort));
  if (liveFixture) return fixtureStage(liveFixture);
  const todayFixture = fixtures
    .filter((fixture) => formatDateKey(fixture.timestamp, timeZone) === today && !isFixtureFinished(fixture))
    .sort((a, b) => a.timestamp - b.timestamp)[0];
  if (todayFixture) return fixtureStage(todayFixture);
  const upcomingFixture = fixtures
    .filter((fixture) => !isFixtureFinished(fixture) && fixture.timestamp >= now)
    .sort((a, b) => a.timestamp - b.timestamp)[0];
  if (upcomingFixture) return fixtureStage(upcomingFixture);
  const latestFixture = [...fixtures].sort((a, b) => b.timestamp - a.timestamp)[0];
  return latestFixture ? fixtureStage(latestFixture) : "league";
}

function makeRounds(fixtures: Fixture[], timeZone: string, stage = "league", isKnockoutPhase = false): FixtureRound[] {
  const groups = new Map<string, Fixture[]>();
  const seenIds = new Set<number>();
  const seenMatches = new Set<string>();
  const uniqueFixtures = fixtures.filter((fixture) => {
    const normalizeTeam = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const key = [
      fixture.leagueId,
      formatDateKey(fixture.timestamp, timeZone),
      normalizeTeam(fixture.home.name),
      normalizeTeam(fixture.away.name),
    ].join("|");
    if (seenIds.has(fixture.id) || seenMatches.has(key)) return false;
    seenIds.add(fixture.id);
    seenMatches.add(key);
    return true;
  }).sort((a, b) => a.timestamp - b.timestamp);
  if (isKnockoutPhase) {
    return uniqueFixtures.length
      ? [{ key: stage, label: stageLabel(stage), number: null, fixtures: uniqueFixtures }]
      : [];
  }
  if (stage === "other") {
    return uniqueFixtures.length
      ? [{ key: "calendar", label: "Calendario", number: null, fixtures: uniqueFixtures }]
      : [];
  }
  const appearances = new Map<number, number>();
  for (const fixture of uniqueFixtures) {
    const homePlayed = appearances.get(fixture.home.id) ?? 0;
    const awayPlayed = appearances.get(fixture.away.id) ?? 0;
    const inferredNumber = Math.max(homePlayed, awayPlayed) + 1;
    const explicitNumber = fixture.round.match(/(?:jornada|round|matchday|regular season)\s*[-:]?\s*(\d+)/i)?.[1];
    const key = explicitNumber
      ? `Jornada ${Number(explicitNumber)}`
      : fixture.round || `Jornada ${inferredNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), fixture]);
    appearances.set(fixture.home.id, homePlayed + 1);
    appearances.set(fixture.away.id, awayPlayed + 1);
  }
  return [...groups.entries()]
    .map(([key, rows]) => ({ key, label: roundLabel(key), number: Number(key.match(/\d+/)?.[0]) || null, fixtures: rows.sort((a, b) => a.timestamp - b.timestamp) }))
    .sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.label.localeCompare(b.label));
}

function isRoundFinished(fixtures: Fixture[]) {
  return fixtures.length > 0 && fixtures.every((fixture) => ["FT", "AET", "PEN"].includes(fixture.statusShort));
}

function findCurrentRoundIndex(rounds: ReturnType<typeof makeRounds>, timeZone: string) {
  const now = Date.now() / 1000;
  const today = formatDateKey(now, timeZone);
  const roundToday = rounds.findIndex((round) =>
    round.fixtures.some((fixture) => formatDateKey(fixture.timestamp, timeZone) === today && !isFixtureFinished(fixture)),
  );
  if (roundToday >= 0) return roundToday;

  let nearestRoundIndex = -1;
  let nearestKickoff = Infinity;
  rounds.forEach((round, index) => {
    for (const fixture of round.fixtures) {
      if (!isFixtureFinished(fixture) && fixture.timestamp >= now && fixture.timestamp < nearestKickoff) {
        nearestKickoff = fixture.timestamp;
        nearestRoundIndex = index;
      }
    }
  });
  if (nearestRoundIndex >= 0) return nearestRoundIndex;
  const unfinishedIndex = rounds.findIndex((round) => !isRoundFinished(round.fixtures));
  return unfinishedIndex >= 0 ? unfinishedIndex : Math.max(0, rounds.length - 1);
}

function isFixtureFinished(fixture: Fixture) {
  return ["FT", "AET", "PEN"].includes(fixture.statusShort);
}

function KnockoutTies({ fixtures, timeZone, locale, isAuthenticated, favorites }: {
  fixtures: Fixture[];
  timeZone: string;
  locale: string;
  isAuthenticated: boolean;
  favorites: Set<number>;
}) {
  const t = useT();
  const ties = new Map<string, Fixture[]>();
  for (const fixture of [...fixtures].sort((a, b) => a.timestamp - b.timestamp)) {
    const pair = [fixture.home.id, fixture.away.id].sort((a, b) => a - b).join("|");
    ties.set(pair, [...(ties.get(pair) ?? []), fixture]);
  }

  return (
    <div>
      {[...ties.values()].map((tie) => {
        const [first, second] = tie;
        const isTwoLeggedTie = tie.length > 1;
        let homeAggregate = 0;
        let awayAggregate = 0;
        let playedMatches = 0;
        if (isTwoLeggedTie) {
          for (const fixture of tie) {
            if (!isFixtureFinished(fixture) || fixture.goalsHome === null || fixture.goalsAway === null) continue;
            playedMatches += 1;
            if (fixture.home.id === first.home.id) {
              homeAggregate += fixture.goalsHome;
              awayAggregate += fixture.goalsAway;
            } else {
              homeAggregate += fixture.goalsAway;
              awayAggregate += fixture.goalsHome;
            }
          }
        }
        return (
          <section key={`${first.home.id}-${first.away.id}`} className="border-t border-line">
            {isTwoLeggedTie && (
              <div className="flex items-center justify-between bg-card2/70 px-4 py-2 text-[10px] font-bold uppercase text-muted">
                <span>{first.home.name} – {first.away.name}</span>
                <span>
                  {playedMatches > 0
                    ? <>{t("Global")} <b className="ml-1 text-sm tabular-nums text-fg">{homeAggregate} - {awayAggregate}</b></>
                    : t("Enfrentamiento")}
                </span>
              </div>
            )}
            {tie.map((fixture, index) => {
              const date = formatDateKey(fixture.timestamp, timeZone);
              return (
                <div key={fixture.id}>
                  <div className="flex items-center justify-between border-t border-line/60 px-4 py-1.5 text-[9px] font-bold uppercase text-muted">
                    <span>{isTwoLeggedTie ? t(index === 0 ? "Ida" : index === 1 ? "Vuelta" : "Partido") : ""}</span>
                    <span>{isTwoLeggedTie && index > 1 ? `${index + 1} · ` : ""}{formatFixtureDate(fixture.timestamp, timeZone, locale)}</span>
                  </div>
                  <LeagueFixtureRow fixture={fixture} date={date} timeZone={timeZone} locale={locale} isAuthenticated={isAuthenticated} initialFavorite={favorites.has(fixture.id)} />
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function LeagueFixtureRow({ fixture, date, timeZone, locale, isAuthenticated, initialFavorite }: { fixture: Fixture; date: string; timeZone: string; locale: string; isAuthenticated: boolean; initialFavorite: boolean }) {
  const t = useT();
  const finished = ["FT", "AET", "PEN"].includes(fixture.statusShort);
  const live = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"].includes(fixture.statusShort);
  const suspended = fixture.statusShort === "SUSP";
  const score = fixture.goalsHome !== null && fixture.goalsAway !== null ? `${fixture.goalsHome} - ${fixture.goalsAway}` : null;
  const time = suspended
    ? "SUSP."
    : finished
      ? t("Final")
      : live
        ? fixture.statusShort === "HT" ? "HT" : `${fixture.elapsed ?? ""}′`
        : new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(fixture.timestamp * 1000);
  const redCards = (teamId: number) => fixture.redCardsHome !== undefined && teamId === fixture.home.id
    ? fixture.redCardsHome
    : fixture.redCardsAway !== undefined && teamId === fixture.away.id
      ? fixture.redCardsAway
      : fixture.events.filter((event) => event.teamId === teamId && event.type === "Card" && (event.detail === "Red Card" || event.detail === "Second Yellow Card")).length;
  const homeRed = redCards(fixture.home.id) > 0;
  const awayRed = redCards(fixture.away.id) > 0;
  const homeWon = finished && fixture.goalsHome !== null && fixture.goalsAway !== null && fixture.goalsHome > fixture.goalsAway;
  const awayWon = finished && fixture.goalsHome !== null && fixture.goalsAway !== null && fixture.goalsAway > fixture.goalsHome;
  const homeLost = finished && fixture.goalsHome !== null && fixture.goalsAway !== null && fixture.goalsHome < fixture.goalsAway;
  const awayLost = finished && fixture.goalsHome !== null && fixture.goalsAway !== null && fixture.goalsAway < fixture.goalsHome;
  return (
    <div className={`match-row flex min-w-0 items-center gap-1.5 border-t border-line border-l-[3px] border-l-transparent px-2 sm:px-3 ${suspended ? "bg-card text-muted" : "bg-card"}`}>
      <FavoriteMatchButton fixtureId={fixture.id} isAuthenticated={isAuthenticated} initialFavorite={initialFavorite} />
      <Link href={`/match/${fixture.id}?date=${date}&league=${fixture.leagueId}`} aria-label={`${fixture.home.name} contra ${fixture.away.name}`} className="group flex min-w-0 flex-1 items-center gap-3 py-3 sm:px-1">
        <div className={`w-11 shrink-0 text-center text-xs font-bold tabular-nums sm:w-14 ${live ? "text-chartHit" : "text-muted"}`}>
          {live && score ? <><span className="block text-sm font-extrabold">{score}</span><span className="text-[10px]">{time}</span></> : time}
          {!live && !finished && !suspended && fixture.timestamp < Date.now() / 1000 && <span className="mt-0.5 block text-[9px] leading-tight">{t("Pendiente de actualizar")}</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <LeagueTeamLine name={fixture.home.name} logo={fixture.home.logo} fallback={fixture.home.logoFallback} winner={homeWon} loser={homeLost} redCard={homeRed} suspended={suspended} />
          <LeagueTeamLine name={fixture.away.name} logo={fixture.away.logo} fallback={fixture.away.logoFallback} winner={awayWon} loser={awayLost} redCard={awayRed} suspended={suspended} />
        </div>
        {finished && <div className="flex w-4 shrink-0 flex-col items-center text-xs font-bold leading-5 tabular-nums sm:text-sm"><span>{fixture.goalsHome ?? "—"}</span><span>{fixture.goalsAway ?? "—"}</span></div>}
        <IconStats aria-hidden="true" className="h-8 w-8 shrink-0 rounded-lg border border-line p-1.5 text-muted transition-colors group-hover:border-chartHit/40 group-hover:text-chartHit" />
      </Link>
    </div>
  );
}

function LeagueTeamLine({ name, logo, fallback, winner, loser, redCard, suspended }: { name: string; logo: string | null; fallback?: string | null; winner: boolean; loser: boolean; redCard: boolean; suspended: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 text-xs sm:text-sm ${winner ? "font-bold" : "font-normal"} ${loser || suspended ? "text-muted" : ""}`}>
      <Shield src={logo} fallbackSrc={fallback} alt="" size={20} />
      <span className={`min-w-0 truncate ${suspended ? "line-through decoration-loss decoration-2" : ""}`}>{name}</span>
      {redCard && <span aria-label="Tarjeta roja" title="Tarjeta roja" className="h-3.5 w-2.5 shrink-0 rounded-[2px] bg-red-500" />}
    </div>
  );
}

function roundLabel(value: string) {
  const matchday = value.match(/(?:jornada|round|matchday|regular season)\s*[-:]?\s*(\d+)/i);
  return matchday ? `Jornada ${matchday[1]}` : value;
}

function groupFixturesByDate(fixtures: Fixture[], timeZone: string) {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const key = formatDateKey(fixture.timestamp, timeZone);
    groups.set(key, [...(groups.get(key) ?? []), fixture]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function formatDateKey(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp * 1000);
}

function formatDate(timestamp: number, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone, day: "2-digit", month: "short" }).format(timestamp * 1000);
}

function formatFixtureDate(timestamp: number, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: "short", day: "2-digit", month: "short" }).format(timestamp * 1000);
}

function roundDateRange(fixtures: Fixture[], timeZone: string, locale: string) {
  if (!fixtures.length) return "";
  const first = formatDate(fixtures[0].timestamp, timeZone, locale);
  const last = formatDate(fixtures[fixtures.length - 1].timestamp, timeZone, locale);
  return first === last ? first : `${first} – ${last}`;
}
