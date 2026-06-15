import time
import threading
import MetaTrader5 as mt5
from config import (
    MT5_TIMEOUT, MAX_RETRIES, RETRY_DELAY, MAX_RETRY_DELAY,
    get_mt5_credentials, get_active_symbol,
)

_connected = False

# ── MT5 IPC is a single, NON thread-safe pipe to the terminal. ──
# Every call into mt5.* MUST hold this lock so only one IPC request
# is in flight at a time. RLock = reentrant so nested calls on the
# same thread don't self-deadlock. The lock is held ONLY around the
# atomic mt5.* calls — never across time.sleep() — so a slow retry
# can't freeze the live tick / account loops.
_mt5_lock = threading.RLock()


def is_connected() -> bool:
    try:
        with _mt5_lock:
            info = mt5.terminal_info()
        return info is not None and info.connected
    except Exception:
        return False


def connect() -> bool:
    """Initialise MT5 with current credentials. Retries with exponential backoff."""
    global _connected
    login, password, server = get_mt5_credentials()

    if not (login and password and server):
        print("[MT5] No credentials configured - skipping connect")
        return False

    delay = RETRY_DELAY
    for attempt in range(1, MAX_RETRIES + 1):
        print(f"[MT5] Connection attempt {attempt}/{MAX_RETRIES}...")

        with _mt5_lock:
            ok = mt5.initialize(
                login=login, password=password,
                server=server, timeout=MT5_TIMEOUT,
            )
            err = None if ok else mt5.last_error()
            if ok:
                # Symbol selection is best-effort — don't abort the connection for it
                symbol = get_active_symbol()
                if not mt5.symbol_select(symbol, True):
                    print(f"[MT5] Warning: symbol {symbol} not available - change symbol in the app")
                acct = mt5.account_info()

        if ok:
            _connected = True
            login_no = acct.login if acct else "?"
            print(f"[MT5] Connected OK  (account: {login_no})")
            return True

        # sleep OUTSIDE the lock so live loops keep flowing during backoff
        print(f"[MT5] Init failed: {err}. Retrying in {delay}s...")
        time.sleep(delay)
        delay = min(delay * 2, MAX_RETRY_DELAY)

    print("[MT5] All connection attempts failed.")
    _connected = False
    return False


def disconnect():
    global _connected
    with _mt5_lock:
        mt5.shutdown()
    _connected = False
    print("[MT5] Disconnected.")


def ensure_connected() -> bool:
    # NOTE: never call this while already holding _mt5_lock for a read —
    # connect() may sleep, and we deliberately keep that outside the lock.
    if not is_connected():
        print("[MT5] Connection lost - reconnecting...")
        global _connected
        _connected = False
        return connect()
    return True


def select_symbol(symbol: str) -> bool:
    if not ensure_connected():
        return False
    with _mt5_lock:
        ok = mt5.symbol_select(symbol, True)
    print(f"[MT5] Symbol selected: {symbol}" if ok else f"[MT5] Failed to select symbol: {symbol}")
    return ok


# Friendly, actionable messages for the trade-server return codes users hit most.
_RETCODE_HELP = {
    10027: ("Algo Trading is OFF. In MetaTrader 5: click the 'Algo Trading' toolbar "
            "button (must be green) AND enable Tools → Options → Expert Advisors → "
            "'Allow Algorithmic Trading'. Both are required."),
    10018: "Market is closed for this symbol right now.",
    10019: "Not enough free margin to open this position.",
    10014: "Invalid lot size for this symbol (check the broker's min/max/step).",
    10016: "Invalid Stop Loss / Take Profit level.",
    10015: "Invalid price.",
    10004: "Requote — the price moved. Try again.",
    10006: "Order rejected by the broker.",
    10031: "No connection to the trade server.",
    10013: "Invalid trade request.",
    10009: None,  # DONE — handled separately
}


def _pos_to_dict(p) -> dict:
    return {
        "ticket"    : p.ticket,
        "symbol"    : p.symbol,
        "direction" : "BUY" if p.type == 0 else "SELL",
        "entry"     : p.price_open,
        "sl"        : p.sl,
        "tp"        : p.tp,
        "profit"    : p.profit,
        "lots"      : p.volume,
        "swap"      : p.swap,
        "time"      : int(p.time),
    }


def get_open_trades(symbol: str | None = None) -> list:
    """Raw position objects. symbol=None → every open position on the account."""
    if not ensure_connected():
        return []
    with _mt5_lock:
        positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
    return list(positions) if positions else []


def get_account_info() -> dict:
    if not ensure_connected():
        return {}
    with _mt5_lock:
        info = mt5.account_info()
    if info is None:
        return {}
    return {
        "login"      : info.login,
        "name"       : info.name,
        "balance"    : info.balance,
        "equity"     : info.equity,
        "margin"     : info.margin,
        "free_margin": info.margin_free,
        "profit"     : info.profit,
        "currency"   : info.currency,
        "leverage"   : info.leverage,
        "server"     : info.server,
        "company"    : info.company,
    }


def get_account_snapshot() -> dict:
    """Account info + ALL open positions in a single lock acquisition —
    an atomic, consistent picture for the fast live loop."""
    if not ensure_connected():
        return {"account": {}, "trades": []}
    with _mt5_lock:
        info      = mt5.account_info()
        positions = mt5.positions_get()

    account = {
        "login"      : info.login,
        "name"       : info.name,
        "balance"    : info.balance,
        "equity"     : info.equity,
        "margin"     : info.margin,
        "free_margin": info.margin_free,
        "profit"     : info.profit,
        "currency"   : info.currency,
        "leverage"   : info.leverage,
        "server"     : info.server,
        "company"    : info.company,
    } if info is not None else {}

    trades = [_pos_to_dict(p) for p in positions] if positions else []
    return {"account": account, "trades": trades}


def get_symbol_tick(symbol: str) -> dict:
    if not ensure_connected():
        return {}
    with _mt5_lock:
        tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return {}
    return {"bid": float(tick.bid), "ask": float(tick.ask), "time": int(tick.time)}


def get_quote(symbol: str) -> dict:
    """Watchlist quote: last price + daily change vs previous D1 close.
    Selects the symbol into Market Watch so its tick is available."""
    if not ensure_connected():
        return {}
    with _mt5_lock:
        mt5.symbol_select(symbol, True)
        tick  = mt5.symbol_info_tick(symbol)
        info  = mt5.symbol_info(symbol)
        rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_D1, 0, 2)

    # Prefer the live tick; fall back to symbol_info when a freshly-selected
    # symbol hasn't received its first tick yet (otherwise it'd show as '—').
    bid = float(tick.bid) if (tick and tick.bid) else (float(info.bid) if (info and info.bid) else 0.0)
    ask = float(tick.ask) if (tick and tick.ask) else (float(info.ask) if (info and info.ask) else 0.0)
    last = bid or ask
    if not last:
        return {}

    digits = int(info.digits) if info is not None else 5

    prev_close = None
    if rates is not None and len(rates) >= 2:
        prev_close = float(rates[0]["close"])   # oldest of the 2 = yesterday's close
    elif rates is not None and len(rates) == 1:
        prev_close = float(rates[0]["open"])

    change = change_pct = 0.0
    if prev_close:
        change     = last - prev_close
        change_pct = (change / prev_close) * 100.0

    return {
        "symbol"     : symbol,
        "last"       : round(last, digits),
        "change"     : round(change, digits),
        "change_pct" : round(change_pct, 2),
        "digits"     : digits,
    }


def execute_market_order(symbol: str, lot: float, order_type: str) -> dict:
    if not ensure_connected():
        return {"success": False, "error": "Not connected to MT5"}

    with _mt5_lock:
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return {"success": False, "error": f"Cannot get price for {symbol}"}

        mt5_type = mt5.ORDER_TYPE_BUY if order_type == "BUY" else mt5.ORDER_TYPE_SELL
        price    = float(tick.ask) if order_type == "BUY" else float(tick.bid)

        info    = mt5.symbol_info(symbol)
        filling = mt5.ORDER_FILLING_IOC
        if info is not None:
            fm = info.filling_mode
            if fm & 1:   filling = mt5.ORDER_FILLING_FOK
            elif fm & 2: filling = mt5.ORDER_FILLING_IOC
            elif fm & 4: filling = mt5.ORDER_FILLING_RETURN

        request = {
            "action"       : mt5.TRADE_ACTION_DEAL,
            "symbol"       : symbol,
            "volume"       : float(lot),
            "type"         : mt5_type,
            "price"        : price,
            "deviation"    : 20,
            "magic"        : 234000,
            "comment"      : "SMC Bot",
            "type_time"    : mt5.ORDER_TIME_GTC,
            "type_filling" : filling,
        }

        result = mt5.order_send(request)
        last_err = mt5.last_error() if result is None else None

    if result is None:
        return {"success": False, "error": f"MT5 error: {last_err}"}

    if result.retcode != mt5.TRADE_RETCODE_DONE:
        help_msg = _RETCODE_HELP.get(result.retcode)
        msg = help_msg or f"{result.comment} (code {result.retcode})"
        return {"success": False, "error": msg}

    return {
        "success" : True,
        "ticket"  : result.order,
        "volume"  : float(result.volume),
        "price"   : float(result.price),
    }
