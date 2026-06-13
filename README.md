# The SMC Trading App

> AI-assisted SMC trading workstation for MetaTrader 5 — live charts, pattern detection, and a Claude-powered trading companion.

A desktop trading application built around **Smart Money Concepts (SMC)** methodology. It connects to a live MetaTrader 5 account and combines real-time market data, automated SMC pattern detection, interactive chart drawing tools, and an AI companion into a single Electron desktop app.

---

## Features

- **Live MT5 integration** — streams account data, open positions, and P&L over WebSocket in real time
- **SMC pattern detection** — automatically identifies Order Blocks, Fair Value Gaps, and Break of Structure / Market Structure Shifts across multiple timeframes (M1 → D1)
- **Interactive charting** — TradingView Lightweight Charts with SMC zone overlays; draw trend lines, rectangles, Fibonacci retracements, and horizontal levels directly on the chart
- **AI Companion** — powered by Claude (Haiku); sees your live account, open trades, and detected patterns; run a structured market analysis that returns directional bias, confidence score, suggested entry/SL/TP, and key price levels marked on the chart
- **Automation modes** — Manual, Assisted, Semi-Auto, and Full Auto (Semi and Full Auto in development)
- **Themes** — dark and light presets with per-color overrides

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React + Vite |
| Charts | TradingView Lightweight Charts v5 |
| Backend | Python FastAPI + WebSocket |
| Broker | MetaTrader 5 (`MetaTrader5` Python package) |
| AI | Anthropic Claude (`claude-haiku-4-5`) |

---

## Requirements

- **Windows** — MetaTrader 5 is Windows-only
- MetaTrader 5 terminal installed and logged in to a live or demo account
- Python 3.11+
- Node.js 20+
- Anthropic API key *(optional — required for AI features)*

---

## Dev Setup

**Terminal 1 — backend**
```bash
cd backend
pip install -r requirements.txt
python main.py
```

**Terminal 2 — frontend (Electron + React)**
```bash
cd v2
npm install
npm run dev:all
```

The app will open as an Electron window. On first launch a setup wizard will prompt for your MT5 login, password, and server.

---

## Configuration

- **MT5 credentials** — entered via the in-app setup wizard; stored locally in `%APPDATA%\The SMC Trading App\settings.json`
- **Anthropic API key** — added in **Settings → AI Companion**; required for the AI analysis and chat features

---

## Architecture

```
Electron (main.js)
  └── React UI (Vite dev server / dist)
        ├── TradingView Lightweight Charts
        ├── Chart drawing overlay (Canvas)
        ├── AI Panel (Claude via FastAPI)
        └── WebSocket client
              └── FastAPI backend (Python)
                    ├── MetaTrader5 (MT5 bridge)
                    ├── SMC pattern analyser
                    └── Anthropic SDK
```

---

## License

MIT — see [LICENSE](LICENSE)
