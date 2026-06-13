import pandas as pd
import numpy as np
from config import EMA_PERIOD, SWING_LOOKBACK

def calculate_ema(df: pd.DataFrame, period: int = EMA_PERIOD) -> pd.DataFrame:
    """Add EMA column to dataframe."""
    df = df.copy()
    df[f"ema_{period}"] = df["close"].ewm(span=period, adjust=False).mean()
    return df

def get_bias(df: pd.DataFrame, period: int = EMA_PERIOD) -> str:
    """Return BULLISH, BEARISH or NEUTRAL based on last close vs EMA."""
    if df.empty or len(df) < period:
        return "NEUTRAL"
    df = calculate_ema(df, period)
    last_close = df["close"].iloc[-1]
    last_ema   = df[f"ema_{period}"].iloc[-1]
    if last_close > last_ema:
        return "BULLISH"
    elif last_close < last_ema:
        return "BEARISH"
    return "NEUTRAL"

def detect_swings(df: pd.DataFrame, lookback: int = SWING_LOOKBACK) -> pd.DataFrame:
    """
    Detect swing highs and lows.
    Adds columns: swing_high (price or NaN), swing_low (price or NaN)
    """
    df = df.copy()
    df["swing_high"] = np.nan
    df["swing_low"]  = np.nan

    for i in range(lookback, len(df) - lookback):
        window_high = df["high"].iloc[i - lookback : i + lookback + 1]
        window_low  = df["low"].iloc[i - lookback  : i + lookback + 1]

        if df["high"].iloc[i] == window_high.max():
            df.at[df.index[i], "swing_high"] = df["high"].iloc[i]

        if df["low"].iloc[i] == window_low.min():
            df.at[df.index[i], "swing_low"] = df["low"].iloc[i]

    return df

def detect_market_structure(df: pd.DataFrame) -> dict:
    """
    Identify HH, HL, LH, LL from swing points.
    Returns a dict with trend and last two swing highs/lows.
    """
    df = detect_swings(df)

    swing_highs = df["swing_high"].dropna().values
    swing_lows  = df["swing_low"].dropna().values

    if len(swing_highs) < 2 or len(swing_lows) < 2:
        return {
            "trend"   : "UNDETERMINED",
            "last_hh" : None,
            "last_hl" : None,
            "last_lh" : None,
            "last_ll" : None,
        }

    last_high  = swing_highs[-1]
    prev_high  = swing_highs[-2]
    last_low   = swing_lows[-1]
    prev_low   = swing_lows[-2]

    hh = last_high > prev_high
    hl = last_low  > prev_low
    lh = last_high < prev_high
    ll = last_low  < prev_low

    if hh and hl:
        trend = "BULLISH"
    elif lh and ll:
        trend = "BEARISH"
    else:
        trend = "RANGING"

    return {
        "trend"    : trend,
        "last_hh"  : float(last_high) if hh else None,
        "last_hl"  : float(last_low)  if hl else None,
        "last_lh"  : float(last_high) if lh else None,
        "last_ll"  : float(last_low)  if ll else None,
    }

def analyse_all_timeframes(tf_data: dict) -> dict:
    """Run full structure analysis across all timeframes."""
    results = {}
    for label, df in tf_data.items():
        if df.empty:
            continue
        bias      = get_bias(df)
        structure = detect_market_structure(df)
        results[label] = {
            "bias"     : bias,
            "structure": structure,
        }
        print(f"[INDICATORS] {label} | bias: {bias} | trend: {structure['trend']}")
    return results