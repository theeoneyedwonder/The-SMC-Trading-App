"""Sage's durable cross-conversation memory — distinct from chat_memory.py
(which just persists raw turn-by-turn chat history). This is a small set of
notes Sage has explicitly chosen to remember about the trader (risk
tolerance, preferred instruments, trading style) via a tool call, injected
back into the system prompt on every future conversation.
"""
from config import get_sage_notes, add_sage_note

REMEMBER_TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "remember_note",
        "description": (
            "Save a short, durable note about the trader for future conversations — their risk "
            "tolerance, preferred instruments/sessions, trading style, or goals. Use this when the "
            "user shares something worth recalling long-term, not for one-off facts about the market."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "note": {"type": "string", "description": "A short note (one sentence) to remember"},
            },
            "required": ["note"],
        },
    },
}


def remember(note: str) -> str:
    note = (note or "").strip()
    if not note:
        return "No note provided."
    add_sage_note(note)
    return "Noted — I'll remember that."


def notes_context() -> str:
    """Formatted block for injection into the system prompt. Empty string
    when there's nothing remembered yet."""
    notes = get_sage_notes()
    if not notes:
        return ""
    bullets = "\n".join(f"- {n}" for n in notes)
    return f"\nThings you've learned about this trader from earlier conversations:\n{bullets}\n"
