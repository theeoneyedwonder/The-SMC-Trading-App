"""Drop-in fake for the `MetaTrader5` package, used when SMC_MOCK=1.

The real `MetaTrader5` package only installs on Windows, so none of this
backend can even start on Linux/Mac without it. Every other file
(mt5_client.py, data.py, history_sync.py, main.py) imports MetaTrader5
purely as `mt5` and only calls the handful of functions below — so this
module fakes just that surface with synthetic data, letting every other
line of connection-handling / pattern-detection / data-shaping logic run
completely unmodified against it. Nothing here is used in production
Windows builds; it's opt-in via the SMC_MOCK env var.
"""
import hashlib
import math
import time
from datetime import datetime, timezone
from types import SimpleNamespace

import numpy as np

# ── Constants (values just need to be internally consistent) ───
TIMEFRAME_M1, TIMEFRAME_M5, TIMEFRAME_M15, TIMEFRAME_M30 = 1, 5, 15, 30
TIMEFRAME_H1, TIMEFRAME_H4, TIMEFRAME_D1 = 60, 240, 1440
TIMEFRAME_W1, TIMEFRAME_MN1 = 10080, 43200

ORDER_TYPE_BUY, ORDER_TYPE_SELL = 0, 1
ORDER_FILLING_FOK, ORDER_FILLING_IOC, ORDER_FILLING_RETURN = 0, 1, 2
ORDER_TIME_GTC = 0
TRADE_ACTION_DEAL = 1
TRADE_ACTION_SLTP = 6
TRADE_RETCODE_DONE = 10009

_RATES_DTYPE = [
    ('time', 'i8'), ('open', 'f8'), ('high', 'f8'), ('low', 'f8'), ('close', 'f8'),
    ('tick_volume', 'i8'), ('spread', 'i4'), ('real_volume', 'i8'),
]

# Base price + per-symbol volatility, so different instruments feel distinct.
_SEED_PRICE = {
    'XAUUSDm': 2400.0, 'XAGUSDm': 29.0, 'EURUSDm': 1.085, 'GBPUSDm': 1.27,
    'USDJPYm': 155.0, 'BTCUSDm': 64000.0, 'NAS100m': 18500.0, 'US30m': 39000.0,
}
_DIGITS = {
    'XAUUSDm': 2, 'XAGUSDm': 3, 'EURUSDm': 5, 'GBPUSDm': 5,
    'USDJPYm': 3, 'BTCUSDm': 2, 'NAS100m': 1, 'US30m': 1,
}

_connected = False
_account = SimpleNamespace(
    login=99999999, name="Demo Trader", balance=10000.0, currency="USD",
    leverage=100, server="MockServer-Demo", company="Mock Broker Ltd",
)
_positions: list = []
_next_ticket = 1000

def _canonical_symbol(symbol: str) -> str | None:
    if symbol in _SEED_PRICE:
        return symbol
    folded = symbol.casefold()
    exact = [name for name in _SEED_PRICE if name.casefold() == folded]
    if len(exact) == 1:
        return exact[0]
    bare = folded.rstrip("m")
    aliases = [name for name in _SEED_PRICE if name.casefold().rstrip("m") == bare]
    return aliases[0] if len(aliases) == 1 else None


def _digits(symbol: str) -> int:
    canonical = _canonical_symbol(symbol)
    return _DIGITS.get(canonical, 5)


def _unit_noise(symbol: str, index: int, layer: int) -> float:
    payload = f"{symbol}:{index}:{layer}".encode("utf-8")
    raw = int.from_bytes(hashlib.blake2b(payload, digest_size=8).digest(), "big")
    return (raw / ((1 << 64) - 1)) * 2.0 - 1.0


def _smooth_noise(symbol: str, timestamp: float, step: int, layer: int) -> float:
    position = timestamp / step
    left = math.floor(position)
    mix = position - left
    # Smoothstep avoids sharp corners at grid boundaries.
    mix = mix * mix * (3.0 - 2.0 * mix)
    a = _unit_noise(symbol, left, layer)
    b = _unit_noise(symbol, left + 1, layer)
    return a + (b - a) * mix


def _price_at(symbol: str, timestamp: float) -> float:
    """One deterministic continuous stream shared by every timeframe."""
    canonical = _canonical_symbol(symbol)
    if canonical is None:
        return 0.0
    base = _SEED_PRICE[canonical]
    days = (timestamp - 1704067200) / 86400.0  # 2024-01-01 UTC anchor
    phase = (_unit_noise(canonical, 0, 99) + 1.0) * math.pi
    log_move = (
        0.000025 * days
        + 0.025 * math.sin(days / 17.0 + phase)
        + 0.012 * math.sin(days / 4.7 + phase * 0.37)
        + 0.010 * _smooth_noise(canonical, timestamp, 86400, 1)
        + 0.0035 * _smooth_noise(canonical, timestamp, 3600, 2)
        + 0.0008 * _smooth_noise(canonical, timestamp, 300, 3)
    )
    return base * math.exp(log_move)


def _bucket_start(timestamp: int, timeframe: int) -> int:
    if timeframe == TIMEFRAME_W1:
        monday_epoch = 4 * 86400  # 1970-01-05 00:00 UTC
        return ((timestamp - monday_epoch) // (7 * 86400)) * (7 * 86400) + monday_epoch
    if timeframe == TIMEFRAME_MN1:
        value = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        return int(datetime(value.year, value.month, 1, tzinfo=timezone.utc).timestamp())
    period = timeframe * 60
    return timestamp // period * period


def _shift_bucket(start: int, timeframe: int, amount: int) -> int:
    if timeframe != TIMEFRAME_MN1:
        return start + amount * timeframe * 60
    value = datetime.fromtimestamp(start, tz=timezone.utc)
    month_index = value.year * 12 + value.month - 1 + amount
    year, month_zero = divmod(month_index, 12)
    return int(datetime(year, month_zero + 1, 1, tzinfo=timezone.utc).timestamp())


def _bar(symbol: str, minutes: int, start: int, now: int | None = None) -> dict:
    natural_end = _shift_bucket(start, minutes, 1)
    end = min(natural_end, now) if now is not None else natural_end
    end = max(start, end)
    samples = 5 if minutes <= 5 else 9 if minutes <= 240 else 17 if minutes <= 10080 else 33
    points = [
        _price_at(symbol, start + (end - start) * i / (samples - 1))
        for i in range(samples)
    ]
    opening, closing = points[0], points[-1]
    wick = opening * (0.00004 + 0.00002 * abs(_unit_noise(symbol, start, minutes)))
    volume_base = max(20, int(80 * math.sqrt(max(minutes, 1))))
    volume = int(volume_base * (1.0 + abs(_unit_noise(symbol, start, 7))))
    return {
        "time": start,
        "open": opening,
        "high": max(points) + wick,
        "low": max(0.0000001, min(points) - wick),
        "close": closing,
        "tick_volume": volume,
    }


def _rates(symbol: str, timeframe: int, newest_bucket: int, count: int, now: int | None = None):
    canonical = _canonical_symbol(symbol)
    if canonical is None or count <= 0:
        return np.array([], dtype=_RATES_DTYPE)
    starts = [_shift_bucket(newest_bucket, timeframe, offset) for offset in range(-(count - 1), 1)]
    bars = [_bar(canonical, timeframe, start, now) for start in starts]
    return np.array(
        [(b["time"], b["open"], b["high"], b["low"], b["close"], b["tick_volume"], 1, 0) for b in bars],
        dtype=_RATES_DTYPE,
    )


def _current_price(symbol: str) -> float:
    return _price_at(symbol, time.time())


# ── Public fake mt5.* API ───────────────────────────────────────
def initialize(login=None, password=None, server=None, timeout=None) -> bool:
    global _connected
    _connected = True
    if login:
        _account.login = int(login)
    if server:
        _account.server = server
    return True


def shutdown():
    global _connected
    _connected = False


def terminal_info():
    return SimpleNamespace(connected=_connected)


def last_error():
    return (1, "Mock mode — no real error")


def account_info():
    if not _connected:
        return None
    floating = sum(p.profit for p in _positions)
    equity = _account.balance + floating
    return SimpleNamespace(
        login=_account.login, name=_account.name, balance=_account.balance,
        equity=equity, margin=0.0, margin_free=equity, profit=floating,
        currency=_account.currency, leverage=_account.leverage,
        server=_account.server, company=_account.company,
    )


def symbol_select(symbol, enable=True) -> bool:
    return _canonical_symbol(symbol) is not None


def symbol_info(symbol):
    if _canonical_symbol(symbol) is None:
        return None
    return SimpleNamespace(
        bid=_current_price(symbol), ask=_current_price(symbol) * 1.0002,
        digits=_digits(symbol), filling_mode=1,
    )


def symbol_info_tick(symbol):
    if _canonical_symbol(symbol) is None:
        return None
    price = _current_price(symbol)
    spread = price * 0.0002
    return SimpleNamespace(bid=price, ask=price + spread, time=int(time.time()))


def symbols_get():
    return [SimpleNamespace(name=s, visible=True) for s in _SEED_PRICE]


def copy_rates_from_pos(symbol, timeframe, start_pos, count):
    now = int(time.time())
    current_bucket = _bucket_start(now, timeframe)
    newest = _shift_bucket(current_bucket, timeframe, -max(0, int(start_pos)))
    return _rates(symbol, timeframe, newest, int(count), now=now)


def copy_rates_from(symbol, timeframe, date_from, count):
    timestamp = int(date_from.timestamp())
    newest = _bucket_start(timestamp, timeframe)
    return _rates(symbol, timeframe, newest, int(count))


def positions_get(symbol=None):
    for p in _positions:
        price = _current_price(p.symbol)
        p.profit = round((price - p.price_open) * p.volume * (1 if p.type == ORDER_TYPE_BUY else -1) * 100, 2)
    if symbol:
        return [p for p in _positions if p.symbol == symbol]
    return list(_positions)


def order_send(request: dict):
    global _next_ticket
    position_ticket = request.get('position')

    if request.get('action') == TRADE_ACTION_SLTP and position_ticket is not None:
        pos = next((p for p in _positions if p.ticket == position_ticket), None)
        if pos is None:
            return SimpleNamespace(retcode=10013, order=0, volume=0.0, price=0.0, comment="position not found")
        pos.sl = request.get('sl', pos.sl)
        pos.tp = request.get('tp', pos.tp)
        return SimpleNamespace(retcode=TRADE_RETCODE_DONE, order=position_ticket,
                                volume=pos.volume, price=pos.price_open, comment="mock sltp modify")

    if position_ticket is not None:
        idx = next((i for i, p in enumerate(_positions) if p.ticket == position_ticket), None)
        if idx is None:
            return SimpleNamespace(retcode=10013, order=0, volume=0.0, price=0.0, comment="position not found")
        pos = _positions.pop(idx)
        return SimpleNamespace(retcode=TRADE_RETCODE_DONE, order=position_ticket,
                                volume=pos.volume, price=request['price'], comment="mock close")

    symbol = request['symbol']
    price  = request['price']
    ticket = _next_ticket
    _next_ticket += 1
    _positions.append(SimpleNamespace(
        ticket=ticket, symbol=symbol, type=request['type'], price_open=price,
        sl=request.get('sl', 0.0), tp=request.get('tp', 0.0), profit=0.0,
        volume=request['volume'], swap=0.0, time=int(time.time()),
    ))
    return SimpleNamespace(retcode=TRADE_RETCODE_DONE, order=ticket,
                            volume=request['volume'], price=price, comment="mock fill")


def history_deals_get(frm, to):
    # No simulated closed-trade history yet — History/Performance pages
    # correctly show their existing empty states for this.
    return []
