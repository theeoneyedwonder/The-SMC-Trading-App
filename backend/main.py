import asyncio
import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import (
    HOST, PORT, AVAILABLE_SYMBOLS, TIMEFRAMES,
    is_configured, get_mt5_credentials,
    get_active_symbol, save_active_symbol,
    save_mt5_credentials,
)
from database import init_db
from mt5_client import (
    connect, disconnect, get_open_trades, get_account_info,
    is_connected, select_symbol,
)
from data import get_all_timeframes, get_candles
from indicators import analyse_all_timeframes
from patterns import analyse_patterns
from alerts import (
    alert_connection_lost, alert_reconnected,
    alert_trade_opened, alert_trade_closed,
)

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

# ─── Bot loop ─────────────────────────────────────────────────
async def bot_loop():
    prev_tickets: set = set()
    was_connected     = False

    while True:
        try:
            # Wait for the user to finish setup before doing anything
            if not is_configured():
                await asyncio.sleep(5)
                continue

            connected = is_connected()

            if not connected:
                if was_connected:
                    alert_connection_lost()
                print("[BOT] Reconnecting...")
                connected = connect()
                if connected:
                    alert_reconnected()

            was_connected = connected

            if not connected:
                await asyncio.sleep(10)
                continue

            symbol     = get_active_symbol()
            tf_data    = get_all_timeframes(symbol=symbol)
            indicators = analyse_all_timeframes(tf_data)
            patterns   = analyse_patterns(tf_data)
            account    = get_account_info()
            raw_trades = get_open_trades(symbol=symbol)

            current_tickets = {t.ticket for t in raw_trades}
            for t in raw_trades:
                if t.ticket not in prev_tickets:
                    alert_trade_opened("BUY" if t.type == 0 else "SELL",
                                       t.price_open, t.sl, t.tp)
            for ticket in prev_tickets - current_tickets:
                alert_trade_closed("CLOSED", 0, 0)
            prev_tickets = current_tickets

            trades = [
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
                for t in raw_trades
            ]

            await manager.broadcast({
                "symbol"     : symbol,
                "account"    : account,
                "trades"     : trades,
                "indicators" : indicators,
                "patterns"   : patterns,
            })

            print(f"[BOT] {symbol} | {len(trades)} trade(s)")

        except Exception as e:
            print(f"[BOT] Loop error: {e}")

        # Sleep 60 s, but wake immediately if setup/reconnect requests it
        try:
            await asyncio.wait_for(_wake_loop.wait(), timeout=60)  # type: ignore[union-attr]
            _wake_loop.clear()  # type: ignore[union-attr]
        except asyncio.TimeoutError:
            pass


# ─── Lifespan ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _wake_loop
    _wake_loop = asyncio.Event()
    print("[BOT] Starting up...")
    init_db()
    if is_configured():
        connect()
    asyncio.create_task(bot_loop())
    yield
    print("[BOT] Shutting down...")
    disconnect()


# ─── App ──────────────────────────────────────────────────────
app = FastAPI(title="SMC Bot", lifespan=lifespan)

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

@app.get("/setup/check-mt5")
def check_mt5_installed():
    """Detect whether MT5 terminal is installed on this machine."""
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
    import MetaTrader5 as mt5

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

# ─── Standard endpoints ───────────────────────────────────────
@app.get("/")
def root():
    return {"status": "SMC Bot running"}

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
    import MetaTrader5 as _mt5
    if not is_connected():
        return {"symbols": [], "connected": False}
    raw = _mt5.symbols_get()
    if not raw:
        return {"symbols": [], "connected": True}
    names = sorted(s.name for s in raw if s.visible)
    return {"symbols": names, "connected": True}

@app.post("/symbol/{symbol}")
def set_symbol(symbol: str):
    select_symbol(symbol)
    save_active_symbol(symbol)
    if _wake_loop:
        _wake_loop.set()
    return {"symbol": symbol}

@app.get("/candles/{symbol}/{timeframe}")
def candles_endpoint(symbol: str, timeframe: str):
    if timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"Unknown timeframe: {timeframe}")
    df = get_candles(symbol=symbol, timeframe_minutes=TIMEFRAMES[timeframe])
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

# ─── AI Chat & Analyze ───────────────────────────────────────
class AIChatRequest(BaseModel):
    message: str
    context: dict = {}

class AIAnalyzeRequest(BaseModel):
    context: dict = {}

@app.post("/ai/chat")
async def ai_chat(req: AIChatRequest):
    from config import get_ai_api_key
    api_key = get_ai_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured. Add it in Settings > AI Companion.")

    ctx = req.context
    acct = ctx.get("account", {})
    trades = ctx.get("trades", [])
    symbol = ctx.get("symbol", "unknown")

    system = (
        "You are an expert Smart Money Concepts (SMC) trading companion embedded in a professional trading app. "
        "You have access to live market data and the user's MT5 account. "
        "Be concise, precise, and professional. Use SMC terminology: order blocks, fair value gaps, "
        "liquidity sweeps, market structure, premium/discount zones, etc.\n\n"
        f"Current market: {symbol}\n"
        f"Account balance: {acct.get('currency','USD')} {acct.get('balance', 'N/A')}\n"
        f"Equity: {acct.get('equity', 'N/A')}\n"
        f"Open P&L: {acct.get('profit', 'N/A')}\n"
        f"Open trades: {len(trades)}\n"
    )
    if trades:
        system += "Positions:\n"
        for t in trades:
            system += f"  - {t.get('symbol')} {t.get('direction')} {t.get('lots')} lots @ {t.get('entry')} | P&L: {t.get('profit')}\n"

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": req.message}],
        )
        return {"reply": response.content[0].text}
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic package not installed. Run: pip install anthropic")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/analyze")
async def ai_analyze(req: AIAnalyzeRequest):
    from config import get_ai_api_key
    api_key = get_ai_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="No AI API key configured. Add it in Settings > AI Companion.")

    ctx      = req.context
    symbol   = ctx.get("symbol", "unknown")
    acct     = ctx.get("account", {})
    trades   = ctx.get("trades", [])
    patterns = ctx.get("patterns", {})

    # Summarise detected patterns across timeframes
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
        "You are an expert Smart Money Concepts (SMC) trading analyst. "
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

    try:
        import anthropic
        import json as _json
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1]
            if text.startswith("json"):
                text = text[4:].strip()
        return _json.loads(text)
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic package not installed. Run: pip install anthropic")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── History & Performance ────────────────────────────────────
@app.get("/history")
def history_endpoint(days: int = 30):
    import MetaTrader5 as mt5
    from datetime import datetime, timedelta
    if not is_connected():
        return []
    now   = datetime.now()
    deals = mt5.history_deals_get(now - timedelta(days=days), now)
    if not deals:
        return []
    return [
        {"ticket":d.ticket,"time":int(d.time),"symbol":d.symbol,
         "direction":"BUY" if d.type==0 else "SELL",
         "volume":float(d.volume),"price":float(d.price),
         "profit":float(d.profit),"commission":float(d.commission),"swap":float(d.swap)}
        for d in deals if d.symbol
    ]

@app.get("/performance")
def performance_endpoint():
    import MetaTrader5 as mt5
    from datetime import datetime, timedelta
    if not is_connected():
        return {"today":0,"week":0,"month":0,"trades_today":0,"win_rate":0}
    now   = datetime.now()
    today = now.replace(hour=0,minute=0,second=0,microsecond=0)
    week  = today - timedelta(days=today.weekday())
    month = today.replace(day=1)
    def pnl_since(from_dt):
        deals = mt5.history_deals_get(from_dt, now)
        if not deals:
            return 0.0, 0, 0.0
        closed = [d for d in deals if d.symbol and d.profit != 0]
        total  = sum(d.profit for d in closed)
        wins   = sum(1 for d in closed if d.profit > 0)
        rate   = (wins/len(closed)*100) if closed else 0.0
        return round(total,2), len(closed), round(rate,1)
    tp, tc, tw = pnl_since(today)
    wp, _,  _  = pnl_since(week)
    mp, _,  _  = pnl_since(month)
    return {"today":tp,"week":wp,"month":mp,"trades_today":tc,"win_rate":tw}

# ─── WebSocket ────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)

# ─── Entry point ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
