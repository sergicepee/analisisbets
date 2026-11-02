#!/usr/bin/env python3
"""Paired walk-forward comparison of the active goal model and the phase-two candidate."""

from __future__ import annotations

import csv
import hashlib
import itertools
import math
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "public" / "data" / "football-data"
LEAGUES = {
    "D1": 78,
    "E0": 39,
    "F1": 61,
    "I1": 135,
    "SP1": 140,
}
FORM_MATCHES = 10
COMPETITION_PRIOR_MATCHES = 5
GOAL_HALF_LIFE_DAYS = 60
DIXON_COLES_RHO = -0.1
ELO_K = 20
ELO_HOME_ADVANTAGE = 60
EPSILON = 1e-15
MODEL_VERSION_PATH = Path(__file__).resolve().parents[1] / "src" / "lib" / "prediction-config.ts"


@dataclass(frozen=True)
class Match:
    timestamp: int
    league_code: str
    league_id: int
    season: int
    home_id: str
    away_id: str
    home_name: str
    away_name: str
    home_goals: int
    away_goals: int
    row_id: str


def team_key(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name)
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", normalized.casefold()).strip()


def parse_timestamp(date: str) -> int:
    formats = ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d")
    parsed = None
    for date_format in formats:
        try:
            parsed = datetime.strptime(date.strip(), date_format).date()
            break
        except ValueError:
            continue
    if parsed is None:
        raise ValueError(f"Fecha no reconocida en CSV: {date!r}")
    return int(datetime(parsed.year, parsed.month, parsed.day, tzinfo=timezone.utc).timestamp())


def load_matches(data_dir: Path = DATA_DIR) -> tuple[list[Match], int, int]:
    matches: list[Match] = []
    skipped_without_result = 0
    duplicates = 0
    seen: set[tuple[str, str, str, str]] = set()
    for code, league_id in LEAGUES.items():
        for season in (2025, 2026):
            file_path = data_dir / f"{code}-{season}-{str(season + 1)[-2:]}.csv"
            if not file_path.exists():
                continue
            with file_path.open("r", encoding="utf-8-sig", newline="") as stream:
                for row in csv.DictReader(stream):
                    home_name = (row.get("HomeTeam") or "").strip()
                    away_name = (row.get("AwayTeam") or "").strip()
                    home_goals, away_goals = row.get("FTHG"), row.get("FTAG")
                    if not home_name or not away_name or home_goals in (None, "") or away_goals in (None, ""):
                        skipped_without_result += 1
                        continue
                    timestamp = parse_timestamp(row.get("Date", ""))
                    key = (code, str(timestamp), team_key(home_name), team_key(away_name))
                    if key in seen:
                        duplicates += 1
                        continue
                    seen.add(key)
                    matches.append(Match(
                        timestamp=timestamp,
                        league_code=code,
                        league_id=league_id,
                        season=season,
                        home_id=team_key(home_name),
                        away_id=team_key(away_name),
                        home_name=home_name,
                        away_name=away_name,
                        home_goals=int(home_goals),
                        away_goals=int(away_goals),
                        row_id=f"{code}:{timestamp}:{team_key(home_name)}:{team_key(away_name)}",
                    ))
    matches.sort(key=lambda match: (match.timestamp, match.league_code, match.home_id, match.away_id))
    return matches, skipped_without_result, duplicates


def model_version() -> str:
    source = MODEL_VERSION_PATH.read_text(encoding="utf-8")
    match = re.search(r'PREDICTION_MODEL_VERSION\s*=\s*"([^"]+)"', source)
    if not match:
        raise RuntimeError(f"No se pudo leer la versión del modelo en {MODEL_VERSION_PATH}")
    return match.group(1)


def data_version(data_dir: Path = DATA_DIR) -> str:
    digest = hashlib.sha256()
    for code in LEAGUES:
        for season in (2025, 2026):
            file_path = data_dir / f"{code}-{season}-{str(season + 1)[-2:]}.csv"
            if file_path.exists():
                digest.update(file_path.name.encode("utf-8"))
                digest.update(file_path.read_bytes())
    return digest.hexdigest()


def _assert_strictly_prior(match: Match, history: list[Match]) -> None:
    if any(item.timestamp >= match.timestamp for item in history):
        raise ValueError("El backtest recibió datos de la misma fecha o del futuro.")


def team_rows(history: list[Match], team_id: str, target_league: str) -> tuple[list[dict], list[dict]]:
    all_rows = []
    competition_rows = []
    for match in history:
        if match.home_id == team_id:
            row = {
                "fixture_id": match.row_id, "timestamp": match.timestamp, "is_home": True,
                "for": match.home_goals, "against": match.away_goals, "league": match.league_code,
                "season": match.season,
            }
        elif match.away_id == team_id:
            row = {
                "fixture_id": match.row_id, "timestamp": match.timestamp, "is_home": False,
                "for": match.away_goals, "against": match.home_goals, "league": match.league_code,
                "season": match.season,
            }
        else:
            continue
        all_rows.append(row)
        if match.league_code == target_league:
            competition_rows.append(row)
    return all_rows[-2 * FORM_MATCHES:], competition_rows[-FORM_MATCHES:]


def weighted_mean(rows: list[dict], field: str) -> float | None:
    if not rows:
        return None
    latest = rows[-1]["timestamp"]
    half_life = GOAL_HALF_LIFE_DAYS * 86400
    weighted_sum = total_weight = 0.0
    for row in rows:
        weight = 0.5 ** (max(0, latest - row["timestamp"]) / half_life)
        weighted_sum += row[field] * weight
        total_weight += weight
    return weighted_sum / total_weight if total_weight else None


def venue_average(all_rows: list[dict], competition_rows: list[dict], side: str, home_venue: bool) -> float | None:
    competition_ids = {row["fixture_id"] for row in competition_rows}
    overall_rows = [row for row in all_rows if row["fixture_id"] not in competition_ids][-FORM_MATCHES:]
    overall_venue = [row for row in overall_rows if row["is_home"] == home_venue]
    competition_venue = [row for row in competition_rows if row["is_home"] == home_venue]
    overall = weighted_mean(overall_rows, side)
    if len(overall_rows) < 3 or overall is None:
        return weighted_mean(competition_venue, side) if len(competition_venue) >= 3 else None
    baseline = weighted_mean(overall_venue, side) if len(overall_venue) >= 3 else overall
    if not competition_venue:
        return baseline
    competition_mean = weighted_mean(competition_venue, side)
    if competition_mean is None:
        return baseline
    weight = len(competition_venue) / (len(competition_venue) + COMPETITION_PRIOR_MATCHES)
    return baseline * (1 - weight) + competition_mean * weight


def expected_goals(match: Match, team_history: dict[str, list[Match]]) -> tuple[float, float] | None:
    home_all, home_competition = team_rows(team_history[match.home_id], match.home_id, match.league_code)
    away_all, away_competition = team_rows(team_history[match.away_id], match.away_id, match.league_code)
    home_attack = venue_average(home_all, home_competition, "for", True)
    home_defense = venue_average(home_all, home_competition, "against", True)
    away_attack = venue_average(away_all, away_competition, "for", False)
    away_defense = venue_average(away_all, away_competition, "against", False)
    if None in (home_attack, home_defense, away_attack, away_defense):
        return None
    return ((home_attack + away_defense) / 2, (away_attack + home_defense) / 2)


def _relative_strength(
    all_rows: list[dict],
    competition_rows: list[dict],
    side: str,
    league_history: dict[str, list[Match]],
) -> float | None:
    competition_ids = {row["fixture_id"] for row in competition_rows}
    overall_rows = [row for row in all_rows if row["fixture_id"] not in competition_ids][-FORM_MATCHES:]

    def normalized(rows: list[dict]) -> list[dict]:
        values = []
        for row in rows:
            history = [
                match for match in league_history[row["league"]]
                if match.season == row["season"]
            ]
            if len(history) < 3:
                continue
            home_mean = sum(match.home_goals for match in history) / len(history)
            away_mean = sum(match.away_goals for match in history) / len(history)
            if side == "attack":
                baseline = home_mean if row["is_home"] else away_mean
                value = row["for"]
            else:
                baseline = away_mean if row["is_home"] else home_mean
                value = row["against"]
            if baseline > 0:
                values.append({
                    "timestamp": row["timestamp"],
                    "value": value / baseline,
                })
        return values

    def average(values: list[dict]) -> float | None:
        if not values:
            return None
        latest = values[-1]["timestamp"]
        half_life = GOAL_HALF_LIFE_DAYS * 86400
        total = weight_sum = 0.0
        for value in values:
            weight = 0.5 ** (max(0, latest - value["timestamp"]) / half_life)
            total += value["value"] * weight
            weight_sum += weight
        return total / weight_sum if weight_sum else None

    overall_values = normalized(overall_rows)
    competition_values = normalized(competition_rows)
    overall = average(overall_values) if len(overall_values) >= 3 else None
    competition = average(competition_values) if competition_values else None
    if overall is None:
        return competition if len(competition_values) >= 3 else None
    if competition is None:
        return overall
    weight = len(competition_values) / (len(competition_values) + COMPETITION_PRIOR_MATCHES)
    return overall * (1 - weight) + competition * weight


def expected_goals_relative(
    match: Match,
    team_history: dict[str, list[Match]],
    league_history: dict[str, list[Match]],
) -> tuple[float, float] | None:
    home_all, home_competition = team_rows(team_history[match.home_id], match.home_id, match.league_code)
    away_all, away_competition = team_rows(team_history[match.away_id], match.away_id, match.league_code)
    target_history = [
        item for item in league_history[match.league_code]
        if item.season == match.season
    ]
    if len(target_history) < 3:
        return None
    home_mean = sum(item.home_goals for item in target_history) / len(target_history)
    away_mean = sum(item.away_goals for item in target_history) / len(target_history)
    home_attack = _relative_strength(home_all, home_competition, "attack", league_history)
    away_defense = _relative_strength(away_all, away_competition, "defense", league_history)
    away_attack = _relative_strength(away_all, away_competition, "attack", league_history)
    home_defense = _relative_strength(home_all, home_competition, "defense", league_history)
    if None in (home_attack, away_defense, away_attack, home_defense):
        return None
    return (
        home_mean * home_attack * away_defense,
        away_mean * away_attack * home_defense,
    )


def poisson_model(home_expected: float, away_expected: float) -> dict[str, float]:
    home_expected = min(8.0, max(0.05, home_expected))
    away_expected = min(8.0, max(0.05, away_expected))
    home_pmf = [math.exp(-home_expected)]
    away_pmf = [math.exp(-away_expected)]
    for goals in range(1, 16):
        home_pmf.append(home_pmf[-1] * home_expected / goals)
        away_pmf.append(away_pmf[-1] * away_expected / goals)
    totals = defaultdict(float)
    total_mass = 0.0
    for home_goals, home_probability in enumerate(home_pmf):
        for away_goals, away_probability in enumerate(away_pmf):
            correction = 1.0
            if home_goals == 0 and away_goals == 0:
                correction = 1 - home_expected * away_expected * DIXON_COLES_RHO
            elif home_goals == 0 and away_goals == 1:
                correction = 1 + home_expected * DIXON_COLES_RHO
            elif home_goals == 1 and away_goals == 0:
                correction = 1 + away_expected * DIXON_COLES_RHO
            elif home_goals == 1 and away_goals == 1:
                correction = 1 - DIXON_COLES_RHO
            probability = home_probability * away_probability * max(0.0, correction)
            total_mass += probability
            if home_goals > away_goals:
                totals["home"] += probability
            elif home_goals == away_goals:
                totals["draw"] += probability
            else:
                totals["away"] += probability
            if home_goals + away_goals > 1.5:
                totals["over15"] += probability
            if home_goals + away_goals > 2.5:
                totals["over25"] += probability
            if home_goals > 0 and away_goals > 0:
                totals["btts"] += probability
    return {key: value / total_mass for key, value in totals.items()}


def league_baseline(matches: list[Match]) -> dict[str, float]:
    count = len(matches)
    outcomes = {
        "home": sum(match.home_goals > match.away_goals for match in matches),
        "draw": sum(match.home_goals == match.away_goals for match in matches),
        "away": sum(match.home_goals < match.away_goals for match in matches),
    }
    probabilities = {key: (value + 1) / (count + 3) for key, value in outcomes.items()}
    for key, predicate in (
        ("over15", lambda m: m.home_goals + m.away_goals > 1.5),
        ("over25", lambda m: m.home_goals + m.away_goals > 2.5),
        ("btts", lambda m: m.home_goals > 0 and m.away_goals > 0),
    ):
        probabilities[key] = (sum(predicate(match) for match in matches) + 1) / (count + 2)
    return probabilities


def elo_probabilities(match: Match, ratings: dict[str, float], league_matches: list[Match]) -> dict[str, float]:
    expected_score = 1 / (1 + 10 ** (-(
        ratings[match.home_id] + ELO_HOME_ADVANTAGE - ratings[match.away_id]
    ) / 400))
    draw = (sum(item.home_goals == item.away_goals for item in league_matches) + 1) / (len(league_matches) + 3)
    draw = min(0.4, max(0.1, draw))
    home_share = min(1.0, max(0.0, (expected_score - 0.5 * draw) / (1 - draw)))
    return {"home": home_share * (1 - draw), "draw": draw, "away": (1 - home_share) * (1 - draw)}


def score_model(match: Match, probabilities: dict[str, float]) -> dict[str, float]:
    outcome = "home" if match.home_goals > match.away_goals else "draw" if match.home_goals == match.away_goals else "away"
    binary = {
        "over15": match.home_goals + match.away_goals > 1.5,
        "over25": match.home_goals + match.away_goals > 2.5,
        "btts": match.home_goals > 0 and match.away_goals > 0,
    }
    scored = {"outcome": outcome, "actual_markets": binary}
    scored.update({
        key: probabilities[key]
        for key in ("home", "draw", "away", "over15", "over25", "btts")
        if key in probabilities
    })
    return scored


def walk_forward(matches: list[Match]) -> tuple[list[dict], int]:
    team_history: dict[str, list[Match]] = defaultdict(list)
    league_history: dict[str, list[Match]] = defaultdict(list)
    ratings: dict[str, float] = defaultdict(lambda: 1500.0)
    evaluated: list[dict] = []
    skipped_for_coverage = 0
    for timestamp, group_iter in itertools.groupby(matches, key=lambda match: match.timestamp):
        group = list(group_iter)
        group_predictions = []
        for match in group:
            all_history = team_history[match.home_id] + team_history[match.away_id]
            _assert_strictly_prior(match, all_history)
            prior_league = league_history[match.league_code]
            _assert_strictly_prior(match, prior_league)
            expected = expected_goals(match, team_history)
            if expected is None:
                skipped_for_coverage += 1
                continue
            model = poisson_model(*expected)
            relative_expected = expected_goals_relative(match, team_history, league_history)
            baseline = league_baseline(prior_league)
            elo = elo_probabilities(match, ratings, prior_league)
            record = {
                "match": match,
                "model": score_model(match, model),
                "league": score_model(match, baseline),
                "elo": score_model(match, elo),
                "expected_home_goals": expected[0],
                "expected_away_goals": expected[1],
            }
            if relative_expected is not None:
                record["phase2"] = score_model(match, poisson_model(*relative_expected))
                record["phase2_expected_home_goals"] = relative_expected[0]
                record["phase2_expected_away_goals"] = relative_expected[1]
            evaluated.append(record)
        for match in group:
            expected_score = 1 / (1 + 10 ** (-(
                ratings[match.home_id] + ELO_HOME_ADVANTAGE - ratings[match.away_id]
            ) / 400))
            actual_score = 1.0 if match.home_goals > match.away_goals else 0.5 if match.home_goals == match.away_goals else 0.0
            change = ELO_K * (actual_score - expected_score)
            ratings[match.home_id] += change
            ratings[match.away_id] -= change
            team_history[match.home_id].append(match)
            team_history[match.away_id].append(match)
            league_history[match.league_code].append(match)
    return evaluated, skipped_for_coverage


def metric_summary(records: list[dict], key: str) -> tuple[int, float, float]:
    if not records:
        return 0, math.nan, math.nan
    log_losses = []
    brier_scores = []
    for record in records:
        prediction = record[key]
        actual = prediction["outcome"]
        log_losses.append(-math.log(max(EPSILON, prediction[actual])))
        brier_scores.append(sum(
            (prediction[outcome] - (1.0 if outcome == actual else 0.0)) ** 2
            for outcome in ("home", "draw", "away")
        ))
    return len(records), sum(log_losses) / len(records), sum(brier_scores) / len(records)


def market_summary(records: list[dict], model_key: str, market: str) -> tuple[float, float]:
    log_losses = []
    brier_scores = []
    for record in records:
        prediction = record[model_key]
        probability = min(1 - EPSILON, max(EPSILON, prediction[market]))
        actual = record[model_key]["actual_markets"][market]
        actual_value = 1.0 if actual else 0.0
        log_losses.append(-(actual_value * math.log(probability) + (1 - actual_value) * math.log(1 - probability)))
        brier_scores.append((probability - actual_value) ** 2)
    return sum(log_losses) / len(log_losses), sum(brier_scores) / len(brier_scores)


def calibration(records: list[dict], model_key: str, outcome: str) -> list[tuple[str, int, float, float]]:
    bins = [[] for _ in range(10)]
    for record in records:
        prediction = record[model_key][outcome]
        index = min(9, int(prediction * 10))
        bins[index].append((prediction, record[model_key]["outcome"] == outcome))
    output = []
    for index, values in enumerate(bins):
        if not values:
            continue
        predicted = sum(item[0] for item in values) / len(values)
        actual = sum(item[1] for item in values) / len(values)
        output.append((f"{index * 10:02d}-{(index + 1) * 10:02d}%", len(values), predicted, actual))
    return output


def run(data_dir: Path = DATA_DIR) -> int:
    matches, missing_results, duplicates = load_matches(data_dir)
    if not matches:
        raise RuntimeError(f"No hay partidos históricos válidos en {data_dir}")
    records, skipped = walk_forward(matches)
    if not records:
        raise RuntimeError("No hay suficientes partidos anteriores para evaluar el modelo.")
    comparable_records = [record for record in records if "phase2" in record]
    if not comparable_records:
        raise RuntimeError("La Fase 2 no tiene cobertura suficiente para una comparación pareada.")

    print("Backtest walk-forward por fecha de calendario; los partidos del mismo día nunca entran en el entrenamiento.")
    print(f"Datos: {len(matches)} partidos, {len(records)} con cobertura Fase 1, {len(comparable_records)} comparables en ambas fases.")
    print(f"Fase 1 sin muestra de localía: {skipped}; Fase 2 sin contexto/muestra comparable: {len(records) - len(comparable_records)}.")
    print(f"Filas sin resultado omitidas: {missing_results}; duplicados omitidos: {duplicates}.")
    print(f"Versión: {model_version()} | datos CSV SHA-256: {data_version(data_dir)}")
    print(f"Competiciones: {', '.join(LEAGUES)} | modelo: {FORM_MATCHES} partidos, vida media goles {GOAL_HALF_LIFE_DAYS}d, rho {DIXON_COLES_RHO}.")
    print("Alcance: histórico doméstico de cinco ligas; no valida las copas europeas ni la mezcla ESPN completa.")
    print("\nMétricas 1X2 pareadas (Brier multicategoría = suma de errores cuadrados; menor es mejor):")
    summaries = {key: metric_summary(comparable_records, key) for key in ("model", "phase2", "league", "elo")}
    print(f"{'Modelo':<16}{'N':>8}{'Log-loss':>12}{'Brier':>12}")
    for label, key in (("Fase 1 actual", "model"), ("Fase 2 relativa", "phase2"), ("Frecuencia liga", "league"), ("Elo simple", "elo")):
        n, log_loss, brier = summaries[key]
        print(f"{label:<16}{n:>8}{log_loss:>12.4f}{brier:>12.4f}")
    print("\nMétricas binarias pareadas:")
    print(f"{'Mercado':<12}{'Fase 1 LL':>12}{'Fase 2 LL':>12}{'Liga LL':>12}{'Fase 1 Brier':>14}{'Fase 2 Brier':>14}{'Liga Brier':>13}")
    for market in ("over15", "over25", "btts"):
        model_log_loss, model_brier = market_summary(comparable_records, "model", market)
        phase2_log_loss, phase2_brier = market_summary(comparable_records, "phase2", market)
        league_log_loss, league_brier = market_summary(comparable_records, "league", market)
        print(f"{market:<12}{model_log_loss:>12.4f}{phase2_log_loss:>12.4f}{league_log_loss:>12.4f}{model_brier:>14.4f}{phase2_brier:>14.4f}{league_brier:>13.4f}")
    print("\nCalibración Fase 2 1X2 (tramos de 10%; especialmente empate):")
    for outcome in ("home", "draw", "away"):
        print(f"\n{outcome.upper()}")
        print(f"{'Tramo':<10}{'N':>8}{'Predicho':>12}{'Real':>12}")
        for name, count, predicted, actual in calibration(comparable_records, "phase2", outcome):
            print(f"{name:<10}{count:>8}{predicted:>11.1%}{actual:>11.1%}")

    model_metrics = summaries["phase2"][1:]
    phase1_metrics = summaries["model"][1:]
    elo_metrics = summaries["elo"][1:]
    if any(new >= old for new, old in zip(model_metrics, phase1_metrics)):
        print("\nFASE 2 NO ACTIVADA: no mejora log-loss y Brier frente a la Fase 1 en la muestra pareada.")
    else:
        print("\nFASE 2 MEJORA la Fase 1 en log-loss y Brier sobre la muestra pareada.")
    if any(model_value >= elo_value for model_value, elo_value in zip(model_metrics, elo_metrics)):
        print("\nAVISO: la Fase 2 no supera al Elo en log-loss y Brier sobre esta muestra.")
    else:
        print("\nLa Fase 2 supera al Elo en log-loss y Brier sobre esta muestra.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(run())
    except Exception as error:
        print(f"Error en backtest: {error}", file=sys.stderr)
        sys.exit(1)
