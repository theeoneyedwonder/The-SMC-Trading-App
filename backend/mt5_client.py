import time
import MetaTrader5 as mt5
from config import (
    MT5_TIMEOUT, MAX_RETRIES, RETRY_DELAY, MAX_RETRY_DELAY,
    get_mt5_credentials, get_active_symbol,
)

_connected = False

def is_connected() -> bool:
    try:
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

        if not mt5.initialize(
            login=login, password=password,
            server=server, timeout=MT5_TIMEOUT,
        ):
            err = mt5.last_error()
            print(f"[MT5] Init failed: {err}. Retrying in {delay}s...")
            time.sleep(delay)
            delay = min(delay * 2, MAX_RETRY_DELAY)
            continue

        # Symbol selection is best-effort — don't abort the connection for it
        symbol = get_active_symbol()
        if not mt5.symbol_select(symbol, True):
            print(f"[MT5] Warning: symbol {symbol} not available on this account - change symbol in the app")

        _connected = True
        print(f"[MT5] Connected OK  (account: {mt5.account_info().login})")
        return True

    print("[MT5] All connection attempts failed.")
    _connected = False
    return False

def disconnect():
    global _connected
    mt5.shutdown()
    _connected = False
    print("[MT5] Disconnected.")

def ensure_connected() -> bool:
    if not is_connected():
        print("[MT5] Connection lost - reconnecting...")
        _connected = False
        return connect()
    return True

def select_symbol(symbol: str) -> bool:
    if not ensure_connected():
        return False
    ok = mt5.symbol_select(symbol, True)
    if ok:
        print(f"[MT5] Symbol selected: {symbol}")
    else:
        print(f"[MT5] Failed to select symbol: {symbol}")
    return ok

def get_open_trades(symbol: str | None = None) -> list:
    if not ensure_connected():
        return []
    if symbol is None:
        symbol = get_active_symbol()
    positions = mt5.positions_get(symbol=symbol)
    return list(positions) if positions else []

def get_account_info() -> dict:
    if not ensure_connected():
        return {}
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
