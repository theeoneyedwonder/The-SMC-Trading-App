import os
import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# ─── Base path (works in both dev and PyInstaller bundle) ─────
if getattr(sys, 'frozen', False):
    _BASE = Path(sys.executable).parent
else:
    _BASE = Path(__file__).parent

# Electron passes this env-var so the backend knows where AppData lives
CONFIG_PATH: Path | None = (
    Path(os.environ['SMC_CONFIG_PATH'])
    if 'SMC_CONFIG_PATH' in os.environ
    else None
)

# In dev mode fall back to .env
if not CONFIG_PATH:
    load_dotenv(_BASE / '.env')

# In dev mode (no CONFIG_PATH), fall back to a local settings.json next to main.py
_DEV_SETTINGS = _BASE / 'settings.json'

# ─── Config file helpers ──────────────────────────────────────
def _read() -> dict:
    """Read the JSON settings file (returns {} on missing / parse error)."""
    path = CONFIG_PATH or _DEV_SETTINGS
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except Exception:
            pass
    return {}

def _write(data: dict):
    """Write updated settings to the JSON file."""
    path = CONFIG_PATH or _DEV_SETTINGS
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')

# ─── Credentials ──────────────────────────────────────────────
def get_mt5_credentials() -> tuple[int, str, str]:
    """Return (login, password, server). Re-reads file each call."""
    mt5 = _read().get('mt5', {})
    raw = mt5.get('login', os.getenv('MT5_LOGIN', 0))
    try:
        login = int(raw)
    except (ValueError, TypeError):
        login = 0
    password = mt5.get('password', os.getenv('MT5_PASSWORD', ''))
    server   = mt5.get('server',   os.getenv('MT5_SERVER',   ''))
    return login, password, server

def is_configured() -> bool:
    """True once the user has entered their MT5 credentials."""
    login, password, server = get_mt5_credentials()
    return bool(login and password and server)

def save_mt5_credentials(login: int, password: str, server: str):
    cfg = _read()
    cfg['mt5'] = {'login': login, 'password': password, 'server': server}
    _write(cfg)

# ─── Theme ────────────────────────────────────────────────────
def get_theme() -> dict:
    return _read().get('theme', {})

def save_theme(data: dict):
    cfg = _read()
    cfg['theme'] = data
    _write(cfg)

# ─── AI key ───────────────────────────────────────────────────
def get_ai_api_key() -> str:
    return _read().get('ai_api_key', os.getenv('ANTHROPIC_API_KEY', ''))

def save_ai_api_key(key: str):
    cfg = _read()
    cfg['ai_api_key'] = key
    _write(cfg)

# ─── Active symbol ────────────────────────────────────────────
def get_active_symbol() -> str:
    return _read().get('symbol', os.getenv('MT5_SYMBOL', 'XAUUSDm'))

def save_active_symbol(symbol: str):
    cfg = _read()
    cfg['symbol'] = symbol
    _write(cfg)

# ─── Static settings ──────────────────────────────────────────
AVAILABLE_SYMBOLS = [
    "XAUUSDm",   # Gold
    "XAGUSDm",   # Silver
    "EURUSDm",   # Euro
    "GBPUSDm",   # Pound
    "USDJPYm",   # Yen
    "BTCUSDm",   # Bitcoin
    "NAS100m",   # Nasdaq
    "US30m",     # Dow Jones
]

MT5_TIMEOUT     = 60000
MAX_RETRIES     = 10
RETRY_DELAY     = 5
MAX_RETRY_DELAY = 60

TIMEFRAMES = {
    "M1"  : 1,
    "M5"  : 5,
    "M15" : 15,
    "M30" : 30,
    "H1"  : 60,
    "H4"  : 240,
    "D1"  : 1440,
}

CANDLE_LIMIT   = 200
SWING_LOOKBACK = 5
EMA_PERIOD     = 200

# In production the DB lives next to settings.json in AppData (writable).
# In dev it falls back to the source folder.
_DB_DIR = Path(CONFIG_PATH).parent if CONFIG_PATH else _BASE
_DB_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{_DB_DIR / 'bot_state.db'}"

HOST = "127.0.0.1"
PORT = 8000
