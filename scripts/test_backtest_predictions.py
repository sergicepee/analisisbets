import unittest
from collections import defaultdict
from unittest.mock import patch

from backtest_predictions import (
    Match, _assert_strictly_prior, data_version, expected_goals_relative,
    model_version, poisson_model, team_rows, venue_average, walk_forward,
)


def fixture(timestamp, home="a", away="b", home_goals=1, away_goals=0, league="SP1"):
    return Match(timestamp, league, 140, 2025, home, away, home, away, home_goals, away_goals, f"{timestamp}:{home}:{away}")


class BacktestTests(unittest.TestCase):
    def test_training_data_must_precede_kickoff(self):
        match = fixture(200)
        with self.assertRaises(ValueError):
            _assert_strictly_prior(match, [fixture(200, "c", "d")])
        _assert_strictly_prior(match, [fixture(199, "c", "d")])

    def test_current_fixture_is_not_in_team_form(self):
        current = fixture(200)
        earlier = fixture(100)
        all_rows, competition_rows = team_rows([earlier], "a", "SP1")
        self.assertEqual([row["fixture_id"] for row in all_rows], [earlier.row_id])
        self.assertEqual([row["fixture_id"] for row in competition_rows], [earlier.row_id])
        _assert_strictly_prior(current, [earlier])

    def test_goal_matrix_probabilities_are_normalized(self):
        prediction = poisson_model(1.4, 0.9)
        self.assertAlmostEqual(sum(prediction[key] for key in ("home", "draw", "away")), 1.0, places=12)
        self.assertGreaterEqual(prediction["over15"], prediction["over25"])

    def test_competition_sample_is_used_when_no_other_competition_history_exists(self):
        rows = [
            {"fixture_id": str(index), "timestamp": index * 100, "is_home": True, "for": 2.0, "against": 1.0}
            for index in range(1, 4)
        ]
        self.assertEqual(venue_average(rows, rows, "for", True), 2.0)

    def test_walk_forward_excludes_every_match_on_the_same_date(self):
        matches = [
            fixture(100, "a", "b"),
            fixture(100, "c", "d"),
            fixture(200, "a", "c"),
        ]
        history_sizes = []

        def fake_expected_goals(match, history):
            history_sizes.append(sum(len(rows) for rows in history.values()))
            return 1.2, 0.8

        with patch("backtest_predictions.expected_goals", side_effect=fake_expected_goals):
            predictions, _ = walk_forward(matches)
        self.assertEqual(len(predictions), 3)
        self.assertEqual(history_sizes, [0, 0, 4])

    def test_backtest_reports_production_model_and_dataset_versions(self):
        self.assertEqual(model_version(), "cross-competition-poisson-v1")
        self.assertEqual(len(data_version()), 64)

    def test_relative_model_recovers_distinct_home_and_away_league_rates(self):
        history = [
            fixture(100, "a", "b", home_goals=2, away_goals=1),
            fixture(200, "a", "b", home_goals=2, away_goals=1),
            fixture(300, "a", "b", home_goals=2, away_goals=1),
        ]
        teams = defaultdict(list)
        leagues = defaultdict(list)
        for match in history:
            teams[match.home_id].append(match)
            teams[match.away_id].append(match)
            leagues[match.league_code].append(match)
        current = fixture(400, "a", "b")
        self.assertEqual(expected_goals_relative(current, teams, leagues), (2.0, 1.0))


if __name__ == "__main__":
    unittest.main()
