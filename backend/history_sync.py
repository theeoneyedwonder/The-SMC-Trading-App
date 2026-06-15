"""Account trade-history persistence.

MT5's `history_deals_get` only returns what the terminal currently holds, and is
fragile around broker-vs-local timezones. We mirror every closed deal into the
local SQLite DB so the history is retained permanently and survives reconnects,
restarts, and MT5's own rolling history window.
"""
from datetime import datetime, timedelta

import MetaTrader5 as mt5
from mt5_client import ensure_connected, _mt5_lock
from database import SessionLocal
from models import Deal

_ENTRY = {0: "IN", 1: "OUT", 2: "INOUT", 3: "OUT_BY"}


def _current_login() -> int:
    with _mt5_lock:
        acct = mt5.account_info()
    return int(acct.login) if acct else 0


def sync_deal_history(days: int = 120) -> int:
    """Pull deals from MT5 and upsert into the DB. Returns # of new rows.

    Uses a +1 day upper bound because MT5 deal times are in BROKER SERVER time,
    which is usually ahead of local time — a plain `now` upper bound silently
    drops trades that were just closed."""
    if not ensure_connected():
        return 0

    now = datetime.now()
    frm = now - timedelta(days=max(days, 1))
    to  = now + timedelta(days=1)          # buffer for broker-vs-local timezone skew

    with _mt5_lock:
        acct  = mt5.account_info()
        deals = mt5.history_deals_get(frm, to)

    login = int(acct.login) if acct else 0
    if not deals:
        return 0

    db = SessionLocal()
    added = 0
    try:
        for d in deals:
            if not d.symbol:               # skip balance / credit / commission-only ops
                continue
            row = db.query(Deal).filter_by(ticket=int(d.ticket)).first()
            if row:
                row.profit = float(d.profit)   # keep realized P&L fresh
                continue
            db.add(Deal(
                ticket      = int(d.ticket),
                position_id = int(d.position_id),
                order_id    = int(d.order),
                login       = login,
                time        = int(d.time),
                symbol      = d.symbol,
                direction   = "BUY" if d.type == 0 else "SELL",
                entry_type  = _ENTRY.get(d.entry, "?"),
                volume      = float(d.volume),
                price       = float(d.price),
                profit      = float(d.profit),
                commission  = float(d.commission),
                swap        = float(d.swap),
            ))
            added += 1
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[HISTORY] sync error: {e}")
    finally:
        db.close()

    if added:
        print(f"[HISTORY] synced {added} new deal(s)")
    return added


def get_history(days: int = 30) -> list:
    """Closed trades for the current account, grouped by position so commission
    and swap are netted across each position's open + close deals. Profit is the
    realized NET (gross profit + commission + swap)."""
    from collections import defaultdict

    login  = _current_login()
    cutoff = int((datetime.now() - timedelta(days=days)).timestamp())

    db = SessionLocal()
    try:
        q = db.query(Deal).filter(Deal.time >= cutoff)
        if login:
            q = q.filter(Deal.login == login)
        rows = q.order_by(Deal.time.asc()).all()
    finally:
        db.close()

    # Group all deals (IN + OUT) by position so we can net the costs.
    groups = defaultdict(list)
    for r in rows:
        groups[r.position_id].append(r)

    trades = []
    for pid, deals in groups.items():
        deals.sort(key=lambda d: (d.time, d.ticket))
        ins  = [d for d in deals if d.entry_type == "IN"]
        outs = [d for d in deals if d.entry_type in ("OUT", "INOUT", "OUT_BY")]
        if not outs:
            continue   # position still open / no close recorded yet

        open_deal  = ins[0] if ins else deals[0]
        close_deal = outs[-1]
        gross      = sum(d.profit for d in deals)
        commission = sum(d.commission for d in deals)
        swap       = sum(d.swap for d in deals)

        trades.append({
            "ticket"     : close_deal.ticket,
            "position_id": pid,
            "time"       : close_deal.time,          # close time
            "open_time"  : open_deal.time,
            "symbol"     : close_deal.symbol,
            "direction"  : open_deal.direction,      # TRUE trade direction (from the entry deal)
            "volume"     : open_deal.volume,
            "entry"      : open_deal.price,
            "price"      : close_deal.price,          # exit price
            "profit"     : round(gross, 2),           # gross P&L (before costs)
            "commission" : round(commission, 2),
            "swap"       : round(swap, 2),
            "net"        : round(gross + commission + swap, 2),   # realized net
        })

    trades.sort(key=lambda t: t["time"])
    return trades


def get_performance() -> dict:
    """Aggregate realized P&L (today / week / month) from the persisted DB."""
    login = _current_login()
    now   = datetime.now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week  = today - timedelta(days=today.weekday())
    month = today.replace(day=1)

    def since(dt):
        cutoff = int(dt.timestamp())
        db = SessionLocal()
        try:
            q = db.query(Deal).filter(Deal.time >= cutoff)
            if login:
                q = q.filter(Deal.login == login)
            rows = q.all()
        finally:
            db.close()
        # Net total across ALL deals (gross profit + commission + swap)
        total  = sum(r.profit + r.commission + r.swap for r in rows)
        closes = [r for r in rows if r.entry_type != "IN"]
        wins   = sum(1 for r in closes if r.profit > 0)
        rate   = (wins / len(closes) * 100) if closes else 0.0
        return round(total, 2), len(closes), round(rate, 1)

    tp, tc, tw = since(today)
    wp, _, _   = since(week)
    mp, _, _   = since(month)
    return {"today": tp, "week": wp, "month": mp, "trades_today": tc, "win_rate": tw}
