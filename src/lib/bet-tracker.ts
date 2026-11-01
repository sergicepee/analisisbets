import "server-only";
import { createAuthServer } from "./auth";

export type BetStatus = "pending" | "won" | "lost" | "void";
export type BetType = "single" | "accumulator";

export interface BetLeg {
  eventDate: string;
  leagueName: string | null;
  homeTeam: string;
  awayTeam: string;
  market: string;
  selection: string;
  odds: number;
}

export interface TrackedBet {
  id: string;
  eventDate: string;
  leagueName: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  market: string;
  selection: string;
  odds: number;
  stake: number;
  betType: BetType;
  legs: BetLeg[];
  status: BetStatus;
  createdAt: string;
}

export const BET_COLUMNS = "id,event_date,league_name,home_team,away_team,market,selection,odds,stake,bet_type,legs,status,created_at";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function isBetStatus(value: unknown): value is BetStatus {
  return value === "pending" || value === "won" || value === "lost" || value === "void";
}

function toBetLeg(value: unknown): BetLeg | null {
  if (!isRecord(value)) return null;
  const odds = numberValue(value.odds);
  if (
    typeof value.eventDate !== "string"
    || (value.leagueName !== null && typeof value.leagueName !== "string")
    || typeof value.homeTeam !== "string"
    || typeof value.awayTeam !== "string"
    || typeof value.market !== "string"
    || typeof value.selection !== "string"
    || odds === null
  ) return null;
  return {
    eventDate: value.eventDate,
    leagueName: value.leagueName,
    homeTeam: value.homeTeam,
    awayTeam: value.awayTeam,
    market: value.market,
    selection: value.selection,
    odds,
  };
}

export function toTrackedBet(value: unknown): TrackedBet | null {
  if (!isRecord(value)) return null;
  const odds = numberValue(value.odds);
  const stake = numberValue(value.stake);
  const betType = value.bet_type;
  const legs = Array.isArray(value.legs) ? value.legs.map(toBetLeg) : null;
  if (
    typeof value.id !== "string"
    || typeof value.event_date !== "string"
    || (value.league_name !== null && typeof value.league_name !== "string")
    || (value.home_team !== null && typeof value.home_team !== "string")
    || (value.away_team !== null && typeof value.away_team !== "string")
    || typeof value.market !== "string"
    || typeof value.selection !== "string"
    || odds === null
    || stake === null
    || (betType !== "single" && betType !== "accumulator")
    || legs === null
    || legs.some((leg) => leg === null)
    || !isBetStatus(value.status)
    || typeof value.created_at !== "string"
    || (betType === "single" && (typeof value.home_team !== "string" || typeof value.away_team !== "string" || legs.length !== 0))
    || (betType === "accumulator" && (value.home_team !== null || value.away_team !== null || legs.length < 2))
  ) return null;

  return {
    id: value.id,
    eventDate: value.event_date,
    leagueName: value.league_name,
    homeTeam: value.home_team,
    awayTeam: value.away_team,
    market: value.market,
    selection: value.selection,
    odds,
    stake,
    betType,
    legs: legs.filter((leg): leg is BetLeg => leg !== null),
    status: value.status,
    createdAt: value.created_at,
  };
}

export async function getUserTrackedBets(userId: string) {
  const { data, error } = await createAuthServer()
    .from("user_bets")
    .select(BET_COLUMNS)
    .eq("user_id", userId)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Could not load user bet records:", error);
    return { bets: [], error: true };
  }

  const bets = (data ?? [])
    .map((row) => toTrackedBet(row))
    .filter((bet): bet is TrackedBet => bet !== null);
  return { bets, error: false };
}
