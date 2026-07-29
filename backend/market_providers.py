"""External analysis-market providers.

Execution remains owned by :mod:`mt5_client`.  This module deliberately only
exposes read-only market data so selecting an analysis feed can never reroute
an order.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator

import httpx

from config import get_oanda_settings, oanda_is_configured
from data import MarketDataError, _validated_frame


class MarketProviderError(MarketDataError):
    """A named analysis provider could not safely fulfil a request."""


OANDA_REST_URLS = {
    "practice": "https://api-fxpractice.oanda.com",
    "live": "https://api-fxtrade.oanda.com",
}
OANDA_STREAM_URLS = {
    "practice": "https://stream-fxpractice.oanda.com",
    "live": "https://stream-fxtrade.oanda.com",
}
OANDA_GRANULARITIES = {
    "M1": "M1",
    "M5": "M5",
    "M15": "M15",
    "M30": "M30",
    "H1": "H1",
    "H4": "H4",
    "D1": "D",
    "W1": "W",
    "MN1": "M",
}
TIMEFRAME_MINUTES = {
    "M1": 1,
    "M5": 5,
    "M15": 15,
    "M30": 30,
    "H1": 60,
    "H4": 240,
    "D1": 1440,
    "W1": 10080,
    "MN1": 43200,
}

_ACCOUNT_RE = re.compile(r"^[A-Za-z0-9-]+$")
_INSTRUMENT_RE = re.compile(r"^[A-Za-z0-9_.-]+$")


def _settings(override: dict | None = None) -> dict:
    value = dict(override or get_oanda_settings())
    environment = value.get("environment", "practice")
    if environment not in OANDA_REST_URLS:
        raise MarketProviderError("Unknown OANDA environment")
    account_id = str(value.get("account_id", "")).strip()
    token = str(value.get("access_token", "")).strip()
    if not account_id or not token:
        raise MarketProviderError("OANDA is not configured. Add an account ID and access token in Settings.")
    if not _ACCOUNT_RE.fullmatch(account_id):
        raise MarketProviderError("OANDA account ID contains unsupported characters")
    return {"environment": environment, "account_id": account_id, "access_token": token}


def _instrument(value: str) -> str:
    symbol = (value or "").strip().upper()
    if not symbol or not _INSTRUMENT_RE.fullmatch(symbol):
        raise MarketProviderError("Invalid OANDA instrument")
    return symbol


def _headers(settings: dict) -> dict:
    return {
        "Authorization": f"Bearer {settings['access_token']}",
        "Accept-Datetime-Format": "RFC3339",
        "Content-Type": "application/json",
    }


def _safe_oanda_error(response: httpx.Response) -> str:
    try:
        body = response.json()
        detail = body.get("errorMessage") or body.get("message") or body.get("errorCode")
        if detail:
            return str(detail)[:300]
    except Exception:
        pass
    return f"OANDA request failed ({response.status_code})"


def _check_response(response: httpx.Response) -> None:
    if response.status_code >= 400:
        raise MarketProviderError(_safe_oanda_error(response))


def _owned_client(client: httpx.AsyncClient | None, base_url: str, settings: dict):
    if client is not None:
        return client, False
    return httpx.AsyncClient(base_url=base_url, headers=_headers(settings), timeout=20.0), True


async def validate_oanda_credentials(
    settings_override: dict | None = None,
    client: httpx.AsyncClient | None = None,
) -> dict:
    settings = _settings(settings_override)
    http, owned = _owned_client(client, OANDA_REST_URLS[settings["environment"]], settings)
    try:
        response = await http.get(
            f"/v3/accounts/{settings['account_id']}/summary",
            headers=_headers(settings),
        )
        _check_response(response)
        account = response.json().get("account") or {}
        return {
            "account_id": settings["account_id"],
            "environment": settings["environment"],
            "currency": account.get("currency"),
            "alias": account.get("alias"),
        }
    except MarketProviderError:
        raise
    except MarketDataError as exc:
        raise MarketProviderError(str(exc)) from exc
    except httpx.HTTPError as exc:
        raise MarketProviderError(f"Could not reach OANDA: {exc}") from exc
    finally:
        if owned:
            await http.aclose()


async def search_oanda_symbols(
    query: str = "",
    limit: int = 40,
    client: httpx.AsyncClient | None = None,
) -> list[dict]:
    settings = _settings()
    http, owned = _owned_client(client, OANDA_REST_URLS[settings["environment"]], settings)
    try:
        response = await http.get(
            f"/v3/accounts/{settings['account_id']}/instruments",
            headers=_headers(settings),
        )
        _check_response(response)
        needle = query.strip().casefold()
        matches = []
        for raw in response.json().get("instruments") or []:
            name = str(raw.get("name") or "").strip()
            display = str(raw.get("displayName") or name).strip()
            if not name:
                continue
            haystack = f"{name} {display} {raw.get('type', '')}".casefold()
            if needle and needle not in haystack:
                continue
            matches.append({
                "symbol": name,
                "display_symbol": f"OANDA:{name.replace('_', '')}",
                "name": display,
                "type": raw.get("type"),
            })
        matches.sort(key=lambda item: (
            not item["symbol"].casefold().startswith(needle) if needle else False,
            item["symbol"],
        ))
        return matches[: max(1, min(int(limit), 100))]
    except MarketProviderError:
        raise
    except httpx.HTTPError as exc:
        raise MarketProviderError(f"Could not reach OANDA: {exc}") from exc
    finally:
        if owned:
            await http.aclose()


async def get_oanda_candle_page(
    symbol: str,
    timeframe: str,
    limit: int = 1000,
    before: int | None = None,
    client: httpx.AsyncClient | None = None,
) -> dict:
    requested = _instrument(symbol)
    granularity = OANDA_GRANULARITIES.get(timeframe)
    if not granularity:
        raise MarketProviderError(f"Unsupported OANDA timeframe: {timeframe}")

    settings = _settings()
    # OANDA permits at most 5,000 candles. One extra candle is reserved for a
    # trustworthy has_more cursor.
    page_limit = max(50, min(int(limit), 4999))
    params: dict[str, str | int] = {
        "price": "M",
        "granularity": granularity,
        "count": page_limit + 1,
        "smooth": "false",
    }
    cursor = None
    if before is not None:
        try:
            cursor = int(before)
        except (TypeError, ValueError) as exc:
            raise MarketProviderError("History cursor must be a UTC epoch timestamp") from exc
        if cursor <= 0:
            raise MarketProviderError("History cursor must be positive")
        # Move just before the cursor so the extra has_more candle is not
        # consumed if the upstream boundary ever behaves inclusively.
        exclusive_to = datetime.fromtimestamp(cursor, tz=timezone.utc) - timedelta(microseconds=1)
        params["to"] = exclusive_to.isoformat().replace("+00:00", "Z")

    http, owned = _owned_client(client, OANDA_REST_URLS[settings["environment"]], settings)
    try:
        response = await http.get(
            f"/v3/instruments/{requested}/candles",
            params=params,
            headers=_headers(settings),
        )
        _check_response(response)
        payload = response.json()
        resolved = _instrument(payload.get("instrument") or requested)
        raw_rates = []
        for candle in payload.get("candles") or []:
            mid = candle.get("mid") or {}
            try:
                timestamp = int(datetime.fromisoformat(str(candle["time"]).replace("Z", "+00:00")).timestamp())
            except (KeyError, TypeError, ValueError) as exc:
                raise MarketProviderError(f"OANDA returned a malformed {resolved} candle timestamp") from exc
            # Enforce strict cursor semantics ourselves even if an upstream API
            # changes the inclusivity of its `to` boundary.
            if cursor is not None and timestamp >= cursor:
                continue
            raw_rates.append({
                "time": timestamp,
                "open": mid.get("o"),
                "high": mid.get("h"),
                "low": mid.get("l"),
                "close": mid.get("c"),
                "tick_volume": candle.get("volume", 0),
            })

        frame = _validated_frame(raw_rates, resolved, TIMEFRAME_MINUTES[timeframe])
        has_more = len(frame) > page_limit
        if has_more:
            frame = frame.iloc[-page_limit:].reset_index(drop=True)
        bars = [
            {
                "time": int(row.time.timestamp()),
                "open": float(row.open),
                "high": float(row.high),
                "low": float(row.low),
                "close": float(row.close),
                "volume": int(row.volume),
            }
            for row in frame.itertuples(index=False)
        ]
        return {
            "provider": "oanda",
            "requested_symbol": requested,
            "symbol": resolved,
            "display_symbol": f"OANDA:{resolved.replace('_', '')}",
            "timeframe_minutes": TIMEFRAME_MINUTES[timeframe],
            "bars": bars,
            "next_before": bars[0]["time"] if has_more and bars else None,
            "has_more": has_more,
        }
    except MarketProviderError:
        raise
    except MarketDataError as exc:
        raise MarketProviderError(str(exc)) from exc
    except httpx.HTTPError as exc:
        raise MarketProviderError(f"Could not reach OANDA: {exc}") from exc
    finally:
        if owned:
            await http.aclose()


async def get_oanda_tick(symbol: str, client: httpx.AsyncClient | None = None) -> dict:
    requested = _instrument(symbol)
    settings = _settings()
    http, owned = _owned_client(client, OANDA_REST_URLS[settings["environment"]], settings)
    try:
        response = await http.get(
            f"/v3/accounts/{settings['account_id']}/pricing",
            params={"instruments": requested},
            headers=_headers(settings),
        )
        _check_response(response)
        prices = response.json().get("prices") or []
        if not prices:
            raise MarketProviderError(f"OANDA returned no live price for {requested}")
        return _parse_oanda_price(prices[0], requested)
    except MarketProviderError:
        raise
    except httpx.HTTPError as exc:
        raise MarketProviderError(f"Could not reach OANDA: {exc}") from exc
    finally:
        if owned:
            await http.aclose()


def _parse_oanda_price(payload: dict, expected_symbol: str) -> dict:
    symbol = _instrument(payload.get("instrument") or expected_symbol)
    bids = payload.get("bids") or []
    asks = payload.get("asks") or []
    try:
        bid = float(bids[0]["price"])
        ask = float(asks[0]["price"])
        timestamp = int(datetime.fromisoformat(str(payload["time"]).replace("Z", "+00:00")).timestamp())
    except (IndexError, KeyError, TypeError, ValueError) as exc:
        raise MarketProviderError(f"OANDA returned a malformed live price for {symbol}") from exc
    if bid <= 0 or ask <= 0 or bid > ask:
        raise MarketProviderError(f"OANDA returned an invalid bid/ask for {symbol}")
    return {"provider": "oanda", "symbol": symbol, "bid": bid, "ask": ask, "time": timestamp}


async def stream_oanda_prices(symbol: str) -> AsyncIterator[dict]:
    requested = _instrument(symbol)
    settings = _settings()
    url = f"{OANDA_STREAM_URLS[settings['environment']]}/v3/accounts/{settings['account_id']}/pricing/stream"
    try:
        async with httpx.AsyncClient(headers=_headers(settings), timeout=None) as client:
            async with client.stream("GET", url, params={"instruments": requested}) as response:
                _check_response(response)
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    payload = json.loads(line)
                    if payload.get("type") == "PRICE":
                        yield _parse_oanda_price(payload, requested)
    except MarketProviderError:
        raise
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        raise MarketProviderError(f"OANDA price stream failed: {exc}") from exc


def oanda_status() -> dict:
    settings = get_oanda_settings()
    return {
        "configured": oanda_is_configured(),
        "account_id": settings["account_id"],
        "environment": settings["environment"],
    }
