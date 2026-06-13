# The SMC Trading App

> AI-assisted SMC trading workstation for MetaTrader 5 — live charts, automatic pattern detection, and an AI trading companion.

A desktop trading application built around **Smart Money Concepts (SMC)** methodology. Connects to a live MetaTrader 5 account and combines real-time market data, automated SMC pattern detection, interactive chart drawing tools, and an AI companion into a single self-contained Windows app.

---

## Download

Head to the [Releases](../../releases) page to download the latest installer.

**Requirements (end users):**
- Windows 10 / 11 (x64)
- [MetaTrader 5](https://www.metatrader5.com/en/download) installed and logged in to a live or demo account
- A free [Groq API key](https://console.groq.com) *(optional — only needed for the AI companion feature)*

No Python, Node.js, or any other runtime needed. The installer is fully self-contained.

---

## Features

- **Live MT5 integration** — streams account data, open positions, and P&L over WebSocket in real time
- **SMC pattern detection** — automatically identifies Order Blocks, Fair Value Gaps, and Break of Structure / Market Structure Shifts across M1 → D1 timeframes
- **Interactive charting** — TradingView Lightweight Charts with SMC zone overlays; draw trend lines, rectangles, Fibonacci retracements, and horizontal levels directly on the chart
- **AI Companion** — powered by Groq (Llama 3.3); sees your live account, open trades, and detected patterns; generates a structured market analysis with directional bias, confidence score, and suggested entry / SL / TP
- **Trade history & performance** — closed trade log and P&L metrics by day, week, and month
- **Themes** — dark and light presets with per-color overrides

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

---

## Dev Setup

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

---

## Building

| Script | What it does |
|---|---|
| `.\build.bat` | Full rebuild (PyInstaller + Vite + installer) |
| `.\build-frontend.bat` | Frontend + installer only (~30 sec) |
| `.\build-backend.bat` | Python backend + installer only |

Output goes to `release\`. The **portable** `.exe` runs without installing. The **Setup** `.exe` is the full installer for end users.

---

## Configuration

- **MT5 credentials** — entered via the in-app setup wizard; stored in `%APPDATA%\The SMC Trading App\settings.json`
- **Groq API key** — added in **Settings → AI Companion**; free at [console.groq.com](https://console.groq.com)

---

## Architecture

```
Electron (main.js)
  └── React UI (Vite / dist)
        ├── TradingView Lightweight Charts
        ├── Chart drawing overlay (Canvas)
        ├── AI Panel (Groq via FastAPI)
        └── WebSocket client
              └── FastAPI backend (PyInstaller bundle)
                    ├── MetaTrader5 bridge
                    ├── SMC pattern analyser
                    └── Groq API (httpx)
```

---

## License

MIT — see [LICENSE](LICENSE)
