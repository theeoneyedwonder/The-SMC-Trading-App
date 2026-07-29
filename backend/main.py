import asyncio
import json
import os
import threading
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import (
    HOST, PORT, AVAILABLE_SYMBOLS, TIMEFRAMES,
    is_configured, get_mt5_credentials,
    get_active_symbol, save_active_symbol,
    save_mt5_credentials, clear_mt5_credentials,
    get_risk_settings, save_risk_settings,
    get_oanda_settings, oanda_is_configured,
    save_oanda_settings, clear_oanda_settings,
)
from database import init_db
from mt5_client import (
    connect, disconnect, get_open_trades, get_account_info,
    is_connected,
    get_symbol_tick, execute_market_order, close_position, close_positions,
    get_account_snapshot, get_quote, modify_position_sltp, _mt5_lock,
)
from data import MarketDataError, get_all_timeframes, get_candle_page, get_candles, resolve_symbol
from market_providers import (
    MarketProviderError,
    get_oanda_candle_page,
    get_oanda_tick,
    oanda_status,
    search_oanda_symbols,
    stream_oanda_prices,
    validate_oanda_credentials,
)
from history_sync import sync_deal_history, get_history, get_performance
from chat_memory import save_message, get_recent_messages, get_all_messages, clear_messages
from web_search import web_search, search_enabled, TOOL_SCHEMA
from indicators import analyse_all_timeframes
from patterns import analyse_patterns
from alerts import (
    alert_connection_lost, alert_reconnected,
    alert_trade_opened, alert_trade_closed,
    alert_price_hit, alert_structure,
)
from notifications import (
    create_alert, list_alerts, delete_alert, check_alerts,
    log_event, get_event_log,
)
from screener import scan_market
from sage_memory import REMEMBER_TOOL_SCHEMA, remember, notes_context
from journal import annotate_trade, get_annotation, list_annotations
from economic_calendar import get_calendar_events
from config import get_ai_settings, save_ai_settings

# ─── WebSocket manager ────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()
_wake_loop: asyncio.Event | None = None  # set by lifespan, triggered after setup

# Most recent patterns per symbol — updated every pattern_loop cycle, read
# by the trade journal to snapshot "why" a trade was taken at open time.
_last_patterns: dict[str, dict] = {}

def _current_setup(symbol: str) -> dict:
    """Most recent detected structure for a symbol, preferring higher
    timeframes as more representative of the prevailing setup."""
    patterns = _last_patterns.get(symbol)
    if not patterns:
        return {}
    for tf in ("H1", "H4", "M30", "M15", "D1", "M5", "M1"):
        tf_data = patterns.get(tf)
        if not tf_data:
            continue
        events = []
        for o in tf_data.get("order_blocks", []):
            events.append(("OB", o["direction"], o["time"]))
        for f in tf_data.get("fvgs", []):
            events.append(("FVG", f["direction"], f["time"]))
        for b in tf_data.get("bos_mss", []):
            events.append(("BOS", b["direction"], b["time"]))
        if events:
            events.sort(key=lambda e: e[2], reverse=True)
            kind, direction, _ = events[0]
            return {"setup_kind": kind, "setup_direction": direction, "setup_timeframe": tf}
    return {}

# ─── Sage personas (system-prompt modifiers, set in Settings > Sage AI Core) ──
SAGE_PERSONAS = {
    "analytical": (
        "Your current persona is ANALYTICAL: stay measured and data-driven, lead with structural "
        "breaks, volume, and objective confluence. Avoid hype."
    ),
    "aggressive": (
        "Your current persona is AGGRESSIVE: favor decisive, momentum-driven calls and are comfortable "
        "flagging setups earlier with a higher risk tolerance — but never fabricate confidence you don't have."
    ),
    "conservative": (
        "Your current persona is CONSERVATIVE: only call a setup active when multiple timeframes align "
        "and confluence is strong; prefer to say a setup isn't ready yet over forcing one."
    ),
}

# ─── Proactive Sage nudges ─────────────────────────────────────
# Only higher timeframes — M1..M30 recompute too often to be worth
# interrupting the user for every reshuffle.
NUDGE_TIMEFRAMES = ("H1", "H4", "D1")
_seen_bos: dict[str, dict[str, set]] = {}

def _bos_nudges(symbol: str, patterns: dict) -> list[dict]:
    """Diff this cycle's BOS/MSS against what we've already seen for this
    symbol+timeframe and return only genuinely new breaks. The first time a
    symbol/timeframe pair is observed just baselines it (no nudge storm)."""
    seen_for_symbol = _seen_bos.setdefault(symbol, {})
    nudges = []
    for tf in NUDGE_TIMEFRAMES:
        tf_data = patterns.get(tf)
        if not tf_data:
            continue
        current = {(b["direction"], round(b["level"], 2)) for b in tf_data.get("bos_mss", [])}
        seen = seen_for_symbol.get(tf)
        if seen is not None:
            for direction, level in current - seen:
                nudges.append({
                    "symbol": symbol, "timeframe": tf,
                    "direction": direction, "level": level,
                    "text": (
                        f"Just flagged a {direction.lower()} break of structure on {tf} "
                        f"for {symbol} — price closed through {level:g}. Worth a look?"
                    ),
                })
        seen_for_symbol[tf] = current
    return nudges

# ─── Fast live loop (account + trades + P&L) ──────────────────
async def account_loop():
    """Live heartbeat (~300ms): account info + ALL open positions.
    This is what makes the app a real-time mirror of MT5 — trades placed
    or closed anywhere in the terminal show up within ~300ms, and floating
    P&L tracks ticks smoothly. Owns trade open/close alerts.
    Does NOT manage the connection (pattern_loop does)."""
    loop = asyncio.get_event_loop()
    prev_tickets: set = set()
    seen_first = False

    while True:
        try:
            if is_configured() and is_connected():
                snap   = await loop.run_in_executor(None, get_account_snapshot)
                trades = snap.get("trades", [])

                current = {t["ticket"] for t in trades}
                if seen_first:   # don't flood alerts for pre-existing trades on first poll
                    for t in trades:
                        if t["ticket"] not in prev_tickets:
                            alert_trade_opened(t["direction"], t["entry"], t["sl"], t["tp"])
                    for _ in (prev_tickets - current):
                        alert_trade_closed("CLOSED", 0, 0)
                prev_tickets = current
                seen_first   = True

                await manager.broadcast({
                    "type"    : "live",
                    "symbol"  : get_active_symbol(),
                    "account" : snap.get("account", {}),
                    "trades"  : trades,
                })
        except Exception as e:
            print(f"[LIVE] {e}")

        await asyncio.sleep(0.3)


# ─── Slow pattern loop (7 timeframes + SMC analysis) ──────────
async def pattern_loop():
    """Heavy analysis (~30s, or immediately on wake). Owns the MT5
    connection lifecycle so the fast loops stay simple passive readers."""
    was_connected = False
    loop          = asyncio.get_event_loop()

    while True:
        try:
            if not is_configured():
                await asyncio.sleep(3)
                continue

            connected = is_connected()
            if not connected:
                if was_connected:
                    alert_connection_lost()
                print("[BOT] Connecting...")
                connected = await loop.run_in_executor(None, connect)
                if connected:
                    alert_reconnected()
            was_connected = connected

            if not connected:
                await asyncio.sleep(5)
                continue

            symbol     = get_active_symbol()
            tf_data    = await loop.run_in_executor(None, lambda: get_all_timeframes(symbol=symbol))
            indicators = await loop.run_in_executor(None, lambda: analyse_all_timeframes(tf_data))
            patterns   = await loop.run_in_executor(None, lambda: analyse_patterns(tf_data))
            _last_patterns[symbol] = patterns

            # Only patterns/indicators here — account/trades flow via account_loop
            await manager.broadcast({
                "type"       : "patterns",
                "symbol"     : symbol,
                "indicators" : indicators,
                "patterns"   : patterns,
            })

            # Proactive Sage: surface newly-formed higher-timeframe breaks of
            # structure unprompted, instead of waiting for the user to ask.
            for nudge in _bos_nudges(symbol, patterns):
                login = get_mt5_credentials()[0]
                await loop.run_in_executor(None, lambda n=nudge: save_message(login, "assistant", n["text"]))
                await loop.run_in_executor(None, lambda n=nudge: log_event(
                    "SAGE", "Pattern Detected", n["text"], value=n["timeframe"], symbol=n["symbol"]))
                await loop.run_in_executor(None, lambda n=nudge: alert_structure(n["timeframe"], "BOS", n["direction"]))
                await manager.broadcast({"type": "nudge", "id": time.time(), **nudge})

            # Keep the persisted trade history fresh (captures closes within ~30s)
            await loop.run_in_executor(None, sync_deal_history)
            print(f"[BOT] {symbol} patterns refreshed")

        except Exception as e:
            print(f"[BOT] Pattern loop error: {e}")

        # Refresh every 30s, or wake immediately on symbol change / new trade
        try:
            await asyncio.wait_for(_wake_loop.wait(), timeout=30)  # type: ignore[union-attr]
            _wake_loop.clear()  # type: ignore[union-attr]
        except asyncio.TimeoutError:
            pass


# ─── Monitor loop (price alerts + auto-breakeven) ──────────────
async def monitor_loop():
    """Lighter-weight 5s cadence — checks user price alerts against live
    quotes and, if enabled, moves stop-loss to breakeven once a position's
    price move crosses the configured trigger."""
    loop = asyncio.get_event_loop()
    while True:
        try:
            if is_configured() and is_connected():
                triggered = await loop.run_in_executor(None, check_alerts)
                for a in triggered:
                    verb = "crossed above" if a["condition"] == "above" else "crossed below"
                    msg  = f"{a['symbol']} {verb} {a['target']:g}"
                    await loop.run_in_executor(None, lambda a=a, msg=msg: log_event(
                        "PRICE_ALERT", "Price Alert Triggered", msg,
                        value=f"{a['target']:g}", symbol=a["symbol"]))
                    await loop.run_in_executor(None, lambda a=a: alert_price_hit(a["symbol"], a["condition"], a["target"]))
                    await manager.broadcast({"type": "alert_triggered", **a})

                risk = get_risk_settings()
                if risk.get("auto_breakeven_enabled"):
                    trigger_pct = float(risk.get("auto_breakeven_trigger_pct", 1.5))
                    trades = await loop.run_in_executor(None, get_open_trades)
                    for t in trades:
                        entry = getattr(t, "price_open", 0)
                        if not entry:
                            continue
                        tick = await loop.run_in_executor(None, lambda s=t.symbol: get_symbol_tick(s))
                        if not tick:
                            continue
                        is_buy  = t.type == 0
                        current = tick.get("bid") if is_buy else tick.get("ask")
                        if not current:
                            continue
                        move_pct = ((current - entry) / entry * 100) if is_buy \
                                   else ((entry - current) / entry * 100)
                        at_breakeven = (is_buy and t.sl >= entry > 0) or (not is_buy and 0 < t.sl <= entry)
                        if move_pct >= trigger_pct and not at_breakeven:
                            result = await loop.run_in_executor(
                                None, lambda tk=t.ticket, e=entry: modify_position_sltp(tk, sl=e))
                            if result.get("success"):
                                await loop.run_in_executor(None, lambda t=t, entry=entry: log_event(
                                    "EXECUTION", "Auto-Breakeven Triggered",
                                    f"{t.symbol} SL moved to entry {entry:g}",
                                    value=f"#{t.ticket}", symbol=t.symbol))
                                if _wake_loop:
                                    _wake_loop.set()
        except Exception as e:
            print(f"[MONITOR] {e}")
        await asyncio.sleep(5)


# ─── Lifespan ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _wake_loop
    _wake_loop = asyncio.Event()
    print("[BOT] Starting up...")
    init_db()
    log_event("SYSTEM", "Session Start", "Backend initialised successfully.")
    # Don't block startup on connect — pattern_loop establishes the
    # connection in the background so the UI/HTTP server is up instantly.
    asyncio.create_task(pattern_loop())
    asyncio.create_task(account_loop())
    asyncio.create_task(tick_broadcaster())
    asyncio.create_task(monitor_loop())
    yield
    print("[BOT] Shutting down...")
    disconnect()


# ─── App ──────────────────────────────────────────────────────
app = FastAPI(title="QUANT_CORE", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ─── Setup endpoints ──────────────────────────────────────────
class SetupRequest(BaseModel):
    login:    int
    password: str
    server:   str


class OandaSettingsRequest(BaseModel):
    account_id: str
    access_token: str
    environment: str = "practice"


def _local_market_provider() -> str:
    return "simulated" if os.environ.get("SMC_MOCK") == "1" else "mt5"


def _market_provider_catalog() -> dict:
    local = _local_market_provider()
    return {
        "default_chart_provider": local,
        "execution_provider": local,
        "providers": [
            {
                "id": "simulated",
                "label": "QUANT_CORE Chart",
                "short_label": "QUANT_CORE Chart",
                "available": local == "simulated",
                "configured": local == "simulated",
                "mode": "analysis",
                "supports_sage": True,
                "description": "Native QUANT_CORE chart with Sage integration.",
            },
            {
                "id": "mt5",
                "label": "MetaTrader 5 Chart",
                "short_label": "MetaTrader 5 Chart",
                "available": local == "mt5" and is_configured(),
                "configured": local == "mt5" and is_configured(),
                "mode": "analysis",
                "supports_sage": True,
                "description": "Requires MetaTrader 5 on this platform to be accessed.",
            },
            {
                "id": "oanda",
                "label": "OANDA Chart",
                "short_label": "OANDA Chart",
                "available": oanda_is_configured(),
                "configured": oanda_is_configured(),
                "mode": "analysis",
                "supports_sage": False,
                "description": "Direct OANDA market data. Requires configuration.",
            },
            {
                "id": "tradingview",
                "label": "TradingView Port",
                "short_label": "TradingView",
                "available": True,
                "configured": True,
                "mode": "research",
                "supports_sage": False,
                "description": "Official TradingView-hosted research chart with TradingView data and tools; isolated from Sage and order execution.",
            },
        ],
    }

@app.get("/setup/check-mt5")
def check_mt5_installed():
    """Detect whether MT5 terminal is installed on this machine."""
    if os.environ.get('SMC_MOCK') == '1':
        return {"installed": True, "path": "mock"}

    import glob

    candidates = [
        r"C:\Program Files\MetaTrader 5\terminal64.exe",
        r"C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    ]

    # Broker-specific installs live under AppData\Roaming\MetaQuotes\Terminal\<hash>\
    roaming = os.environ.get('APPDATA', '')
    if roaming:
        candidates += glob.glob(
            os.path.join(roaming, 'MetaQuotes', 'Terminal', '*', 'terminal64.exe')
        )

    for p in candidates:
        if os.path.exists(p):
            return {"installed": True, "path": p}

    # Registry fallback
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\MetaQuotes\Terminal")
        winreg.CloseKey(key)
        return {"installed": True, "path": None}
    except Exception:
        pass

    return {"installed": False, "path": None}


@app.get("/setup/status")
def setup_status():
    return {
        "configured"   : is_configured(),
        "mt5_connected": is_connected(),
    }

@app.post("/setup")
async def setup(req: SetupRequest):
    """Test MT5 credentials and persist them if successful."""
    import importlib
    mt5 = importlib.import_module('mt5_mock' if os.environ.get('SMC_MOCK') == '1' else 'MetaTrader5')

    def _test_connection():
        mt5.shutdown()
        ok = mt5.initialize(
            login    = req.login,
            password = req.password,
            server   = req.server,
            timeout  = 15000,
        )
        if not ok:
            err = mt5.last_error()
            mt5.shutdown()
            return None, f"MT5 connection failed: {err}"

        info = mt5.account_info()
        if info is None:
            mt5.shutdown()
            return None, "Connected but could not read account info"

        result = {
            "login"   : info.login,
            "name"    : info.name,
            "balance" : info.balance,
            "currency": info.currency,
            "server"  : info.server,
            "company" : info.company,
        }
        mt5.shutdown()
        return result, None

    loop = asyncio.get_event_loop()
    account, error = await loop.run_in_executor(None, _test_connection)

    if error:
        raise HTTPException(status_code=400, detail=error)

    save_mt5_credentials(req.login, req.password, req.server)
    print(f"[SETUP] Credentials saved for account {req.login}")
    # Reconnect immediately — don't wait for the 60s bot loop cycle
    await loop.run_in_executor(None, connect)
    if _wake_loop:
        _wake_loop.set()  # wake bot loop so it broadcasts right away
    return {"success": True, "account": account}


# ─── Analysis market sources ──────────────────────────────────
@app.get("/market/providers")
def market_providers_endpoint():
    """Advertise analysis feeds without conflating them with order routing."""
    return _market_provider_catalog()


@app.get("/settings/market/oanda")
def oanda_settings_endpoint():
    """Return only non-secret OANDA settings. The token is never echoed."""
    return oanda_status()


@app.post("/settings/market/oanda")
async def save_oanda_settings_endpoint(req: OandaSettingsRequest):
    candidate = {
        "account_id": req.account_id.strip(),
        "access_token": req.access_token.strip(),
        "environment": req.environment.strip().lower(),
    }
    try:
        account = await validate_oanda_credentials(candidate)
    except MarketProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    save_oanda_settings(**candidate)
    return {"ok": True, "configured": True, **account}


@app.delete("/settings/market/oanda")
def clear_oanda_settings_endpoint():
    clear_oanda_settings()
    return {"ok": True, "configured": False}


@app.get("/market/search/{provider}")
async def market_symbol_search(provider: str, q: str = "", limit: int = 40):
    provider = provider.strip().lower()
    if provider == "oanda":
        try:
            symbols = await search_oanda_symbols(q, limit)
        except MarketProviderError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return {"provider": provider, "symbols": symbols}
    if provider == "tradingview":
        return {
            "provider": provider,
            "symbols": [],
            "detail": "TradingView symbol search is built into Research Mode.",
        }
    if provider not in ("mt5", "simulated"):
        raise HTTPException(status_code=404, detail=f"Unknown market provider: {provider}")
    actual = _local_market_provider()
    if provider != actual:
        raise HTTPException(status_code=409, detail=f"{provider.upper()} is not active in this runtime")

    import importlib
    local_mt5 = importlib.import_module("mt5_mock" if actual == "simulated" else "MetaTrader5")
    if not is_connected():
        return {"provider": provider, "symbols": []}
    with _mt5_lock:
        raw = local_mt5.symbols_get()
    needle = q.strip().casefold()
    names = [item.name for item in raw or []]
    if needle:
        names = sorted(names, key=lambda name: (
            not name.casefold().startswith(needle),
            name.casefold(),
        ))
        names = [name for name in names if needle in name.casefold()]
    else:
        names.sort()
    symbols = [
        {"symbol": name, "display_symbol": name, "name": name, "type": "BROKER"}
        for name in names[: max(1, min(limit, 100))]
    ]
    return {"provider": provider, "symbols": symbols}


@app.get("/market/bars/{provider}/{symbol}/{timeframe}")
async def provider_bars_endpoint(
    provider: str,
    symbol: str,
    timeframe: str,
    limit: int = 1000,
    before: int | None = None,
):
    provider = provider.strip().lower()
    if timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Unknown timeframe: {timeframe}")
    try:
        if provider == "oanda":
            return await get_oanda_candle_page(symbol, timeframe, limit, before)
        if provider not in ("mt5", "simulated"):
            raise HTTPException(status_code=404, detail=f"Unknown candle provider: {provider}")
        actual = _local_market_provider()
        if provider != actual:
            raise HTTPException(status_code=409, detail=f"{provider.upper()} is not active in this runtime")
        page = get_candle_page(
            symbol=symbol,
            timeframe_minutes=TIMEFRAMES[timeframe],
            limit=limit,
            before=before,
        )
        return {**page, "provider": actual, "display_symbol": page["symbol"]}
    except HTTPException:
        raise
    except MarketDataError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/market/tick/{provider}/{symbol}")
async def provider_tick_endpoint(provider: str, symbol: str):
    provider = provider.strip().lower()
    try:
        if provider == "oanda":
            return await get_oanda_tick(symbol)
        actual = _local_market_provider()
        if provider != actual:
            raise HTTPException(status_code=409, detail=f"{provider.upper()} is not active in this runtime")
        tick = get_symbol_tick(symbol)
        if not tick:
            raise HTTPException(status_code=502, detail=f"No live price for {symbol}")
        return {**tick, "provider": actual, "symbol": symbol}
    except HTTPException:
        raise
    except MarketProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

# ─── Standard endpoints ───────────────────────────────────────
@app.get("/")
def root():
    return {"status": "QUANT_CORE running"}

@app.get("/health")
def health():
    return {"mt5_connected": is_connected(), "configured": is_configured()}

@app.get("/account")
def account_endpoint():
    return get_account_info()

@app.get("/trades")
def trades_endpoint():
    raw = get_open_trades()
    return [
        {
            "ticket"    : t.ticket,
            "symbol"    : t.symbol,
            "direction" : "BUY" if t.type == 0 else "SELL",
            "entry"     : t.price_open,
            "sl"        : t.sl,
            "tp"        : t.tp,
            "profit"    : t.profit,
            "lots"      : t.volume,
            "swap"      : t.swap,
            "time"      : int(t.time),
        }
        for t in raw
    ]

@app.get("/symbol")
def get_symbol():
    return {"symbol": get_active_symbol(), "available": AVAILABLE_SYMBOLS}

@app.get("/symbols/available")
def symbols_available():
    """Return symbols visible in Market Watch on the connected MT5 account."""
    import importlib
    _mt5 = importlib.import_module('mt5_mock' if os.environ.get('SMC_MOCK') == '1' else 'MetaTrader5')
    if not is_connected():
        return {"symbols": [], "connected": False}
    with _mt5_lock:
        raw = _mt5.symbols_get()
    if not raw:
        return {"symbols": [], "connected": True}
    names = sorted(s.name for s in raw if s.visible)
    return {"symbols": names, "connected": True}

@app.post("/symbol/{symbol}")
def set_symbol(symbol: str):
    try:
        resolved = resolve_symbol(symbol)
    except MarketDataError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    save_active_symbol(resolved)
    if _wake_loop:
        _wake_loop.set()
    return {"symbol": resolved, "requested_symbol": symbol}

@app.get("/symbols/search")
def symbols_search(q: str = "", limit: int = 40):
    """Search ALL broker symbols by name substring (for the watchlist search box)."""
    import importlib
    _mt5 = importlib.import_module('mt5_mock' if os.environ.get('SMC_MOCK') == '1' else 'MetaTrader5')
    if not is_connected():
        return {"symbols": []}
    with _mt5_lock:
        raw = _mt5.symbols_get()
    if not raw:
        return {"symbols": []}
    query = q.strip().lower()
    names = [s.name for s in raw]
    if query:
        # Prefix matches first, then substring matches — feels like a real search
        prefix = sorted(n for n in names if n.lower().startswith(query))
        substr = sorted(n for n in names if query in n.lower() and not n.lower().startswith(query))
        names  = prefix + substr
    else:
        names = sorted(names)
    return {"symbols": names[:limit]}

class QuotesRequest(BaseModel):
    symbols: list[str] = []

@app.post("/watchlist/quotes")
async def watchlist_quotes(req: QuotesRequest):
    """Batch live quotes (last + daily change) for the watchlist symbols."""
    loop = asyncio.get_event_loop()
    def _fetch():
        out = {}
        for s in req.symbols[:40]:
            try:
                q = get_quote(s)
                if q:
                    out[s] = q
            except Exception as e:
                print(f"[QUOTES] {s}: {e}")
        return out
    return await loop.run_in_executor(None, _fetch)

@app.get("/candles/{symbol}/{timeframe}")
def candles_endpoint(symbol: str, timeframe: str, offset: int = 0):
    if timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Unknown timeframe: {timeframe}")
    df = get_candles(symbol=symbol, timeframe_minutes=TIMEFRAMES[timeframe], offset=offset)
    if df.empty:
        return []
    return [
        {
            "time"  : int(row["time"].timestamp()),
            "open"  : float(row["open"]),
            "high"  : float(row["high"]),
            "low"   : float(row["low"]),
            "close" : float(row["close"]),
        }
        for _, row in df.iterrows()
    ]


@app.get("/bars/{symbol}/{timeframe}")
def bars_endpoint(symbol: str, timeframe: str, limit: int = 1000, before: int | None = None):
    """Stable UTC cursor pagination used by the interactive chart."""
    if timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Unknown timeframe: {timeframe}")
    try:
        return get_candle_page(
            symbol=symbol,
            timeframe_minutes=TIMEFRAMES[timeframe],
            limit=limit,
            before=before,
        )
    except MarketDataError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

# ─── Tick & Trade ─────────────────────────────────────────────
@app.get("/tick/{symbol}")
def tick_endpoint(symbol: str):
    return get_symbol_tick(symbol)

class TradeRequest(BaseModel):
    symbol: str
    lot:    float
    type:   str   # "BUY" | "SELL"
    sl:     float | None = None
    tp:     float | None = None

@app.post("/trade/market")
async def market_order(req: TradeRequest):
    loop = asyncio.get_event_loop()
    risk = get_risk_settings()

    # ── Risk enforcement (checked synchronously at order time) ──
    if risk.get("drawdown_lock_enabled") or risk.get("max_daily_loss_pct"):
        snap    = await loop.run_in_executor(None, get_account_snapshot)
        acct    = snap.get("account", {})
        balance = acct.get("balance") or 0
        equity  = acct.get("equity", balance) or balance

        if risk.get("drawdown_lock_enabled") and balance > 0:
            drawdown_pct = max(0.0, (balance - equity) / balance * 100)
            if drawdown_pct >= float(risk.get("drawdown_lock_trigger_pct", 10)):
                raise HTTPException(400, f"Drawdown lock active — equity down {drawdown_pct:.1f}% from balance")

        if risk.get("max_daily_loss_pct") and balance > 0:
            perf     = await loop.run_in_executor(None, get_performance)
            today_pl = (perf.get("today") or 0) + (acct.get("profit") or 0)
            if today_pl < 0 and abs(today_pl) / balance * 100 >= float(risk["max_daily_loss_pct"]):
                raise HTTPException(400, f"Daily loss limit reached ({risk['max_daily_loss_pct']}%)")

    # ── Default stop-loss (only if the caller didn't set one) ──
    sl = req.sl
    if not sl and risk.get("default_sl_enabled") and risk.get("default_sl_pct"):
        tick = await loop.run_in_executor(None, lambda: get_symbol_tick(req.symbol))
        price = tick.get("ask") if req.type == "BUY" else tick.get("bid")
        if price:
            pct = float(risk["default_sl_pct"]) / 100
            sl = price * (1 - pct) if req.type == "BUY" else price * (1 + pct)

    result = await loop.run_in_executor(
        None, lambda: execute_market_order(req.symbol, req.lot, req.type, sl, req.tp)
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Trade failed"))

    await loop.run_in_executor(None, lambda: log_event(
        "EXECUTION", f"{req.type.title()} Order Filled",
        f"{req.symbol} {req.lot} lots @ {result.get('price')}",
        value=f"{req.lot} LOT", symbol=req.symbol))

    # Trade journal: snapshot whatever SMC setup was live for this symbol
    # right now, so every position has a real answer to "why was this taken".
    setup = _current_setup(req.symbol)
    login = get_mt5_credentials()[0]
    await loop.run_in_executor(None, lambda: annotate_trade(
        ticket=result["ticket"], login=login, symbol=req.symbol, direction=req.type, **setup))

    if _wake_loop:
        _wake_loop.set()   # refresh trades immediately
    return result

@app.post("/trade/close/{ticket}")
async def close_trade(ticket: int):
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, lambda: close_position(ticket))
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Close failed"))
    await loop.run_in_executor(None, lambda: log_event(
        "EXECUTION", "Position Closed", f"Ticket #{ticket} closed", value=f"#{ticket}"))
    if _wake_loop:
        _wake_loop.set()
    return result

@app.post("/trade/close-all")
async def close_all_trades(mode: str = "all"):
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, lambda: close_positions(mode))
    closed = result.get("closed", [])
    if closed:
        await loop.run_in_executor(None, lambda: log_event(
            "EXECUTION", f"Closed {len(closed)} Position(s)", f"Mode: {mode}", value=mode))
    if _wake_loop:
        _wake_loop.set()
    return result

# ─── Logout ───────────────────────────────────────────────────
@app.post("/setup/logout")
async def logout():
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, disconnect)
    clear_mt5_credentials()
    return {"ok": True}

# ─── Settings: Theme ─────────────────────────────────────────
@app.get("/settings/theme")
def get_theme_settings():
    from config import get_theme
    return get_theme()

@app.post("/settings/theme")
async def save_theme_settings(data: dict):
    from config import save_theme
    save_theme(data)
    return {"ok": True}

# ─── Settings: AI Key ────────────────────────────────────────
@app.get("/settings/ai-key")
def get_ai_key_status():
    from config import get_ai_api_key
    return {"configured": bool(get_ai_api_key())}

@app.post("/settings/ai-key")
async def save_ai_key(req: dict):
    from config import save_ai_api_key
    save_ai_api_key(req.get("key", ""))
    return {"ok": True}

# ─── Settings: Web search (Tavily) key ───────────────────────
@app.get("/settings/search-key")
def get_search_key_status():
    from config import get_search_api_key
    return {"configured": bool(get_search_api_key())}

@app.post("/settings/search-key")
async def save_search_key(req: dict):
    from config import save_search_api_key
    save_search_api_key(req.get("key", ""))
    return {"ok": True}

# ─── AI Chat & Analyze ───────────────────────────────────────
class AIChatRequest(BaseModel):
    message:  str
    context:  dict = {}
    strategy: str  = ""

class AIAnalyzeRequest(BaseModel):
    context:  dict = {}
    strategy: str  = ""

@app.post("/ai/chat")
async def ai_chat(req: AIChatRequest):
    from config import get_ai_api_key
    import httpx
    api_key = get_ai_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured. Add it in Settings > AI Companion.")

    loop       = asyncio.get_event_loop()
    ctx        = req.context
    acct       = ctx.get("account", {})
    trades     = ctx.get("trades", [])
    symbol     = ctx.get("symbol", "unknown")
    indicators = ctx.get("indicators") or {}
    login      = int(acct.get("login") or 0)
    sage_settings = get_ai_settings()

    # ── Personality (broadened: markets + general knowledge) ──────
    system = (
        "You are Sage, an advanced AI trading companion integrated into an institutional-grade trading platform. "
        "You assist with market analysis, Smart Money Concepts (SMC), chart interpretation, and the user's live "
        "trades and account — and you can also answer general questions, world knowledge, and news. "
        "You communicate naturally, intelligently, and professionally; be concise and precise. "
        "When discussing markets, use SMC terminology (order blocks, fair value gaps, liquidity sweeps, market "
        "structure, premium/discount zones).\n\n"
        + SAGE_PERSONAS.get(sage_settings.get("persona"), SAGE_PERSONAS["analytical"]) + "\n\n"
        "── Live context ──\n"
        f"Current market: {symbol}\n"
        f"Account balance: {acct.get('currency','USD')} {acct.get('balance', 'N/A')}\n"
        f"Equity: {acct.get('equity', 'N/A')}\n"
        f"Open P&L: {acct.get('profit', 'N/A')}\n"
        f"Open trades: {len(trades)}\n"
    )

    # Multi-timeframe market structure, if the app has analysed it
    struct = []
    for tf in ("M15", "H1", "H4", "D1"):
        d = indicators.get(tf)
        if isinstance(d, dict) and (d.get("bias") or d.get("trend")):
            struct.append(f"  {tf}: bias {d.get('bias','?')}, trend {d.get('trend','?')}")
    if struct:
        system += "Market structure (multi-timeframe):\n" + "\n".join(struct) + "\n"

    if trades:
        system += "Positions:\n"
        for t in trades:
            system += f"  - {t.get('symbol')} {t.get('direction')} {t.get('lots')} lots @ {t.get('entry')} | P&L: {t.get('profit')}\n"
    if req.strategy:
        system += f"\nUser's custom trading strategy:\n{req.strategy}\n"

    system += notes_context()
    system += ("\nYou have a remember_note tool — use it when the user shares something worth "
               "recalling long-term (risk tolerance, preferred instruments, trading style, goals).")

    if search_enabled():
        system += ("\nYou have a web_search tool for current/real-time info (news, live events, "
                   "recent prices). Use it whenever the answer depends on information after your "
                   "training cutoff; otherwise answer directly.")

    # ── Conversation memory: prior turns, then the new message ────
    history  = await loop.run_in_executor(None, lambda: get_recent_messages(login))
    messages = [{"role": "system", "content": system}]
    messages += history
    messages.append({"role": "user", "content": req.message})

    tools = [REMEMBER_TOOL_SCHEMA] + ([TOOL_SCHEMA] if search_enabled() else [])

    def _groq_body():
        body = {
            "model": "llama-3.3-70b-versatile", "messages": messages,
            "max_tokens": 1024, "stream": True,
        }
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"
        return body

    async def event_stream():
        try:
            async with httpx.AsyncClient(timeout=40.0) as client:
                # Up to 3 rounds so the model can call web_search then answer.
                for _ in range(3):
                    full_content = ""
                    tool_calls_acc: dict[int, dict] = {}
                    finish_reason = None

                    async with client.stream(
                        "POST", "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                        json=_groq_body(),
                    ) as resp:
                        if resp.status_code >= 400:
                            err = (await resp.aread()).decode(errors="replace")
                            yield f"data: {json.dumps({'error': f'Groq API error: {err}'})}\n\n"
                            return
                        async for line in resp.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            payload = line[len("data:"):].strip()
                            if payload == "[DONE]":
                                break
                            chunk  = json.loads(payload)
                            choice = chunk["choices"][0]
                            delta  = choice.get("delta", {})

                            if delta.get("content"):
                                full_content += delta["content"]
                                yield f"data: {json.dumps({'delta': delta['content']})}\n\n"

                            for tc in delta.get("tool_calls") or []:
                                idx  = tc.get("index", 0)
                                slot = tool_calls_acc.setdefault(idx, {"id": None, "name": None, "arguments": ""})
                                if tc.get("id"):
                                    slot["id"] = tc["id"]
                                fn = tc.get("function") or {}
                                if fn.get("name"):
                                    slot["name"] = fn["name"]
                                if fn.get("arguments"):
                                    slot["arguments"] += fn["arguments"]

                            if choice.get("finish_reason"):
                                finish_reason = choice["finish_reason"]

                    if finish_reason == "tool_calls" and tool_calls_acc:
                        yield f"data: {json.dumps({'tool_call': True})}\n\n"
                        messages.append({
                            "role": "assistant",
                            "content": full_content or None,
                            "tool_calls": [
                                {
                                    "id": slot["id"],
                                    "type": "function",
                                    "function": {"name": slot["name"], "arguments": slot["arguments"]},
                                }
                                for slot in tool_calls_acc.values()
                            ],
                        })
                        for slot in tool_calls_acc.values():
                            try:
                                args = json.loads(slot["arguments"] or "{}")
                            except Exception:
                                args = {}
                            if slot["name"] == "web_search":
                                search_result = await web_search(args.get("query", req.message))
                                result = search_result["text"]
                                if search_result["citations"]:
                                    yield f"data: {json.dumps({'citations': search_result['citations']})}\n\n"
                            elif slot["name"] == "remember_note":
                                result = await loop.run_in_executor(None, lambda a=args: remember(a.get("note", "")))
                            else:
                                result = "Unknown tool."
                            messages.append({
                                "role": "tool",
                                "tool_call_id": slot["id"],
                                "content": result,
                            })
                        continue  # let the model see the tool result and respond

                    await loop.run_in_executor(None, lambda: save_message(login, "user", req.message))
                    await loop.run_in_executor(None, lambda: save_message(login, "assistant", full_content))
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    return

                fallback = "I wasn't able to complete that lookup — try rephrasing?"
                yield f"data: {json.dumps({'delta': fallback})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"
        except httpx.HTTPStatusError as e:
            yield f"data: {json.dumps({'error': f'Groq API error: {e.response.text}'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

# ─── Sage conversation memory ─────────────────────────────────
@app.get("/ai/history")
async def ai_history(login: int = 0):
    """Restore the saved conversation for an account (used by the UI on load)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: get_all_messages(login))

@app.post("/ai/clear")
async def ai_clear(login: int = 0):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: clear_messages(login))
    return {"ok": True}

@app.post("/ai/analyze")
async def ai_analyze(req: AIAnalyzeRequest):
    from config import get_ai_api_key
    import httpx, json as _json
    api_key = get_ai_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured. Add it in Settings > AI Companion.")

    ctx      = req.context
    symbol   = ctx.get("symbol", "unknown")
    acct     = ctx.get("account", {})
    trades   = ctx.get("trades", [])
    patterns = ctx.get("patterns", {})
    sage_settings = get_ai_settings()

    pat_lines = []
    for tf, tf_data in (patterns or {}).items():
        obs  = tf_data.get("order_blocks", [])
        fvgs = tf_data.get("fvgs", [])
        bos  = tf_data.get("bos_mss", [])
        if not (obs or fvgs or bos):
            continue
        pat_lines.append(f"\n[{tf}]")
        for ob in obs[:4]:
            pat_lines.append(f"  OB {ob.get('direction','?')}: high={ob.get('high','?')} low={ob.get('low','?')}")
        for fvg in fvgs[:4]:
            pat_lines.append(f"  FVG {fvg.get('direction','?')}: high={fvg.get('high','?')} low={fvg.get('low','?')}")
        for b in bos[:3]:
            pat_lines.append(f"  BOS {b.get('direction','?')} @ {b.get('level','?')}")
    pattern_text = "".join(pat_lines) if pat_lines else "No pattern data yet."

    system = (
        "You are Sage, an expert Smart Money Concepts (SMC) trading analyst embedded in a trading app. "
        "You are given the raw detected market structure (order blocks, fair value gaps, breaks of structure). "
        "Your job is to CURATE it: pick only the most actionable levels and explain the setups clearly. "
        "The chart is kept clean — only the levels YOU return get drawn, so be selective.\n\n"
        + SAGE_PERSONAS.get(sage_settings.get("persona"), SAGE_PERSONAS["analytical"]) + "\n\n"
        "IMPORTANT for key_levels: return AT MOST 5 levels — the ones that actually matter "
        "(the nearest valid order block, a key FVG, the most recent break of structure, and the obvious "
        "target/liquidity). Use short, clear labels like 'Bullish OB', 'FVG', 'BOS', 'Daily high', "
        "'Liquidity'. Do NOT flood the chart with every structure.\n\n"
        "Respond with ONLY a valid JSON object — no markdown fences, no text outside the JSON.\n\n"
        "Required schema:\n"
        "{\n"
        '  "bias": "bullish"|"bearish"|"neutral",\n'
        '  "confidence": <0-100>,\n'
        '  "reason": "<1-2 sentence technical reason>",\n'
        '  "summary": "<3-5 sentence SMC analysis>",\n'
        '  "setup": {\n'
        '    "active": true|false,\n'
        '    "direction": "BUY"|"SELL"|null,\n'
        '    "entry": <number|null>,\n'
        '    "sl": <number|null>,\n'
        '    "tp": <number|null>,\n'
        '    "rr": <number|null>,\n'
        '    "rationale": "<brief reason>"\n'
        '  },\n'
        '  "key_levels": [\n'
        '    {"label":"<name>","price":<number>,"type":"support"|"resistance"|"target"}\n'
        '  ]\n'
        "}"
    )
    user_msg = (
        f"Symbol: {symbol}\n"
        f"Balance: {acct.get('currency','USD')} {acct.get('balance','N/A')}\n"
        f"Equity: {acct.get('equity','N/A')}\n"
        f"Open trades: {len(trades)}\n"
        f"SMC patterns:{pattern_text}\n\n"
        "Provide your market analysis."
    )
    if req.strategy:
        user_msg += f"\n\nUser's custom strategy to follow:\n{req.strategy}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_msg},
                    ],
                    "max_tokens": 1024,
                },
            )
            resp.raise_for_status()
            text = resp.json()["choices"][0]["message"]["content"].strip()
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1]
            if text.startswith("json"):
                text = text[4:].strip()
        result = _json.loads(text)
        # Enforce a clean chart: cap to the 5 most relevant levels even if the
        # model returns more.
        if isinstance(result.get("key_levels"), list):
            result["key_levels"] = result["key_levels"][:5]
        # Enforce the user's confidence threshold: a setup can still be
        # reported, but it's only marked "active" (tradeable) above the bar.
        threshold = sage_settings.get("confidence_threshold", 75)
        confidence = result.get("confidence")
        if isinstance(confidence, (int, float)) and confidence < threshold and isinstance(result.get("setup"), dict):
            result["setup"]["active"] = False
            note = f"Below your {threshold}% confidence threshold — not flagged as an active setup."
            result["setup"]["rationale"] = (result["setup"].get("rationale") or "").strip()
            result["setup"]["rationale"] = (result["setup"]["rationale"] + " " + note).strip()
        return result
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── History & Performance (persisted in local DB) ────────────
@app.get("/history")
async def history_endpoint(days: int = 30):
    loop = asyncio.get_event_loop()
    # Always sync a wide window so the DB accumulates, then return the view window.
    await loop.run_in_executor(None, lambda: sync_deal_history(max(days, 120)))
    return await loop.run_in_executor(None, lambda: get_history(days))

@app.get("/performance")
async def performance_endpoint():
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, sync_deal_history)
    return await loop.run_in_executor(None, get_performance)

# ─── Risk management ────────────────────────────────────────────
@app.get("/settings/risk")
async def risk_settings_get():
    return get_risk_settings()

@app.post("/settings/risk")
async def risk_settings_set(data: dict):
    save_risk_settings(data)
    return {"ok": True}

# ─── Alerts & Notifications ─────────────────────────────────────
class AlertRequest(BaseModel):
    symbol:    str
    condition: str   # "above" | "below"
    target:    float

@app.get("/alerts")
async def alerts_list():
    login = get_mt5_credentials()[0]
    loop  = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: list_alerts(login))

@app.post("/alerts")
async def alerts_create(req: AlertRequest):
    if req.condition not in ("above", "below"):
        raise HTTPException(400, "condition must be 'above' or 'below'")
    login = get_mt5_credentials()[0]
    loop  = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: create_alert(login, req.symbol, req.condition, req.target))

@app.delete("/alerts/{alert_id}")
async def alerts_delete(alert_id: int):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: delete_alert(alert_id))
    return {"ok": True}

@app.get("/alerts/log")
async def alerts_log(limit: int = 50):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: get_event_log(limit))

# ─── Asset screener ──────────────────────────────────────────────
@app.get("/screener")
async def screener_endpoint(timeframe: str = "H1"):
    minutes = TIMEFRAMES.get(timeframe, 60)
    loop    = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: scan_market(minutes))

# ─── Trade journal ───────────────────────────────────────────────
@app.get("/journal")
async def journal_list(limit: int = 100):
    login = get_mt5_credentials()[0]
    loop  = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: list_annotations(login, limit))

@app.get("/journal/{ticket}")
async def journal_get(ticket: int):
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, lambda: get_annotation(ticket))
    if result is None:
        raise HTTPException(404, "No journal entry for this ticket")
    return result

# ─── Economic calendar ───────────────────────────────────────────
@app.get("/settings/calendar-key")
async def calendar_key_get():
    from config import get_calendar_api_key
    return {"configured": bool(get_calendar_api_key())}

@app.post("/settings/calendar-key")
async def calendar_key_set(req: dict):
    from config import save_calendar_api_key
    save_calendar_api_key(req.get("key", ""))
    return {"ok": True}

@app.get("/economic-calendar")
async def economic_calendar_endpoint(days: int = 1):
    return await get_calendar_events(days)

# ─── Sage AI core config ──────────────────────────────────────────
@app.get("/settings/sage")
async def sage_settings_get():
    return get_ai_settings()

@app.post("/settings/sage")
async def sage_settings_set(data: dict):
    save_ai_settings(data)
    return {"ok": True}

# ─── WebSocket (market data) ──────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)

# ─── Tick WebSocket ───────────────────────────────────────────
_tick_clients: dict[str, set] = {}

async def tick_broadcaster():
    """Push MT5 ticks to subscribed WS clients as fast as MT5 delivers them.
    A background thread polls every 1ms and only enqueues when tick.time changes."""
    loop  = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def _poll():
        # 50ms = 20Hz: smooth enough to look live, light on the shared MT5
        # lock. Only broadcasts when tick.time actually changes, so a quiet
        # market produces zero traffic. Skips entirely when disconnected —
        # pattern_loop owns reconnection, this thread never drives it.
        last_times: dict[str, int] = {}
        while True:
            time.sleep(0.05)
            active = [s for s, c in _tick_clients.items() if c]
            if not active or not is_connected():
                continue
            for symbol in active:
                tick = get_symbol_tick(symbol)
                if not tick:
                    continue
                t = tick.get("time", 0)
                if last_times.get(symbol) == t:
                    continue
                last_times[symbol] = t
                loop.call_soon_threadsafe(queue.put_nowait, (symbol, tick))

    threading.Thread(target=_poll, daemon=True).start()

    while True:
        symbol, tick = await queue.get()
        clients = _tick_clients.get(symbol, set())
        if not clients:
            continue
        # Tag every tick with the exact provider and subscription symbol. The
        # chart rejects untagged/mismatched ticks to prevent cross-feed price
        # contamination after a fast source switch.
        msg = json.dumps({**tick, "provider": _local_market_provider(), "symbol": symbol})
        dead = set()
        for ws in list(clients):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        clients -= dead

@app.websocket("/ws/ticks/{symbol}")
async def tick_ws(websocket: WebSocket, symbol: str):
    await websocket.accept()
    if symbol not in _tick_clients:
        _tick_clients[symbol] = set()
    _tick_clients[symbol].add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        _tick_clients.get(symbol, set()).discard(websocket)


@app.websocket("/ws/market/oanda/{symbol}")
async def oanda_tick_ws(websocket: WebSocket, symbol: str):
    """Relay the read-only OANDA pricing stream to the chart.

    This route is intentionally OANDA-specific. Local MT5 execution quotes
    continue to use /ws/ticks so the two identities cannot be swapped by a
    loose provider parameter.
    """
    await websocket.accept()
    try:
        async for tick in stream_oanda_prices(symbol):
            await websocket.send_text(json.dumps(tick))
    except WebSocketDisconnect:
        return
    except MarketProviderError as exc:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "provider": "oanda",
                "symbol": symbol,
                "detail": str(exc),
            }))
            await websocket.close(code=1011)
        except Exception:
            pass

# ─── Entry point ──────────────────────────────────────────────
if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()   # required for PyInstaller on Windows

    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, reload=False)
