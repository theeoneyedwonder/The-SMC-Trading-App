from plyer import notification
from config import get_active_symbol

APP_NAME = "SMC Bot"

def _send(title: str, message: str, timeout: int = 8):
    try:
        notification.notify(
            title    = title,
            message  = message,
            app_name = APP_NAME,
            timeout  = timeout,
        )
    except Exception as e:
        print(f"[ALERTS] {e}")


def alert_structure(timeframe: str, kind: str, direction: str):
    sym = get_active_symbol()
    _send(f"Structure - {timeframe}", f"{direction} {kind} on {sym} [{timeframe}]")

def alert_ob(timeframe: str, direction: str, high: float, low: float):
    sym = get_active_symbol()
    _send(f"Order Block - {timeframe}", f"{direction} OB on {sym}\nZone: {low:.2f} - {high:.2f}")

def alert_fvg(timeframe: str, direction: str, high: float, low: float):
    sym = get_active_symbol()
    _send(f"FVG - {timeframe}", f"{direction} FVG on {sym}\nGap: {low:.2f} - {high:.2f}")

def alert_trade_opened(direction: str, entry: float, sl: float, tp: float):
    sym = get_active_symbol()
    _send(
        f"Trade Opened - {sym}",
        f"{direction} @ {entry:.2f}\nSL: {sl:.2f}  |  TP: {tp:.2f}",
        timeout=10,
    )

def alert_trade_closed(direction: str, entry: float, profit: float):
    result = "PROFIT" if profit >= 0 else "LOSS"
    _send(f"Trade Closed - {result}", f"{direction} closed\nP&L: {profit:.2f}", timeout=10)

def alert_connection_lost():
    _send("Connection Lost", "MT5 dropped. Reconnecting...", timeout=12)

def alert_reconnected():
    sym = get_active_symbol()
    _send("Reconnected", f"MT5 restored. Monitoring {sym}.")
