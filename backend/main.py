import asyncio
import json
import os
import threading
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import (
    HOST, PORT, AVAILABLE_SYMBOLS, TIMEFRAMES,
    is_configured, get_mt5_credentials,
    get_active_symbol, save_active_symbol,
    save_mt5_credentials, clear_mt5_credentials,
)
from database import init_db
from mt5_client import (
    connect, disconnect, get_open_trades, get_account_info,
    is_connected, select_symbol,
    get_symbol_tick, execute_market_order,
    get_account_snapshot, get_quote, _mt5_lock,
)
from data import get_all_timeframes, get_candles
from history_sync import sync_deal_history, get_history, get_performance
from chat_memory import save_message, get_recent_messages, get_all_messages, clear_messages
from web_search import web_search, search_enabled, TOOL_SCHEMA
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

            # Only patterns/indicators here — account/trades flow via account_loop
            await manager.broadcast({
                "type"       : "patterns",
                "symbol"     : symbol,
                "indicators" : indicators,
                "patterns"   : patterns,
            })

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


# ─── Lifespan ─────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _wake_loop
    _wake_loop = asyncio.Event()
    print("[BOT] Starting up...")
    init_db()
    # Don't block startup on connect — pattern_loop establishes the
    # connection in the background so the UI/HTTP server is up instantly.
    asyncio.create_task(pattern_loop())
    asyncio.create_task(account_loop())
    asyncio.create_task(tick_broadcaster())
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
    with _mt5_lock:
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

@app.get("/symbols/search")
def symbols_search(q: str = "", limit: int = 40):
    """Search ALL broker symbols by name substring (for the watchlist search box)."""
    import MetaTrader5 as _mt5
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

# ─── Tick & Trade ─────────────────────────────────────────────
@app.get("/tick/{symbol}")
def tick_endpoint(symbol: str):
    return get_symbol_tick(symbol)

class TradeRequest(BaseModel):
    symbol: str
    lot:    float
    type:   str   # "BUY" | "SELL"

@app.post("/trade/market")
async def market_order(req: TradeRequest):
    loop   = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, lambda: execute_market_order(req.symbol, req.lot, req.type)
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Trade failed"))
    if _wake_loop:
        _wake_loop.set()   # refresh trades immediately
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

    # ── Personality (broadened: markets + general knowledge) ──────
    system = (
        "You are Sage, an advanced AI trading companion integrated into an institutional-grade trading platform. "
        "You assist with market analysis, Smart Money Concepts (SMC), chart interpretation, and the user's live "
        "trades and account — and you can also answer general questions, world knowledge, and news. "
        "You communicate naturally, intelligently, and professionally; be concise and precise. "
        "When discussing markets, use SMC terminology (order blocks, fair value gaps, liquidity sweeps, market "
        "structure, premium/discount zones).\n\n"
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

    if search_enabled():
        system += ("\nYou have a web_search tool for current/real-time info (news, live events, "
                   "recent prices). Use it whenever the answer depends on information after your "
                   "training cutoff; otherwise answer directly.")

    # ── Conversation memory: prior turns, then the new message ────
    history  = await loop.run_in_executor(None, lambda: get_recent_messages(login))
    messages = [{"role": "system", "content": system}]
    messages += history
    messages.append({"role": "user", "content": req.message})

    tools = [TOOL_SCHEMA] if search_enabled() else None

    def _groq_body():
        body = {"model": "llama-3.3-70b-versatile", "messages": messages, "max_tokens": 1024}
        if tools:
            body["tools"] = tools
            body["tool_choice"] = "auto"
        return body

    try:
        async with httpx.AsyncClient(timeout=40.0) as client:
            # Up to 3 rounds so the model can call web_search then answer.
            for _ in range(3):
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=_groq_body(),
                )
                resp.raise_for_status()
                msg = resp.json()["choices"][0]["message"]

                tool_calls = msg.get("tool_calls")
                if not tool_calls:
                    reply = msg.get("content", "") or ""
                    break

                # Execute the requested tool calls, feed results back to the model
                messages.append(msg)
                for tc in tool_calls:
                    args = {}
                    try:
                        import json as _j
                        args = _j.loads(tc["function"].get("arguments") or "{}")
                    except Exception:
                        pass
                    if tc["function"]["name"] == "web_search":
                        result = await web_search(args.get("query", req.message))
                    else:
                        result = "Unknown tool."
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result,
                    })
            else:
                reply = "I wasn't able to complete that lookup — try rephrasing?"

            await loop.run_in_executor(None, lambda: save_message(login, "user", req.message))
            await loop.run_in_executor(None, lambda: save_message(login, "assistant", reply))
            return {"reply": reply}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        msg  = json.dumps(tick)
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

# ─── Entry point ──────────────────────────────────────────────
if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()   # required for PyInstaller on Windows

    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, reload=False)
