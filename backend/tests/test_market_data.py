import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ["SMC_MOCK"] = "1"

import mt5_mock
from data import MarketDataError, _validated_frame, get_candle_page


class MarketDataContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        mt5_mock.initialize(login=999999, password="mock", server="MockServer-Demo")

    @classmethod
    def tearDownClass(cls):
        mt5_mock.shutdown()

    def test_history_cursor_is_repeatable_disjoint_and_moves_backward(self):
        latest = get_candle_page("XAUUSDm", 60, limit=250)
        older = get_candle_page("XAUUSDm", 60, limit=250, before=latest["next_before"])
        retry = get_candle_page("XAUUSDm", 60, limit=250, before=latest["next_before"])

        self.assertEqual(250, len(latest["bars"]))
        self.assertEqual(250, len(older["bars"]))
        self.assertEqual(older["bars"], retry["bars"])
        self.assertLess(older["bars"][-1]["time"], latest["bars"][0]["time"])
        self.assertLess(older["next_before"], latest["next_before"])
        self.assertTrue(latest["has_more"])

    def test_every_page_obeys_strict_ohlc_contract(self):
        page = get_candle_page("EURUSDm", 15, limit=500)
        previous = 0
        for bar in page["bars"]:
            self.assertGreater(bar["time"], previous)
            self.assertGreater(bar["low"], 0)
            self.assertGreaterEqual(bar["high"], max(bar["open"], bar["close"]))
            self.assertLessEqual(bar["low"], min(bar["open"], bar["close"]))
            previous = bar["time"]

    def test_alias_resolves_to_one_identical_provider_stream(self):
        exact = get_candle_page("XAUUSDm", 60, limit=100)
        alias = get_candle_page("XAUUSD", 60, limit=100)
        self.assertEqual("XAUUSDm", alias["symbol"])
        self.assertEqual(exact["bars"], alias["bars"])

    def test_weekly_and_monthly_history_are_supported(self):
        weekly = get_candle_page("XAUUSDm", 10080, limit=100)
        monthly = get_candle_page("XAUUSDm", 43200, limit=100)
        self.assertEqual(100, len(weekly["bars"]))
        self.assertEqual(100, len(monthly["bars"]))
        self.assertEqual(10080, weekly["timeframe_minutes"])
        self.assertEqual(43200, monthly["timeframe_minutes"])
        weekly_open = datetime.fromtimestamp(weekly["bars"][-1]["time"], tz=timezone.utc)
        monthly_open = datetime.fromtimestamp(monthly["bars"][-1]["time"], tz=timezone.utc)
        self.assertEqual(0, weekly_open.weekday())
        self.assertEqual(1, monthly_open.day)

    def test_unknown_symbols_fail_instead_of_inventing_a_price_regime(self):
        with self.assertRaises(MarketDataError):
            get_candle_page("NOT_A_REAL_SYMBOL", 60, limit=100)

    def test_mixed_price_regimes_are_rejected(self):
        corrupt = [
            {"time": 1000, "open": 100, "high": 101, "low": 99, "close": 100, "tick_volume": 10},
            {"time": 1060, "open": 2400, "high": 2410, "low": 2390, "close": 2400, "tick_volume": 10},
        ]
        with self.assertRaises(MarketDataError):
            _validated_frame(corrupt, "XAUUSDm", 1)


if __name__ == "__main__":
    unittest.main()
