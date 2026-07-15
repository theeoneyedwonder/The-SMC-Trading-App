"""Price alerts + system event log — backs the Alerts & Notifications center.

Distinct from alerts.py (OS-level desktop toast notifications); this module
owns user-defined price alerts and the persisted event feed shown in the UI.
"""
from datetime import datetime, timezone
from database import SessionLocal
from models import PriceAlert, EventLog
from mt5_client import get_quote


def _alert_to_dict(a: PriceAlert) -> dict:
    return {
        "id": a.id, "symbol": a.symbol, "condition": a.condition, "target": a.target,
        "enabled": a.enabled, "triggered": a.triggered,
        "triggered_at": a.triggered_at.isoformat() if a.triggered_at else None,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def create_alert(login: int, symbol: str, condition: str, target: float) -> dict:
    db = SessionLocal()
    try:
        a = PriceAlert(login=login, symbol=symbol, condition=condition, target=target)
        db.add(a)
        db.commit()
        db.refresh(a)
        return _alert_to_dict(a)
    finally:
        db.close()


def list_alerts(login: int) -> list:
    db = SessionLocal()
    try:
        rows = (db.query(PriceAlert)
                  .filter(PriceAlert.login == login)
                  .order_by(PriceAlert.id.desc())
                  .all())
        return [_alert_to_dict(a) for a in rows]
    finally:
        db.close()


def delete_alert(alert_id: int) -> None:
    db = SessionLocal()
    try:
        db.query(PriceAlert).filter(PriceAlert.id == alert_id).delete()
        db.commit()
    finally:
        db.close()


def check_alerts() -> list:
    """Check every enabled, untriggered alert against a live quote. Marks
    hits as triggered and returns them so the caller can log/broadcast."""
    db = SessionLocal()
    try:
        rows = (db.query(PriceAlert)
                  .filter(PriceAlert.enabled == True, PriceAlert.triggered == False)  # noqa: E712
                  .all())
        if not rows:
            return []

        by_symbol: dict[str, list] = {}
        for a in rows:
            by_symbol.setdefault(a.symbol, []).append(a)

        triggered = []
        for symbol, symbol_alerts in by_symbol.items():
            q = get_quote(symbol)
            last = q.get("last")
            if not last:
                continue
            for a in symbol_alerts:
                hit = (a.condition == "above" and last >= a.target) or \
                      (a.condition == "below" and last <= a.target)
                if hit:
                    a.triggered = True
                    a.triggered_at = datetime.now(timezone.utc)
                    triggered.append(_alert_to_dict(a))
        if triggered:
            db.commit()
        return triggered
    finally:
        db.close()


def log_event(kind: str, title: str, message: str, value: str | None = None, symbol: str | None = None) -> None:
    db = SessionLocal()
    try:
        db.add(EventLog(kind=kind, title=title, message=message, value=value, symbol=symbol))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[EVENTLOG] save error: {e}")
    finally:
        db.close()


def get_event_log(limit: int = 50) -> list:
    db = SessionLocal()
    try:
        rows = db.query(EventLog).order_by(EventLog.id.desc()).limit(limit).all()
        return [{
            "id": r.id, "kind": r.kind, "title": r.title, "message": r.message,
            "value": r.value, "symbol": r.symbol,
            "time": r.created_at.isoformat() if r.created_at else None,
        } for r in rows]
    finally:
        db.close()
