import pandas as pd
import MetaTrader5 as mt5
from mt5_client import ensure_connected
from config import CANDLE_LIMIT, TIMEFRAMES, get_active_symbol

def get_candles(symbol: str | None = None, timeframe_minutes: int = 60, limit: int = CANDLE_LIMIT) -> pd.DataFrame:
    if symbol is None:
        symbol = get_active_symbol()

    if not ensure_connected():
        return pd.DataFrame()

    tf_map = {
        1    : mt5.TIMEFRAME_M1,
        5    : mt5.TIMEFRAME_M5,
        15   : mt5.TIMEFRAME_M15,
        30   : mt5.TIMEFRAME_M30,
        60   : mt5.TIMEFRAME_H1,
        240  : mt5.TIMEFRAME_H4,
        1440 : mt5.TIMEFRAME_D1,
    }

    tf = tf_map.get(timeframe_minutes)
    if tf is None:
        print(f"[DATA] Unknown timeframe: {timeframe_minutes}")
        return pd.DataFrame()

    rates = mt5.copy_rates_from_pos(symbol, tf, 0, limit)
    if (rates is None or len(rates) == 0) and symbol.endswith('m'):
        # Broker may not carry the 'm' variant — try without it
        fallback = symbol[:-1]
        print(f"[DATA] {symbol} returned no data, trying {fallback}")
        mt5.symbol_select(fallback, True)
        rates = mt5.copy_rates_from_pos(fallback, tf, 0, limit)
    if rates is None or len(rates) == 0:
        print(f"[DATA] No candles returned for {symbol} {timeframe_minutes}m")
        return pd.DataFrame()

    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")
    df.rename(columns={"tick_volume": "volume"}, inplace=True)
    return df[["time", "open", "high", "low", "close", "volume"]]


def get_all_timeframes(symbol: str | None = None) -> dict:
    if symbol is None:
        symbol = get_active_symbol()
    result = {}
    for label, minutes in TIMEFRAMES.items():
        df = get_candles(symbol=symbol, timeframe_minutes=minutes)
        if not df.empty:
            result[label] = df
            print(f"[DATA] {label}: {len(df)} candles OK")
        else:
            print(f"[DATA] {label}: failed")
    return result
