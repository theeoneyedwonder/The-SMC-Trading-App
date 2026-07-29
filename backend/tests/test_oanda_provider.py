import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import httpx

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ["SMC_MOCK"] = "1"

import market_providers
from market_providers import MarketProviderError


SETTINGS = {
    "account_id": "101-001-12345678-001",
    "access_token": "secret-test-token",
    "environment": "practice",
}


class OandaProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_credentials_are_validated_without_returning_the_token(self):
        async def handler(request):
            self.assertEqual("Bearer secret-test-token", request.headers["Authorization"])
            return httpx.Response(200, json={"account": {"currency": "USD", "alias": "Research"}})

        async with httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://api-fxpractice.oanda.com",
        ) as client:
            result = await market_providers.validate_oanda_credentials(SETTINGS, client)

        self.assertEqual("USD", result["currency"])
        self.assertNotIn("access_token", result)
        self.assertNotIn("secret-test-token", str(result))

    async def test_symbol_search_returns_oanda_identity(self):
        async def handler(_request):
            return httpx.Response(200, json={"instruments": [
                {"name": "EUR_USD", "displayName": "EUR/USD", "type": "CURRENCY"},
                {"name": "XAU_USD", "displayName": "Gold", "type": "METAL"},
            ]})

        with patch.object(market_providers, "get_oanda_settings", return_value=SETTINGS):
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(handler),
                base_url="https://api-fxpractice.oanda.com",
            ) as client:
                result = await market_providers.search_oanda_symbols("gold", client=client)

        self.assertEqual(1, len(result))
        self.assertEqual("XAU_USD", result[0]["symbol"])
        self.assertEqual("OANDA:XAUUSD", result[0]["display_symbol"])

    async def test_candle_page_is_ordered_paginated_and_provider_tagged(self):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        candles = []
        for index in range(1001):
            price = 4000 + index * 0.1
            candles.append({
                "time": (start + timedelta(hours=index)).isoformat().replace("+00:00", "Z"),
                "volume": 100 + index,
                "complete": True,
                "mid": {
                    "o": f"{price:.3f}",
                    "h": f"{price + 1:.3f}",
                    "l": f"{price - 1:.3f}",
                    "c": f"{price + .2:.3f}",
                },
            })

        async def handler(request):
            self.assertEqual("1001", request.url.params["count"])
            self.assertEqual("H1", request.url.params["granularity"])
            return httpx.Response(200, json={"instrument": "XAU_USD", "candles": candles})

        with patch.object(market_providers, "get_oanda_settings", return_value=SETTINGS):
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(handler),
                base_url="https://api-fxpractice.oanda.com",
            ) as client:
                page = await market_providers.get_oanda_candle_page("XAU_USD", "H1", 1000, client=client)

        self.assertEqual("oanda", page["provider"])
        self.assertEqual("OANDA:XAUUSD", page["display_symbol"])
        self.assertEqual(1000, len(page["bars"]))
        self.assertTrue(page["has_more"])
        self.assertEqual(page["bars"][0]["time"], page["next_before"])
        self.assertLess(page["bars"][0]["time"], page["bars"][-1]["time"])

    async def test_oanda_history_cursor_is_strict_disjoint_and_advances(self):
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        candles = []
        for index in range(2001):
            stamp = start + timedelta(hours=index)
            price = 3900 + index * 0.05
            candles.append({
                "time": stamp.isoformat().replace("+00:00", "Z"),
                "volume": 50,
                "complete": True,
                "mid": {
                    "o": str(price), "h": str(price + 1),
                    "l": str(price - 1), "c": str(price + .1),
                },
            })

        async def handler(request):
            eligible = candles
            if request.url.params.get("to"):
                boundary = datetime.fromisoformat(request.url.params["to"].replace("Z", "+00:00"))
                eligible = [item for item in candles if datetime.fromisoformat(item["time"].replace("Z", "+00:00")) <= boundary]
            count = int(request.url.params["count"])
            return httpx.Response(200, json={"instrument": "XAU_USD", "candles": eligible[-count:]})

        with patch.object(market_providers, "get_oanda_settings", return_value=SETTINGS):
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(handler),
                base_url="https://api-fxpractice.oanda.com",
            ) as client:
                latest = await market_providers.get_oanda_candle_page("XAU_USD", "H1", 250, client=client)
                older = await market_providers.get_oanda_candle_page(
                    "XAU_USD", "H1", 250, before=latest["next_before"], client=client,
                )

        self.assertEqual(250, len(latest["bars"]))
        self.assertEqual(250, len(older["bars"]))
        self.assertLess(older["bars"][-1]["time"], latest["bars"][0]["time"])
        self.assertLess(older["next_before"], latest["next_before"])
        self.assertTrue(older["has_more"])

    async def test_corrupt_oanda_price_regime_is_rejected(self):
        candles = [
            {
                "time": "2026-01-01T00:00:00Z", "volume": 1,
                "mid": {"o": "100", "h": "101", "l": "99", "c": "100"},
            },
            {
                "time": "2026-01-01T01:00:00Z", "volume": 1,
                "mid": {"o": "4000", "h": "4001", "l": "3999", "c": "4000"},
            },
        ]

        async def handler(_request):
            return httpx.Response(200, json={"instrument": "XAU_USD", "candles": candles})

        with patch.object(market_providers, "get_oanda_settings", return_value=SETTINGS):
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(handler),
                base_url="https://api-fxpractice.oanda.com",
            ) as client:
                with self.assertRaises(MarketProviderError):
                    await market_providers.get_oanda_candle_page("XAU_USD", "H1", 50, client=client)


if __name__ == "__main__":
    unittest.main()
