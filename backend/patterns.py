import pandas as pd
import numpy as np
from indicators import detect_swings

def detect_order_blocks(df: pd.DataFrame) -> list:
    """
    Detect bullish and bearish order blocks.
    A bullish OB = last bearish candle before a strong bullish move.
    A bearish OB = last bullish candle before a strong bearish move.
    """
    obs = []
    df  = df.copy().reset_index(drop=True)

    for i in range(1, len(df) - 1):
        curr = df.iloc[i]
        next_c = df.iloc[i + 1]

        # Bullish OB: current candle is bearish, next is strongly bullish
        if curr["close"] < curr["open"]:
            move = next_c["close"] - next_c["open"]
            if move > 0 and (next_c["close"] - next_c["open"]) > (curr["open"] - curr["close"]):
                obs.append({
                    "kind"      : "OB",
                    "direction" : "BULLISH",
                    "high"      : float(curr["open"]),
                    "low"       : float(curr["close"]),
                    "time"      : str(curr["time"]),
                    "bar_index" : i,
                    "valid"     : True,
                })

        # Bearish OB: current candle is bullish, next is strongly bearish
        if curr["close"] > curr["open"]:
            move = next_c["open"] - next_c["close"]
            if move > 0 and (next_c["open"] - next_c["close"]) > (curr["close"] - curr["open"]):
                obs.append({
                    "kind"      : "OB",
                    "direction" : "BEARISH",
                    "high"      : float(curr["close"]),
                    "low"       : float(curr["open"]),
                    "time"      : str(curr["time"]),
                    "bar_index" : i,
                    "valid"     : True,
                })

    return obs[-10:]  # return last 10 only


def detect_fvg(df: pd.DataFrame) -> list:
    """
    Detect Fair Value Gaps (FVG) / Imbalances.
    Bullish FVG : candle[i-1].high < candle[i+1].low
    Bearish FVG : candle[i-1].low  > candle[i+1].high
    """
    fvgs = []
    df   = df.copy().reset_index(drop=True)

    for i in range(1, len(df) - 1):
        prev = df.iloc[i - 1]
        curr = df.iloc[i]
        nxt  = df.iloc[i + 1]

        # Bullish FVG
        if prev["high"] < nxt["low"]:
            fvgs.append({
                "kind"      : "FVG",
                "direction" : "BULLISH",
                "high"      : float(nxt["low"]),
                "low"       : float(prev["high"]),
                "time"      : str(curr["time"]),
                "bar_index" : i,
                "valid"     : True,
            })

        # Bearish FVG
        if prev["low"] > nxt["high"]:
            fvgs.append({
                "kind"      : "FVG",
                "direction" : "BEARISH",
                "high"      : float(prev["low"]),
                "low"       : float(nxt["high"]),
                "time"      : str(curr["time"]),
                "bar_index" : i,
                "valid"     : True,
            })

    return fvgs[-10:]  # return last 10 only


def detect_bos_mss(df: pd.DataFrame) -> list:
    """
    Detect Break of Structure (BOS) and Market Structure Shift (MSS).
    BOS = price closes beyond previous swing in trend direction.
    MSS = price closes beyond previous swing AGAINST trend direction.
    """
    events = []
    df     = detect_swings(df).reset_index(drop=True)

    swing_high_idx = df["swing_high"].dropna().index.tolist()
    swing_low_idx  = df["swing_low"].dropna().index.tolist()

    # Bullish BOS/MSS — close breaks above previous swing high
    for idx in swing_high_idx:
        level = df.at[idx, "swing_high"]
        future = df.iloc[idx + 1:]
        breaks = future[future["close"] > level]
        if not breaks.empty:
            first = breaks.iloc[0]
            events.append({
                "kind"      : "BOS",
                "direction" : "BULLISH",
                "level"     : float(level),
                "time"      : str(first["time"]),
                "bar_index" : int(breaks.index[0]),
            })

    # Bearish BOS/MSS — close breaks below previous swing low
    for idx in swing_low_idx:
        level = df.at[idx, "swing_low"]
        future = df.iloc[idx + 1:]
        breaks = future[future["close"] < level]
        if not breaks.empty:
            first = breaks.iloc[0]
            events.append({
                "kind"      : "BOS",
                "direction" : "BEARISH",
                "level"     : float(level),
                "time"      : str(first["time"]),
                "bar_index" : int(breaks.index[0]),
            })

    return events[-10:]  # return last 10 only


def analyse_patterns(tf_data: dict) -> dict:
    """Run all pattern detection across all timeframes."""
    results = {}
    for label, df in tf_data.items():
        if df.empty:
            continue
        results[label] = {
            "order_blocks" : detect_order_blocks(df),
            "fvgs"         : detect_fvg(df),
            "bos_mss"      : detect_bos_mss(df),
        }
        print(f"[PATTERNS] {label} | "
              f"OBs: {len(results[label]['order_blocks'])} | "
              f"FVGs: {len(results[label]['fvgs'])} | "
              f"BOS/MSS: {len(results[label]['bos_mss'])}")
    return results