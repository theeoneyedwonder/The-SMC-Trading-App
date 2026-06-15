import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './App.css';
import { useWebSocket }   from './hooks/useWebSocket';
import { useTheme }       from './contexts/ThemeContext';
import Setup              from './components/Setup';
import Settings           from './components/Settings';
import MarketPanel        from './components/MarketPanel';
import SageBubble         from './components/SageBubble';
import Sidebar            from './components/Sidebar';
import Home               from './components/Home';
import Trades             from './components/Trades';
import History            from './components/History';
import AccountMetrics     from './components/AccountMetrics';
import Performance        from './components/Performance';

const API              = 'http://127.0.0.1:8000';
const FALLBACK_SYMBOLS = ['XAUUSDm','XAGUSDm','EURUSDm','GBPUSDm','USDJPYm','BTCUSDm','NAS100m','US30m'];

// Apply persisted font scale immediately (module level — no hook, no lifecycle delay)
const _savedScale = localStorage.getItem('ui_font_scale');
if (_savedScale) document.documentElement.style.setProperty('--font-scale', _savedScale);

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="15" y1="3" x2="15" y2="21"/>
      <line x1="18" y1="8" x2="21" y2="8" opacity="0"/>
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
  const [sidebarOpen, setSidebarOpen]       = useState(false);
  const [symbol, setSymbol]         = useState('XAUUSDm');
  const symbolRef                   = useRef('XAUUSDm');
  const [symbols, setSymbols]       = useState(FALLBACK_SYMBOLS);
  const [changingSymbol, setChangingSymbol] = useState(false);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [panelOpen, setPanelOpen]           = useState(true);
  const [aiLevels, setAiLevels]             = useState([]);
  const { data, connected }                 = useWebSocket();

  // Keep ref in sync so the symbol load effect can read current value without a closure stale
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);

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
        if (!d.symbols?.length) return;
        setSymbols(d.symbols);
        // Resolve best symbol from the MT5 list
        const current = symbolRef.current;
        let next = current;
        if (!d.symbols.includes(current)) {
          const stripped = current.replace(/m$/, '');
          next = d.symbols.includes(stripped) ? stripped : d.symbols[0];
        }
        setSymbol(next);
        // Tell the backend which symbol to analyse — critical so patterns match the chart
        if (next !== current) {
          fetch(`${API}/symbol/${next}`, { method: 'POST' }).catch(() => {});
        }
      } catch {}
    };
    load();
    const t = setTimeout(load, 5000);
    return () => clearTimeout(t);
  }, [configured]);

  const selectSymbol = async (sym) => {
    if (!sym || sym === symbol) return;
    setChangingSymbol(true);
    try { await fetch(`${API}/symbol/${sym}`, { method: 'POST' }); } catch {}
    setSymbol(sym);
    // Make sure a symbol picked from the watchlist also shows in the topbar dropdown
    setSymbols(prev => (prev.includes(sym) ? prev : [sym, ...prev]));
    setChangingSymbol(false);
  };

  const [backendTimeout, setBackendTimeout] = useState(false);
  useEffect(() => {
    if (configured !== null) return;
    const t = setTimeout(() => setBackendTimeout(true), 15_000);
    return () => clearTimeout(t);
  }, [configured]);

  if (configured === null) return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#060611', color:'#a0a8c8', fontFamily:"'Aptos','Segoe UI',sans-serif", gap:16, padding:'0 32px', textAlign:'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {!backendTimeout ? (
        <>
          <div style={{ width:36, height:36, border:'3px solid #1a1a30', borderTopColor:'#818cf8', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
          <span style={{ fontSize:12 }}>Starting backend…</span>
        </>
      ) : (
        <>
          <div style={{ fontSize:28, marginBottom:4 }}>⚠️</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#e8ecf8', marginBottom:4 }}>Backend not responding</div>
          <div style={{ fontSize:12, color:'#6b7299', lineHeight:1.7, maxWidth:380 }}>
            The Python backend failed to start. This is usually caused by antivirus software blocking it.<br/><br/>
            Open <strong style={{color:'#a0a8c8'}}>Windows Security → Virus &amp; threat protection → Protection history</strong> and check if <code style={{color:'#818cf8'}}>smc-bot-backend.exe</code> was blocked, then add an exclusion for the app folder.
          </div>
        </>
      )}
    </div>
  );
  if (!configured) return <Setup onComplete={() => setConfigured(true)} />;

  const activeSymbol = symbol;

  const topbarInitials = data?.account?.name
    ? data.account.name.slice(0, 2).toUpperCase()
    : data?.account?.login
    ? String(data.account.login).slice(-2)
    : null;

  return (
    <div className="app">
      {/* ── Animated Sidebar Drawer ── */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        page={page}
        setPage={setPage}
        account={data?.account}
        connected={connected}
        onSettingsClick={() => setSettingsOpen(true)}
        onLogout={async () => {
          try { await fetch(`${API}/setup/logout`, { method: 'POST' }); } catch {}
          window.location.reload();
        }}
      />

      {/* ── Top Bar ── */}
      <header className="topbar">
        <div className="topbar-left">
          <motion.button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            title="Menu"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.86, transition: { type: 'spring', stiffness: 600, damping: 10 } }}
          >
            <span /><span /><span />
          </motion.button>

        </div>

        <div className="topbar-right">
          <motion.button
            className={`icon-btn${panelOpen ? ' active' : ''}`}
            onClick={() => setPanelOpen(o => !o)}
            title="Watchlist"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.88, transition: { type: 'spring', stiffness: 500, damping: 12 } }}
          >
            <PanelIcon />
          </motion.button>

          {topbarInitials && (
            <motion.div
              className="topbar-avatar"
              title={data.account.name || `#${data.account.login}`}
              onClick={() => setSidebarOpen(true)}
              style={{ cursor: 'pointer' }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
            >
              {topbarInitials}
            </motion.div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="app-body">
        <main className="content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
            >
              {page === 'home'        && <Home        symbol={activeSymbol} data={data} aiLevels={aiLevels} />}
              {page === 'trades'      && <Trades      trades={data?.trades ?? []} />}
              {page === 'history'     && <History />}
              {page === 'account'     && <AccountMetrics account={data?.account} />}
              {page === 'performance' && <Performance />}
            </motion.div>
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              style={{ flexShrink: 0, overflow: 'hidden' }}
            >
              <div style={{ width: 360, height: '100%' }}>
                <MarketPanel
                  symbol={activeSymbol}
                  onSelectSymbol={selectSymbol}
                  onClose={() => setPanelOpen(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <Settings
            onClose={() => setSettingsOpen(false)}
            account={data?.account}
          />
        )}
      </AnimatePresence>

      {/* ── Floating Sage companion (bottom-right) ── */}
      <SageBubble data={data} onAIAnalysis={levels => setAiLevels(levels)} />
    </div>
  );
}
