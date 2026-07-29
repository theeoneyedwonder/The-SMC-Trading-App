"""Economic calendar — high-impact macro event tracker, via Finnhub's free
economic-calendar endpoint. Gated on a configured API key; same graceful
"not configured" / error-fallback pattern as the Tavily web-search
integration, so a missing or rate-limited key never crashes the endpoint.
"""
import httpx
from datetime import datetime, timedelta, timezone
from config import get_calendar_api_key

FINNHUB_URL = "https://finnhub.io/api/v1/calendar/economic"


def calendar_enabled() -> bool:
    return bool(get_calendar_api_key())


async def get_calendar_events(days_ahead: int = 1) -> dict:
    key = get_calendar_api_key()
    if not key:
        return {"configured": False, "events": []}

    today = datetime.now(timezone.utc).date()
    date_from = today
    date_to = today + timedelta(days=max(days_ahead, 0))

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(FINNHUB_URL, params={
                "from": date_from.isoformat(),
                "to": date_to.isoformat(),
                "token": key,
            })
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {"configured": True, "events": [], "error": str(e)}

    events = []
    for e in data.get("economicCalendar", []) or []:
        events.append({
            "time": e.get("time"),
            "country": e.get("country"),
            "event": e.get("event"),
            "impact": (e.get("impact") or "low").lower(),
            "actual": e.get("actual"),
            "estimate": e.get("estimate"),
            "previous": e.get("prev"),
            "unit": e.get("unit"),
        })
    events.sort(key=lambda e: e.get("time") or "")
    return {"configured": True, "events": events}
