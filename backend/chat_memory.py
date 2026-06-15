"""Sage's conversation memory.

Persists chat turns in SQLite so Sage remembers prior discussion across reloads
and restarts. Scoped per account login. This is what turns Sage from a stateless
chatbot into an assistant that stays aware of the ongoing conversation.
"""
from database import SessionLocal
from models import ChatMessage

# How many prior turns to feed back into the model on each request. Kept modest
# to respect Groq's per-minute token limits — bigger = more context but more tokens.
HISTORY_LIMIT = 12


def save_message(login: int, role: str, content: str) -> None:
    db = SessionLocal()
    try:
        db.add(ChatMessage(login=int(login or 0), role=role, content=content))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[MEMORY] save error: {e}")
    finally:
        db.close()


def get_recent_messages(login: int, limit: int = HISTORY_LIMIT) -> list:
    """Last `limit` turns, oldest-first — ready to splice into the LLM messages."""
    db = SessionLocal()
    try:
        rows = (db.query(ChatMessage)
                  .filter(ChatMessage.login == int(login or 0))
                  .order_by(ChatMessage.id.desc())
                  .limit(limit)
                  .all())
        rows.reverse()
        return [{"role": r.role, "content": r.content} for r in rows]
    finally:
        db.close()


def get_all_messages(login: int, limit: int = 200) -> list:
    """Full recent history (oldest-first) for restoring the chat UI on load."""
    db = SessionLocal()
    try:
        rows = (db.query(ChatMessage)
                  .filter(ChatMessage.login == int(login or 0))
                  .order_by(ChatMessage.id.asc())
                  .limit(limit)
                  .all())
        return [{"role": r.role, "content": r.content} for r in rows]
    finally:
        db.close()


def clear_messages(login: int) -> None:
    db = SessionLocal()
    try:
        db.query(ChatMessage).filter(ChatMessage.login == int(login or 0)).delete()
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[MEMORY] clear error: {e}")
    finally:
        db.close()
