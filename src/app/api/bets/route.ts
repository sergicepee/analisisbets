import { NextResponse, type NextRequest } from "next/server";
import { createAuthServer, getUser } from "@/lib/auth";
import { BET_COLUMNS, toTrackedBet, type BetLeg, type BetStatus } from "@/lib/bet-tracker";

export const dynamic = "force-dynamic";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requestBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

function text(value: unknown, maxLength: number, optional = false): string | null | undefined {
  if (optional && (value === undefined || value === null || value === "")) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function eventDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function validDecimalOdds(value: unknown, maximum: number): value is number {
  return typeof value === "number"
    && Number.isFinite(value)
    && value > 1
    && value <= maximum
    && Math.abs(value * 1000 - Math.round(value * 1000)) <= 1e-7;
}

function parseLeg(value: unknown): BetLeg | null {
  if (!isRecord(value)) return null;
  const date = eventDate(value.eventDate);
  const leagueName = text(value.leagueName, 100, true);
  const homeTeam = text(value.homeTeam, 100);
  const awayTeam = text(value.awayTeam, 100);
  const market = text(value.market, 80);
  const selection = text(value.selection, 120);
  if (!date || leagueName === undefined || !homeTeam || !awayTeam || !market || !selection || !validDecimalOdds(value.odds, 1000)) return null;
  return { eventDate: date, leagueName, homeTeam, awayTeam, market, selection, odds: value.odds };
}

function parseNewBet(body: Record<string, unknown>) {
  const stake = body.stake;
  if (typeof stake !== "number" || !Number.isFinite(stake) || stake <= 0 || stake > 1000000
    || Math.abs(stake * 100 - Math.round(stake * 100)) > 1e-7) return null;

  if (body.betType === "accumulator") {
    if (!Array.isArray(body.legs) || body.legs.length < 2 || body.legs.length > 20 || !validDecimalOdds(body.odds, 1000000000)) return null;
    const legs = body.legs.map(parseLeg);
    if (legs.some((leg) => leg === null)) return null;
    const validLegs = legs.filter((leg): leg is BetLeg => leg !== null);
    const eventDate = validLegs.map((leg) => leg.eventDate).sort()[0];
    if (!eventDate) return null;
    return {
      event_date: eventDate,
      league_name: null,
      home_team: null,
      away_team: null,
      market: "Combinada",
      selection: `Combinada · ${validLegs.length} selecciones`,
      odds: body.odds,
      stake,
      bet_type: "accumulator",
      legs: validLegs,
    };
  }
  if (body.betType !== undefined && body.betType !== "single") return null;

  const homeTeam = text(body.homeTeam, 100);
  const awayTeam = text(body.awayTeam, 100);
  const leagueName = text(body.leagueName, 100, true);
  const market = text(body.market, 80);
  const selection = text(body.selection, 120);
  const date = eventDate(body.eventDate);
  const odds = body.odds;
  if (
    !homeTeam || !awayTeam || leagueName === undefined || !market || !selection || !date
    || !validDecimalOdds(odds, 1000000000)
  ) return null;

  return {
    event_date: date,
    league_name: leagueName,
    home_team: homeTeam,
    away_team: awayTeam,
    market,
    selection,
    odds,
    stake,
    bet_type: "single",
    legs: [],
  };
}

function isBetStatus(value: unknown): value is BetStatus {
  return value === "pending" || value === "won" || value === "lost" || value === "void";
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar tus apuestas." }, { status: 401 });
  const body = await requestBody(request);
  const bet = body ? parseNewBet(body) : null;
  if (!bet) return NextResponse.json({ error: "Revisa los datos de la apuesta: partido, mercado, selección, cuota e importe." }, { status: 400 });

  const { data, error } = await createAuthServer()
    .from("user_bets")
    .insert({ ...bet, user_id: user.id })
    .select(BET_COLUMNS)
    .single();
  if (error) {
    console.error("Could not save user bet:", error);
    return NextResponse.json({ error: "No se pudo guardar. Comprueba que la migración de Mi registro esté aplicada en Supabase." }, { status: 500 });
  }
  const savedBet = toTrackedBet(data);
  if (!savedBet) {
    console.error("Supabase returned an invalid saved bet record.");
    return NextResponse.json({ error: "La base de datos devolvió un registro no válido." }, { status: 500 });
  }
  return NextResponse.json({ bet: savedBet }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para actualizar tus apuestas." }, { status: 401 });
  const body = await requestBody(request);
  if (!body || !validId(body.id) || !isBetStatus(body.status)) {
    return NextResponse.json({ error: "Apuesta o resultado no válido." }, { status: 400 });
  }

  const { data, error } = await createAuthServer()
    .from("user_bets")
    .update({ status: body.status })
    .eq("user_id", user.id)
    .eq("id", body.id)
    .select(BET_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error("Could not update user bet:", error);
    return NextResponse.json({ error: "No se pudo actualizar el resultado." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "No se encontró esa apuesta." }, { status: 404 });
  const updatedBet = toTrackedBet(data);
  if (!updatedBet) return NextResponse.json({ error: "La base de datos devolvió un registro no válido." }, { status: 500 });
  return NextResponse.json({ bet: updatedBet });
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para borrar tus apuestas." }, { status: 401 });
  const body = await requestBody(request);
  if (!body || !validId(body.id)) return NextResponse.json({ error: "Apuesta no válida." }, { status: 400 });

  const { data, error } = await createAuthServer()
    .from("user_bets")
    .delete()
    .eq("user_id", user.id)
    .eq("id", body.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Could not delete user bet:", error);
    return NextResponse.json({ error: "No se pudo borrar la apuesta." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "No se encontró esa apuesta." }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
