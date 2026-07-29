"""Validated, provider-neutral candle access.

The chart consumes time-cursor pages rather than MT5's positional offsets.
That matters because position 0 moves whenever a new bar opens; an offset
request made a few seconds later can therefore overlap or skip history.
"""
from __future__ import annotations

import importlib
import math
import os
import re
from datetime import datetime, timezone

import pandas as pd

mt5 = importlib.import_module("mt5_mock" if os.environ.get("SMC_MOCK") == "1" else "MetaTrader5")

from config import CANDLE_LIMIT, TIMEFRAMES, get_active_symbol
from mt5_client import ensure_connected, _mt5_lock


class MarketDataError(RuntimeError):
    """A candle request could not be fulfilled without risking bad data."""


def _symbol_key(symbol: str) -> str:
    """Match common broker suffix variants, but only when the match is unique."""
    value = re.sub(r"[^A-Z0-9]", "", symbol.upper())
    for suffix in ("PRO", "RAW", "ECN", "MINI", "MICRO", "M", "I", "A", "R", "S"):
        if value.endswith(suffix) and len(value) > len(suffix) + 5:
            return value[: -len(suffix)]
    return value


def resolve_symbol(symbol: str) -> str:
    """Resolve a requested name to one exact provider symbol.

    We never blindly strip a suffix and retry. That old behaviour could fetch
    candles from one instrument while the tick socket streamed another.
    """
    requested = (symbol or "").strip()
    if not requested:
        raise MarketDataError("A symbol is required")
    if not ensure_connected():
        raise MarketDataError("Market-data provider is disconnected")

    with _mt5_lock:
        raw = mt5.symbols_get()
        names = [item.name for item in raw] if raw else []

        if requested in names:
            resolved = requested
        else:
            case_matches = [name for name in names if name.casefold() == requested.casefold()]
            if len(case_matches) == 1:
                resolved = case_matches[0]
            else:
                key = _symbol_key(requested)
                aliases = [name for name in names if _symbol_key(name) == key]
                if len(aliases) != 1:
                    raise MarketDataError(
                        f"Symbol {requested!r} is unavailable or ambiguous on this provider"
                    )
                resolved = aliases[0]

        if not mt5.symbol_select(resolved, True):
            raise MarketDataError(f"Provider refused symbol {resolved!r}")
    return resolved


def _timeframe_constant(timeframe_minutes: int):
    names = {
        1: "TIMEFRAME_M1",
        5: "TIMEFRAME_M5",
        15: "TIMEFRAME_M15",
        30: "TIMEFRAME_M30",
        60: "TIMEFRAME_H1",
        240: "TIMEFRAME_H4",
        1440: "TIMEFRAME_D1",
        10080: "TIMEFRAME_W1",
        43200: "TIMEFRAME_MN1",
    }
    name = names.get(timeframe_minutes)
    value = getattr(mt5, name, None) if name else None
    if value is None:
        raise MarketDataError(f"Unsupported timeframe: {timeframe_minutes} minutes")
    return value


def _validated_frame(rates, symbol: str, timeframe_minutes: int) -> pd.DataFrame:
    if rates is None or len(rates) == 0:
        return pd.DataFrame(columns=["time", "open", "high", "low", "close", "volume"])

    frame = pd.DataFrame(rates)
    required = {"time", "open", "high", "low", "close", "tick_volume"}
    if not required.issubset(frame.columns):
        missing = ", ".join(sorted(required - set(frame.columns)))
        raise MarketDataError(f"Provider returned malformed {symbol} data (missing {missing})")

    frame = frame[["time", "open", "high", "low", "close", "tick_volume"]].copy()
    frame.rename(columns={"tick_volume": "volume"}, inplace=True)
    frame.drop_duplicates(subset="time", keep="last", inplace=True)
    frame.sort_values("time", inplace=True)

    numeric_columns = ["time", "open", "high", "low", "close", "volume"]
    for column in numeric_columns:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    if frame[numeric_columns].isna().any().any():
        raise MarketDataError(f"Provider returned non-numeric {symbol} candles")
    if not all(math.isfinite(float(value)) for value in frame[numeric_columns].to_numpy().flat):
        raise MarketDataError(f"Provider returned non-finite {symbol} candles")

    invalid = (
        (frame["time"] <= 0)
        | (frame[["open", "high", "low", "close"]] <= 0).any(axis=1)
        | (frame["high"] < frame[["open", "close"]].max(axis=1))
        | (frame["low"] > frame[["open", "close"]].min(axis=1))
        | (frame["high"] < frame["low"])
    )
    if invalid.any():
        raise MarketDataError(f"Provider returned invalid OHLC values for {symbol}")

    # A 4x adjacent close jump is not a market move; it is almost certainly a
    # mixed symbol/provider stream. Reject the whole page instead of drawing it.
    ratios = frame["close"].pct_change().add(1).dropna()
    if ((ratios > 4.0) | (ratios < 0.25)).any():
        raise MarketDataError(f"Provider returned incompatible price regimes for {symbol}")

    frame["time"] = pd.to_datetime(frame["time"].astype("int64"), unit="s", utc=True)
    return frame.reset_index(drop=True)


def get_candle_page(
    symbol: str | None = None,
    timeframe_minutes: int = 60,
    limit: int = 1000,
    before: int | None = None,
) -> dict:
    """Return the newest `limit` bars strictly before `before` (UTC epoch).

    The extra requested bar provides a trustworthy `has_more` cursor without
    guessing from page length. Returned bars are always oldest to newest.
    """
    requested = symbol or get_active_symbol()
    resolved = resolve_symbol(requested)
    timeframe = _timeframe_constant(timeframe_minutes)
    limit = max(50, min(int(limit), 5000))
    requested_count = limit + 1

    with _mt5_lock:
        if before is None:
            rates = mt5.copy_rates_from_pos(resolved, timeframe, 0, requested_count)
        else:
            try:
                cursor = int(before)
            except (TypeError, ValueError) as exc:
                raise MarketDataError("History cursor must be a UTC epoch timestamp") from exc
            if cursor <= 0:
                raise MarketDataError("History cursor must be positive")
            # MT5 copy_rates_from is inclusive, hence cursor - 1.
            utc_before = datetime.fromtimestamp(cursor - 1, tz=timezone.utc)
            rates = mt5.copy_rates_from(resolved, timeframe, utc_before, requested_count)

    frame = _validated_frame(rates, resolved, timeframe_minutes)
    has_more = len(frame) > limit
    if has_more:
        frame = frame.iloc[-limit:].reset_index(drop=True)

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
        "requested_symbol": requested,
        "symbol": resolved,
        "timeframe_minutes": timeframe_minutes,
        "bars": bars,
        "next_before": bars[0]["time"] if has_more and bars else None,
        "has_more": has_more,
    }


def get_candles(
    symbol: str | None = None,
    timeframe_minutes: int = 60,
    limit: int = CANDLE_LIMIT,
    offset: int = 0,
) -> pd.DataFrame:
    """Compatibility adapter for analysis code that still requests a frame."""
    before = None
    if offset:
        # Offset callers are legacy background analysis code. Fetch enough in
        # one stable snapshot, then slice; the chart itself never uses offsets.
        page = get_candle_page(symbol, timeframe_minutes, limit + offset)
        bars = page["bars"][: max(0, len(page["bars"]) - offset)]
        bars = bars[-limit:]
    else:
        bars = get_candle_page(symbol, timeframe_minutes, limit)["bars"]
    if not bars:
        return pd.DataFrame()
    frame = pd.DataFrame(bars)
    frame["time"] = pd.to_datetime(frame["time"], unit="s", utc=True).dt.tz_localize(None)
    return frame[["time", "open", "high", "low", "close", "volume"]]


def get_all_timeframes(symbol: str | None = None) -> dict:
    requested = symbol or get_active_symbol()
    result = {}
    for label, minutes in TIMEFRAMES.items():
        try:
            frame = get_candles(symbol=requested, timeframe_minutes=minutes)
        except MarketDataError as exc:
            print(f"[DATA] {label}: {exc}")
            continue
        if not frame.empty:
            result[label] = frame
            print(f"[DATA] {label}: {len(frame)} candles OK")
        else:
            print(f"[DATA] {label}: no history")
    return result
