"""Asset screener — scans every configured symbol for the most recent
detected SMC structure (OB/FVG/BOS) and ranks them by a confidence score
derived from how many structures agree on the same direction. No fabricated
data: everything here comes from the same pattern-detection pipeline the
chart and Sage already use.
"""
import time
from config import AVAILABLE_SYMBOLS
from data import get_candles
from patterns import analyse_patterns
from mt5_client import get_quote

_cache: dict = {"time": 0, "timeframe": None, "data": []}
CACHE_TTL = 20  # seconds


def _scan_symbol(symbol: str, timeframe_minutes: int) -> dict | None:
    df = get_candles(symbol=symbol, timeframe_minutes=timeframe_minutes, limit=100)
    if df.empty:
        return None

    tf_patterns = analyse_patterns({"TF": df}).get("TF", {})
    quote = get_quote(symbol)

    events = []
    for o in tf_patterns.get("order_blocks", []):
        events.append(("OB", o["direction"], o["time"], (o["high"] + o["low"]) / 2))
    for f in tf_patterns.get("fvgs", []):
        events.append(("FVG", f["direction"], f["time"], (f["high"] + f["low"]) / 2))
    for b in tf_patterns.get("bos_mss", []):
        events.append(("BOS", b["direction"], b["time"], b["level"]))

    base = {
        "symbol": symbol,
        "last": quote.get("last"),
        "change_pct": quote.get("change_pct"),
        "digits": quote.get("digits", 5),
    }

    if not events:
        return {**base, "signal": None, "direction": None, "level": None, "confidence": 0}

    events.sort(key=lambda e: e[2], reverse=True)
    kind, direction, _, level = events[0]
    same_direction = sum(1 for e in events if e[1] == direction)
    confidence = min(100, same_direction * 20)

    return {
        **base,
        "signal": kind,
        "direction": direction,
        "level": round(level, 5),
        "confidence": confidence,
    }


def scan_market(timeframe_minutes: int = 60) -> list:
    now = time.time()
    if (now - _cache["time"] < CACHE_TTL
            and _cache["timeframe"] == timeframe_minutes
            and _cache["data"]):
        return _cache["data"]

    results = []
    for symbol in AVAILABLE_SYMBOLS:
        row = _scan_symbol(symbol, timeframe_minutes)
        if row:
            results.append(row)

    results.sort(key=lambda r: r.get("confidence") or 0, reverse=True)
    _cache["time"] = now
    _cache["timeframe"] = timeframe_minutes
    _cache["data"] = results
    return results
