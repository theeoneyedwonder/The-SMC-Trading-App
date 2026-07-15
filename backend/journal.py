"""Trade journal — auto-captures the SMC context (most recent OB/FVG/BOS)
that was live for a symbol at the moment a trade was opened, so every
position has an answer to "why was this taken" without the trader having
to write it down manually.
"""
from database import SessionLocal
from models import TradeAnnotation


def _to_dict(r: TradeAnnotation) -> dict:
    return {
        "ticket": r.ticket, "symbol": r.symbol, "direction": r.direction,
        "setup_kind": r.setup_kind, "setup_direction": r.setup_direction,
        "setup_timeframe": r.setup_timeframe, "note": r.note,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def annotate_trade(ticket: int, login: int, symbol: str, direction: str,
                    setup_kind: str | None = None, setup_direction: str | None = None,
                    setup_timeframe: str | None = None, note: str | None = None) -> None:
    db = SessionLocal()
    try:
        db.add(TradeAnnotation(
            ticket=ticket, login=login, symbol=symbol, direction=direction,
            setup_kind=setup_kind, setup_direction=setup_direction,
            setup_timeframe=setup_timeframe, note=note,
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[JOURNAL] save error: {e}")
    finally:
        db.close()


def get_annotation(ticket: int) -> dict | None:
    db = SessionLocal()
    try:
        row = db.query(TradeAnnotation).filter(TradeAnnotation.ticket == ticket).first()
        return _to_dict(row) if row else None
    finally:
        db.close()


def list_annotations(login: int, limit: int = 100) -> list:
    db = SessionLocal()
    try:
        rows = (db.query(TradeAnnotation)
                  .filter(TradeAnnotation.login == login)
                  .order_by(TradeAnnotation.id.desc())
                  .limit(limit)
                  .all())
        return [_to_dict(r) for r in rows]
    finally:
        db.close()
