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
import time
import random
from types import SimpleNamespace

import numpy as np

# ── Constants (values just need to be internally consistent) ───
TIMEFRAME_M1, TIMEFRAME_M5, TIMEFRAME_M15, TIMEFRAME_M30 = 1, 5, 15, 30
TIMEFRAME_H1, TIMEFRAME_H4, TIMEFRAME_D1 = 60, 240, 1440

ORDER_TYPE_BUY, ORDER_TYPE_SELL = 0, 1
ORDER_FILLING_FOK, ORDER_FILLING_IOC, ORDER_FILLING_RETURN = 0, 1, 2
ORDER_TIME_GTC = 0
TRADE_ACTION_DEAL = 1
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

# Per-(symbol, timeframe_minutes) bar cache: list of dicts, oldest→newest.
_bars: dict[tuple[str, int], list[dict]] = {}


def _seed_price(symbol: str) -> float:
    return _SEED_PRICE.get(symbol, 100.0)


def _digits(symbol: str) -> int:
    return _DIGITS.get(symbol, 5)


def _step(price: float, symbol: str) -> float:
    vol = price * 0.0006  # ~0.06% per bar — gentle, visible drift
    return max(price + random.gauss(0, vol), price * 0.5)


def _ensure_bars(symbol: str, minutes: int, count: int):
    """Seed or extend the bar cache for (symbol, minutes) up to `count` bars,
    generating new bars as wall-clock time passes so the series feels live
    without ever regenerating history that's already been shown."""
    key = (symbol, minutes)
    series = _bars.setdefault(key, [])
    period = minutes * 60
    now_bucket = int(time.time()) // period * period

    if not series:
        price = _seed_price(symbol)
        start = now_bucket - (count - 1) * period
        for i in range(count):
            t = start + i * period
            o = price
            price = _step(price, symbol)
            h = max(o, price) + abs(random.gauss(0, price * 0.0002))
            l = min(o, price) - abs(random.gauss(0, price * 0.0002))
            series.append({'time': t, 'open': o, 'high': h, 'low': l, 'close': price,
                            'tick_volume': random.randint(50, 500)})
        return

    last_t = series[-1]['time']
    price = series[-1]['close']
    t = last_t + period
    while t <= now_bucket:
        o = price
        price = _step(price, symbol)
        h = max(o, price) + abs(random.gauss(0, price * 0.0002))
        l = min(o, price) - abs(random.gauss(0, price * 0.0002))
        series.append({'time': t, 'open': o, 'high': h, 'low': l, 'close': price,
                        'tick_volume': random.randint(50, 500)})
        t += period
    # Cap memory — keep a healthy buffer beyond what's ever requested.
    if len(series) > count * 3:
        del series[: len(series) - count * 3]


def _current_price(symbol: str) -> float:
    _ensure_bars(symbol, 1, 5)
    return _bars[(symbol, 1)][-1]['close']


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
    return True


def symbol_info(symbol):
    return SimpleNamespace(
        bid=_current_price(symbol), ask=_current_price(symbol) * 1.0002,
        digits=_digits(symbol), filling_mode=1,
    )


def symbol_info_tick(symbol):
    price = _current_price(symbol)
    spread = price * 0.0002
    return SimpleNamespace(bid=price, ask=price + spread, time=int(time.time()))


def symbols_get():
    return [SimpleNamespace(name=s, visible=True) for s in _SEED_PRICE]


def copy_rates_from_pos(symbol, timeframe, start_pos, count):
    _ensure_bars(symbol, timeframe, start_pos + count + 5)
    series = _bars[(symbol, timeframe)]
    end = len(series) - start_pos
    start = max(end - count, 0)
    window = series[start:end]
    if not window:
        return np.array([], dtype=_RATES_DTYPE)
    return np.array(
        [(b['time'], b['open'], b['high'], b['low'], b['close'], b['tick_volume'], 1, 0) for b in window],
        dtype=_RATES_DTYPE,
    )


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
        sl=0.0, tp=0.0, profit=0.0, volume=request['volume'], swap=0.0,
        time=int(time.time()),
    ))
    return SimpleNamespace(retcode=TRADE_RETCODE_DONE, order=ticket,
                            volume=request['volume'], price=price, comment="mock fill")


def history_deals_get(frm, to):
    # No simulated closed-trade history yet — History/Performance pages
    # correctly show their existing empty states for this.
    return []
