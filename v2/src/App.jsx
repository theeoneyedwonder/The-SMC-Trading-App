import { useState, useEffect } from 'react';
import './App.css';
import { useWebSocket }   from './hooks/useWebSocket';
import { useTheme }       from './contexts/ThemeContext';
import Setup              from './components/Setup';
import Settings           from './components/Settings';
import AIPanel            from './components/AIPanel';
import NavBar             from './components/NavBar';
import Home               from './components/Home';
import Trades             from './components/Trades';
import History            from './components/History';
import AccountMetrics     from './components/AccountMetrics';
import Performance        from './components/Performance';

const API              = 'http://127.0.0.1:8000';
const FALLBACK_SYMBOLS = ['XAUUSDm','XAGUSDm','EURUSDm','GBPUSDm','USDJPYm','BTCUSDm','NAS100m','US30m'];

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}

function AIIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      <circle cx="9" cy="10" r="1" fill="currentColor"/>
      <circle cx="12" cy="10" r="1" fill="currentColor"/>
      <circle cx="15" cy="10" r="1" fill="currentColor"/>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
    </svg>
  );
}

export default function App() {
  const { vars, mode, toggleMode } = useTheme();

  const [configured, setConfigured] = useState(null);
  const [page, setPage]             = useState('home');
  const [symbol, setSymbol]         = useState('XAUUSDm');
  const [symbols, setSymbols]       = useState(FALLBACK_SYMBOLS);
  const [changingSymbol, setChangingSymbol] = useState(false);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [aiOpen, setAiOpen]                 = useState(false);
  const [aiLevels, setAiLevels]             = useState([]);
  const { data, connected }                 = useWebSocket();

  // ── Poll setup status ─────────────────────────────────────────
  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const r = await fetch(`${API}/setup/status`);
        if (r.ok && live) { const d = await r.json(); setConfigured(d.configured); return; }
      } catch {}
      if (live) setTimeout(poll, 1000);
    };
    poll();
    return () => { live = false; };
  }, []);

  // ── Load available symbols from MT5 after connection ──────────
  useEffect(() => {
    if (!configured) return;
    const load = async () => {
      try {
        const r = await fetch(`${API}/symbols/available`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.symbols?.length) {
          setSymbols(d.symbols);
          setSymbol(prev => {
          if (d.symbols.includes(prev)) return prev;
          // Try stripping trailing 'm' (e.g. XAUUSDm → XAUUSD)
          const stripped = prev.replace(/m$/, '');
          if (d.symbols.includes(stripped)) return stripped;
          return d.symbols[0];
        });
        }
      } catch {}
    };
    load();
    const t = setTimeout(load, 5000);
    return () => clearTimeout(t);
  }, [configured]);

  const handleSymbolChange = async (e) => {
    const sym = e.target.value;
    setChangingSymbol(true);
    try { await fetch(`${API}/symbol/${sym}`, { method: 'POST' }); } catch {}
    setSymbol(sym);
    setChangingSymbol(false);
  };

  if (configured === null) return null;
  if (!configured) return <Setup onComplete={() => setConfigured(true)} />;

  const activeSymbol = symbol;

  return (
    <div className="app">
      {/* ── Top Bar ── */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="app-logo">
            <div className="logo-mark">S</div>
            <div>
              <div className="logo-text">The SMC Trading App</div>
              <div className="logo-sub">Smart Money Concepts</div>
            </div>
          </div>
        </div>

        <div className="topbar-right">
          <select
            value={activeSymbol}
            onChange={handleSymbolChange}
            disabled={changingSymbol}
            className="symbol-select"
          >
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="status-pill">
            <span className={`status-dot ${connected ? 'live' : 'offline'}`}/>
            <span className={`status-label ${connected ? 'live' : ''}`}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          <button
            className="icon-btn"
            onClick={toggleMode}
            title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            className={`icon-btn${aiOpen ? ' active' : ''}`}
            onClick={() => setAiOpen(o => !o)}
            title="AI Companion"
          >
            <AIIcon />
          </button>

          <button
            className="icon-btn"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="app-body">
        <NavBar page={page} setPage={setPage} />

        <main className="content">
          {page === 'home'        && <Home        symbol={activeSymbol} data={data} aiLevels={aiLevels} />}
          {page === 'trades'      && <Trades      trades={data?.trades ?? []} />}
          {page === 'history'     && <History />}
          {page === 'account'     && <AccountMetrics account={data?.account} />}
          {page === 'performance' && <Performance />}
        </main>

        {aiOpen && (
          <AIPanel
            data={data}
            onClose={() => setAiOpen(false)}
            onAIAnalysis={levels => setAiLevels(levels)}
          />
        )}
      </div>

      {settingsOpen && (
        <Settings onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
