# QUANT_CORE

> AI-assisted SMC trading workstation for MetaTrader 5 — live charts, automatic pattern detection, and Sage, an AI trading companion.

A desktop trading application built around **Smart Money Concepts (SMC)** methodology. It connects to a live MetaTrader 5 account and combines real-time market data, automated SMC pattern detection, interactive chart drawing tools, and **Sage** — a streaming AI companion that watches your account and the market — into a single self-contained app.

---

## Download

Head to the [Releases](../../releases) page for the latest installer, or build a fresh Windows installer yourself from the **Actions** tab (see [Building](#building)).

**Requirements (end users):**
- Windows 10 / 11 (x64)
- [MetaTrader 5](https://www.metatrader5.com/en/download) installed and logged in to a live or demo account
- A free [Groq API key](https://console.groq.com) *(optional — only needed for Sage)*
- A free [Tavily API key](https://tavily.com) *(optional — only needed to give Sage live web search)*

No Python, Node.js, or any other runtime needed. The installer is fully self-contained.

---

## Features

- **Live MT5 integration** — streams account data, open positions, and floating P&L over WebSocket in real time (~300ms heartbeat, tick-level price updates)
- **SMC pattern detection** — automatically identifies Order Blocks, Fair Value Gaps, and Break of Structure / Market Structure Shifts across M1 → D1 timeframes
- **Interactive charting** — TradingView Lightweight Charts with SMC zone overlays; draw trend lines, rectangles, Fibonacci retracements, and horizontal levels directly on the chart
- **Sage — AI companion** — powered by Groq (Llama 3.3 70B):
  - **Streaming replies** — answers arrive token-by-token, not in one delayed block
  - **Proactive nudges** — Sage speaks up *unprompted* when a new higher-timeframe (H1/H4/D1) break of structure forms
  - **Standalone window** — Sage opens as its own top-level OS window, so tiling window managers (Windows Snap, Hyprland, etc.) can place it beside the chart instead of it overlaying the workspace
  - **Structured analysis** — generates a directional bias, confidence score, and suggested entry / SL / TP, and curates a clean set of key levels drawn straight onto the chart
  - **Live context + memory** — sees your account, open trades, and multi-timeframe structure, and remembers the conversation per account
  - **Web search** — optional Tavily-backed live search for news and current events
  - **Custom strategy** — upload or paste your own trading rules for Sage to follow
- **Trade history & performance** — persisted closed-trade log and P&L metrics by day, week, and month
- **Themes** — multiple presets including a **Brutalist** default (black canvas, hard edges, one loud accent), plus full per-color overrides and font scaling

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React + Vite |
| Charts | TradingView Lightweight Charts v5 |
| Backend | Python FastAPI + WebSocket (bundled via PyInstaller) |
| Broker bridge | MetaTrader 5 (`MetaTrader5` Python package) |
| AI | Groq API — Llama 3.3 70B |
| Web search | Tavily API (optional) |

---

## Dev Setup

There are two ways to run the app in development.

### Option A — Full setup (real MetaTrader 5, Windows)

**Terminal 1 — backend**
```bash
cd backend
pip install -r requirements.txt
python main.py
```

**Terminal 2 — frontend**
```bash
cd v2
npm install
npm run dev:all
```

The app opens as an Electron window. On first launch a setup wizard prompts for your MT5 login, password, and server.

### Option B — Mock mode (no MT5, runs on Linux / macOS / Windows)

The `MetaTrader5` package is Windows-only, which normally makes the backend impossible to run anywhere else. **Mock mode** swaps it for a fake implementation (`backend/mt5_mock.py`) that serves synthetic account, trade, and candle data — so the *real* backend (connection handling, SMC pattern detection, every endpoint, and Sage) runs unchanged for UI development and testing, no VM or Wine required.

**Terminal 1 — backend (mock)**
```bash
cd backend
pip install -r requirements-dev-linux.txt   # same as requirements.txt minus MetaTrader5
SMC_MOCK=1 python main.py
```

**Terminal 2 — frontend**
```bash
cd v2
npm install
npm run dev        # browser-only, hot-reloading
# or: npm run dev:all   # full Electron shell
```

> Mock mode is for development only. The Windows/production build is completely unaffected by it.

---

## Building

The production build bundles the Python backend (PyInstaller) with the Electron frontend into a Windows installer. Because `MetaTrader5` and PyInstaller are Windows-only and don't cross-compile, this **must run on Windows**.

### Cloud build (recommended when developing on Linux/macOS)

A GitHub Actions workflow builds the installer on a real Windows runner:

1. Go to the repo's **Actions** tab → **Build Windows Installer** → **Run workflow**
2. When it finishes, download the `QUANT_CORE-Windows` artifact — it contains both the Setup installer and the portable `.exe`

### Local build (on Windows)

| Script | What it does |
|---|---|
| `.\build.bat` | Full rebuild (PyInstaller + Vite + installer) |
| `.\build-frontend.bat` | Frontend + installer only (~30 sec) |
| `.\build-backend.bat` | Python backend + installer only |

Output goes to `release\`. The **portable** `.exe` runs without installing; the **Setup** `.exe` is the full installer for end users.

---

## Configuration

- **MT5 credentials** — entered via the in-app setup wizard; stored in `%APPDATA%\QUANT_CORE\settings.json`
- **Groq API key** — added in **Settings → AI Companion**; free at [console.groq.com](https://console.groq.com)
- **Tavily API key** — added in **Settings → AI Companion** to enable Sage's web search; free at [tavily.com](https://tavily.com)

---

## Architecture

```
Electron (main.js)
  ├── Main window — React UI (Vite / dist)
  │     ├── TradingView Lightweight Charts
  │     ├── Chart drawing overlay (Canvas)
  │     └── WebSocket client (live + patterns + nudges)
  ├── Sage window — standalone, tileable AI companion
  │     └── shares the same backend + a same-origin channel to mark chart levels
  └── FastAPI backend (PyInstaller bundle, or python main.py in dev)
        ├── MetaTrader5 bridge      (or mt5_mock.py when SMC_MOCK=1)
        ├── SMC pattern analyser    (order blocks, FVGs, BOS/MSS)
        ├── Proactive nudge diff    (surfaces new HTF structure)
        ├── Sage — streaming chat + structured analysis (Groq)
        └── Web search (Tavily, optional)
```

---

## Recent Updates

- **Sage now streams** its chat responses token-by-token (SSE), instead of waiting for the full reply.
- **Proactive Sage** — the backend diffs each analysis cycle's higher-timeframe breaks of structure and has Sage surface genuinely new ones unprompted, over the live WebSocket.
- **Sage is now its own window** — a real top-level OS window that tiling WMs can place independently, with its size and position remembered across launches. Falls back to an in-page panel in a plain browser.
- **Native non-Windows dev mode** (`SMC_MOCK=1`) so the whole app — backend included — runs and can be UI-tested on Linux/macOS without MetaTrader 5.
- **Windows CI** — a GitHub Actions workflow produces the installer + portable exe on a Windows runner on demand.
- **Brutalist theme** — a new default look (black canvas, sharp corners, hard offset shadows, single lime accent), alongside the existing presets which now share the same structural language.
- **UI fixes** — layout no longer clips at narrow/tiled widths; chart price-scale autoscale race fixed; watchlist and Sage no longer auto-open; various overlap and animation polish.

---

## License

MIT — see [LICENSE](LICENSE)
