import { NextResponse, type NextRequest } from "next/server";
import { createAuthServer, getUser } from "@/lib/auth";
import { getFixtureStatsFor, getFixturesByDate } from "@/lib/apifootball";
import { canonicalTeamName } from "@/lib/csvFixtures";
import { resolveBetLeg, requiresFixtureStats } from "@/lib/bet-settlement";
import { BET_COLUMNS, toTrackedBet, type BetLeg, type TrackedBet, type BetStatus } from "@/lib/bet-tracker";
import { todayStr } from "@/lib/format";
import type { Fixture, StoredStats } from "@/lib/types";

export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function teamKey(name: string) {
  return canonicalTeamName(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function betLegs(bet: TrackedBet): BetLeg[] {
  if (bet.betType === "accumulator") return bet.legs;
  if (!bet.homeTeam || !bet.awayTeam) return [];
  return [{
    eventDate: bet.eventDate,
    leagueName: bet.leagueName,
    homeTeam: bet.homeTeam,
    awayTeam: bet.awayTeam,
    market: bet.market,
    selection: bet.selection,
    odds: bet.odds,
  }];
}

function findFixture(leg: BetLeg, fixtures: Fixture[]): Fixture | null {
  const matches = fixtures.filter((fixture) =>
    teamKey(fixture.home.name) === teamKey(leg.homeTeam)
    && teamKey(fixture.away.name) === teamKey(leg.awayTeam),
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1 && leg.leagueName) {
    const leagueMatches = matches.filter((fixture) => teamKey(fixture.leagueName) === teamKey(leg.leagueName ?? ""));
    if (leagueMatches.length === 1) return leagueMatches[0];
  }
  return null;
}

function accumulatorStatus(outcomes: Array<Exclude<BetStatus, "pending"> | null>): BetStatus {
  if (outcomes.includes("lost")) return "lost";
  if (outcomes.every((outcome) => outcome === "won")) return "won";
  return "pending";
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para comprobar tus apuestas." }, { status: 401 });

  const today = todayStr();
  const supabase = createAuthServer();
  const { data, error } = await supabase
    .from("user_bets")
    .select(BET_COLUMNS)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .lte("event_date", today)
    .order("event_date", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Could not load pending bets for settlement:", error);
    return NextResponse.json({ error: "No se pudieron comprobar las apuestas pendientes." }, { status: 500 });
  }

  const bets = (data ?? []).map(toTrackedBet).filter((bet): bet is TrackedBet => bet !== null);
  const legsByBet = bets.map(betLegs);
  const dates = [...new Set(legsByBet.flat().map((leg) => leg.eventDate).filter((date) => date <= today))];
  const fixturesByDate = new Map<string, Fixture[]>();
  const failedDates = new Set<string>();

  const fixtureResults = await Promise.allSettled(dates.map(async (date) => ({
    date,
    fixtures: await getFixturesByDate(date, date === today),
  })));
  for (const [index, result] of fixtureResults.entries()) {
    if (result.status === "fulfilled") fixturesByDate.set(result.value.date, result.value.fixtures);
    else {
      failedDates.add(dates[index]);
      console.error("Could not load fixtures for bet settlement:", result.reason);
    }
  }

  const statsByFixture = new Map<number, Promise<StoredStats>>();
  async function resolveLeg(leg: BetLeg) {
    const fixture = findFixture(leg, fixturesByDate.get(leg.eventDate) ?? []);
    if (!fixture) return null;
    let stats: StoredStats | null = null;
    if (requiresFixtureStats(leg)) {
      let statsRequest = statsByFixture.get(fixture.id);
      if (!statsRequest) {
        statsRequest = getFixtureStatsFor(fixture);
        statsByFixture.set(fixture.id, statsRequest);
      }
      stats = await statsRequest;
    }
    return resolveBetLeg(leg, fixture, stats);
  }

  const updates = await Promise.all(bets.map(async (bet, index) => {
    const legs = legsByBet[index];
    if (!legs.length) return null;
    const outcomes = await Promise.all(legs.map(resolveLeg));
    const status = bet.betType === "accumulator"
      ? accumulatorStatus(outcomes)
      : outcomes[0] ?? "pending";
    if (status === "pending") return null;

    const { data: updatedRow, error: updateError } = await supabase
      .from("user_bets")
      .update({ status })
      .eq("user_id", user.id)
      .eq("id", bet.id)
      .eq("status", "pending")
      .select(BET_COLUMNS)
      .maybeSingle();

    if (updateError) {
      console.error(`Could not settle bet ${bet.id}:`, updateError);
      throw new Error("No se pudo guardar el resultado automático de una apuesta.");
    }
    if (!updatedRow) return null;
    const updatedBet = toTrackedBet(updatedRow);
    if (!updatedBet) {
      console.error(`Supabase returned an invalid settled bet record for ${bet.id}.`);
      throw new Error("La base de datos devolvió un resultado automático no válido.");
    }
    return updatedBet;
  }));

  if (failedDates.size > 0) {
    console.error("Fixture dates could not be checked for bet settlement:", [...failedDates]);
  }
  return NextResponse.json({
    bets: updates.filter((bet): bet is TrackedBet => bet !== null),
    warning: failedDates.size > 0,
  });
}
