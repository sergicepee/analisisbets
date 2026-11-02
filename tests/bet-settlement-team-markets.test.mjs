import test from "node:test";
import assert from "node:assert/strict";
import { resolveBetLeg } from "../src/lib/bet-settlement.ts";

const fixture = {
  id: 1,
  timestamp: 1,
  leagueId: 140,
  leagueName: "La Liga",
  country: "Spain",
  flag: null,
  leagueLogo: null,
  season: 2026,
  round: "",
  venue: null,
  statusShort: "FT",
  statusLong: "Finalizado",
  elapsed: null,
  home: { id: 10, name: "Real Madrid", logo: null },
  away: { id: 20, name: "Arsenal", logo: null },
  goalsHome: 2,
  goalsAway: 1,
  htHome: null,
  htAway: null,
  events: [],
};

const stats = {
  fixtureId: fixture.id,
  leagueId: fixture.leagueId,
  season: fixture.season,
  homeId: fixture.home.id,
  awayId: fixture.away.id,
  goalsHome: 2,
  goalsAway: 1,
  hasData: true,
  home: { shots: 14, shotsOn: 6, corners: 8, cards: 2 },
  away: { shots: 11, shotsOn: 4, corners: 3, cards: 4 },
};

function leg(market, selection) {
  return {
    eventDate: "2026-11-02",
    leagueName: "La Liga",
    homeTeam: fixture.home.name,
    awayTeam: fixture.away.name,
    market,
    selection,
    odds: 2,
  };
}

test("settles full-match and selected-team goal lines", () => {
  assert.equal(resolveBetLeg(leg("Goles", "Más de 2,5 goles"), fixture, null), "won");
  assert.equal(resolveBetLeg(leg("Goles", "Más de 1,5 goles · Local (Real Madrid)"), fixture, null), "won");
  assert.equal(resolveBetLeg(leg("Goles", "Menos de 1,5 goles · Visitante (Arsenal)"), fixture, null), "won");
});

test("settles full-match and selected-team shots, corners, and cards", () => {
  assert.equal(resolveBetLeg(leg("Tiros", "Más de 20,5 tiros"), fixture, stats), "won");
  assert.equal(resolveBetLeg(leg("Tiros", "Más de 10,5 tiros · Visitante (Arsenal)"), fixture, stats), "won");
  assert.equal(resolveBetLeg(leg("Tiros", "Más de 5,5 tiros a puerta · Local (Real Madrid)"), fixture, stats), "won");
  assert.equal(resolveBetLeg(leg("Córners", "Más de 10,5 córners"), fixture, stats), "won");
  assert.equal(resolveBetLeg(leg("Córners", "Más de 7,5 córners · Local (Real Madrid)"), fixture, stats), "won");
  assert.equal(resolveBetLeg(leg("Tarjetas", "Más de 5,5 tarjetas"), fixture, stats), "won");
  assert.equal(resolveBetLeg(leg("Tarjetas", "Menos de 2 tarjetas · Local (Real Madrid)"), fixture, stats), "void");
});
