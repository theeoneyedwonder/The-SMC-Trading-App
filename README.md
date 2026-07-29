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
- A free [Finnhub API key](https://finnhub.io/register) *(optional — only needed for the Economic Calendar)*

No Python, Node.js, or any other runtime needed. The installer is fully self-contained.

---

## Features

- **Live MT5 integration** — streams account data, open positions, and floating P&L over WebSocket in real time (~300ms heartbeat, tick-level price updates)
- **SMC pattern detection** — automatically identifies Order Blocks, Fair Value Gaps, and Break of Structure / Market Structure Shifts across M1 → D1 timeframes
- **Interactive charting** — TradingView Lightweight Charts with SMC zone overlays; draw trend lines, rectangles, Fibonacci retracements, and horizontal levels directly on the chart
- **Asset Screener** — scans every configured symbol for its most recent SMC signal (OB / FVG / BOS) and ranks them by a confidence score; one click loads a pair on the terminal
- **Alerts & Notifications** — user-defined price alerts plus a persistent system event log (executions, triggered alerts, Sage detections), backed by native desktop toasts
- **Economic Calendar** — high-impact macro events (CPI, rate decisions, NFP…) via Finnhub, filterable by time window and impact
- **Risk management** — daily-loss cap and drawdown lock, plus optional auto-breakeven and default stop-loss, all enforced server-side at execution time
- **Trade journal** — every position is auto-tagged with the SMC setup that was live when it was opened, surfaced right on the Positions table
- **Sage — AI companion** — a dedicated command-center page, powered by Groq (Llama 3.3 70B):
  - **Streaming replies** — answers arrive token-by-token, not in one delayed block
  - **Proactive nudges** — Sage speaks up *unprompted* when a new higher-timeframe (H1/H4/D1) break of structure forms
  - **Structured analysis** — generates a directional bias, confidence score, and suggested entry / SL / TP, and curates a clean set of key levels drawn straight onto the chart
  - **Configurable persona + conviction** — choose Sage's analytical / aggressive / conservative voice and a confidence threshold below which setups aren't flagged as actionable
  - **Live context + memory** — sees your account, open trades, and multi-timeframe structure, remembers the conversation per account, and keeps durable notes on how you trade
  - **Web search with citations** — optional Tavily-backed live search for news and current events, rendered as source cards
  - **Custom strategy** — upload or paste your own trading rules for Sage to follow
- **Trade history & performance** — persisted closed-trade log and P&L metrics by day, week, and month
- **Interface preferences** — brutalist look with Dark / Light / Glow themes, Inter / Mono typography, display density, a live glow-intensity control, and a Web Audio sound system (order fill / alert / error)

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
| Economic calendar | Finnhub API (optional) |

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
- **Groq API key** — added in **Settings → Sage AI Core**; free at [console.groq.com](https://console.groq.com)
- **Tavily API key** — added in **Settings → Sage AI Core** to enable Sage's web search; free at [tavily.com](https://tavily.com)
- **Finnhub API key** — added in **Settings → Economic Calendar** to populate the calendar; free at [finnhub.io](https://finnhub.io/register)

---

## Architecture

```
Electron (main.js)
  ├── Main window — React UI (Vite / dist)
  │     ├── TradingView Lightweight Charts + drawing overlay (Canvas)
  │     ├── Terminal · Analytics · Positions · Screener · Alerts · Calendar · Sage · Settings
  │     └── WebSocket client (live account/trades + patterns + nudges + alert triggers)
  └── FastAPI backend (PyInstaller bundle, or python main.py in dev)
        ├── MetaTrader5 bridge      (or mt5_mock.py when SMC_MOCK=1)
        ├── SMC pattern analyser    (order blocks, FVGs, BOS/MSS)
        ├── Asset screener          (ranks symbols by live SMC confidence)
        ├── Monitor loop            (price alerts + auto-breakeven, 5s cadence)
        ├── Risk engine             (daily-loss cap, drawdown lock, default SL)
        ├── Trade journal           (auto-tags each fill with its SMC setup)
        ├── Proactive nudge diff    (surfaces new HTF structure)
        ├── Sage — streaming chat + structured analysis (Groq)
        ├── Web search (Tavily) + Economic calendar (Finnhub) — both optional
        └── Event log + desktop notifications
```

---

## Recent Updates

**QUANT_CORE rebrand** — formerly "The SMC Trading App," rebuilt around a brutalist design language for a new era of the app.

- **New workspaces** — Asset Screener, Alerts & Notifications, and an Economic Calendar joined the main nav.
- **Real risk management** — daily-loss cap, drawdown lock, auto-breakeven, and default stop-loss, all enforced server-side at execution time.
- **Sage upgrades** — configurable persona + confidence threshold, web-search results rendered as citation cards, durable memory about how you trade, and an auto-populated trade journal that tags every fill with its live SMC setup. Sage now lives as a dedicated command-center page.
- **Interface preferences, rebuilt** — Dark / Light / Glow themes, Inter / Mono typography, display density, a live glow-intensity control, and a Web Audio sound system (order fill / alert / error).
- **Sage streams** its replies token-by-token (SSE) and speaks up *unprompted* when a new higher-timeframe break of structure forms.
- **Native non-Windows dev mode** (`SMC_MOCK=1`) runs the whole app — backend included — on Linux/macOS without MetaTrader 5, and **Windows CI** produces the installer + portable exe on demand.

---

## License

MIT — see [LICENSE](LICENSE)
