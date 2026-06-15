"""Web search tool for Sage (via Tavily).

Gives Sage access to current information — news, world events, market headlines —
that the LLM's training data can't cover. Gated on a configured Tavily key; if no
key is set the tool is simply unavailable and Sage answers from its own knowledge.
"""
import httpx
from config import get_search_api_key

TAVILY_URL = "https://api.tavily.com/search"


def search_enabled() -> bool:
    return bool(get_search_api_key())


async def web_search(query: str, max_results: int = 5) -> str:
    """Run a web search and return a compact, model-friendly text summary."""
    key = get_search_api_key()
    if not key:
        return "Web search is not configured (no Tavily API key)."
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(TAVILY_URL, json={
                "api_key": key,
                "query": query,
                "max_results": max_results,
                "search_depth": "basic",
                "include_answer": True,
            })
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return f"Web search failed: {e}"

    parts = []
    if data.get("answer"):
        parts.append(f"Summary: {data['answer']}")
    for i, r in enumerate(data.get("results", [])[:max_results], 1):
        title   = r.get("title", "").strip()
        content = (r.get("content", "") or "").strip().replace("\n", " ")
        url     = r.get("url", "")
        parts.append(f"[{i}] {title}\n{content}\nSource: {url}")
    return "\n\n".join(parts) if parts else "No results found."


# OpenAI / Groq-style tool schema the model sees
TOOL_SCHEMA = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the web for current, real-time information: news, market headlines, "
            "economic events, prices of things, weather, or any fact that may have changed "
            "after your training cutoff. Use this whenever the user asks about recent or live events."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
            },
            "required": ["query"],
        },
    },
}
