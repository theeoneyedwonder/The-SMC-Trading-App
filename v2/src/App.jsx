import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './App.css';
import { useWebSocket }   from './hooks/useWebSocket';
import { useTheme }       from './contexts/ThemeContext';
import Setup              from './components/Setup';
import Settings           from './components/Settings';
import MarketPanel        from './components/MarketPanel';
import SageBubble         from './components/SageBubble';
import AIPanel            from './components/AIPanel';
import SideRail           from './components/SideRail';
import Home               from './components/Home';
import Trades             from './components/Trades';
import History            from './components/History';
import AccountMetrics     from './components/AccountMetrics';
import Performance        from './components/Performance';

const API              = 'http://127.0.0.1:8000';
const FALLBACK_SYMBOLS = ['XAUUSDm','XAGUSDm','EURUSDm','GBPUSDm','USDJPYm','BTCUSDm','NAS100m','US30m'];

const PAGE_TITLES = {
  home: 'TERMINAL', trades: 'POSITIONS', history: 'HISTORY',
  account: 'ACCOUNT', performance: 'ANALYTICS', sage: 'SAGE_AI',
};

// Apply persisted font scale immediately (module level — no hook, no lifecycle delay)
const _savedScale = localStorage.getItem('ui_font_scale');
if (_savedScale) document.documentElement.style.setProperty('--font-scale', _savedScale);

function PanelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="15" y1="3" x2="15" y2="21"/>
      <line x1="18" y1="8" x2="21" y2="8" opacity="0"/>
    </svg>
  );
}


export default function App() {
  const { vars, mode, toggleMode } = useTheme();

  const [configured, setConfigured] = useState(null);
  const [page, setPage]             = useState('home');
  const [symbol, setSymbol]         = useState('XAUUSDm');
  const symbolRef                   = useRef('XAUUSDm');
  const [symbols, setSymbols]       = useState(FALLBACK_SYMBOLS);
  const [changingSymbol, setChangingSymbol] = useState(false);
  const [settingsOpen, setSettingsOpen]     = useState(false);
  const [panelOpen, setPanelOpen]           = useState(false);
  const [aiLevels, setAiLevels]             = useState([]);
  const { data, connected, nudge }          = useWebSocket();

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
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#000000', color:'#b0b0b0', fontFamily:"'Aptos','Segoe UI',sans-serif", gap:16, padding:'0 32px', textAlign:'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {!backendTimeout ? (
        <>
          <div style={{ width:36, height:36, border:'3px solid #242424', borderTopColor:'#d4ff3f', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
          <span style={{ fontSize:12 }}>Starting backend…</span>
        </>
      ) : (
        <>
          <div style={{ fontSize:28, marginBottom:4 }}>⚠️</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#ffffff', marginBottom:4 }}>Backend not responding</div>
          <div style={{ fontSize:12, color:'#787878', lineHeight:1.7, maxWidth:380 }}>
            The Python backend failed to start. This is usually caused by antivirus software blocking it.<br/><br/>
            Open <strong style={{color:'#b0b0b0'}}>Windows Security → Virus &amp; threat protection → Protection history</strong> and check if <code style={{color:'#d4ff3f'}}>smc-bot-backend.exe</code> was blocked, then add an exclusion for the app folder.
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
      {/* ── Persistent left rail (always-visible nav) ── */}
      <SideRail
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

      {/* ── Everything right of the rail: topbar + body ── */}
      <div className="app-shell">
      {/* ── Top Bar ── */}
      <header className="h-12 shrink-0 flex items-center justify-between px-md border-b-2 border-outline-variant bg-surface-container relative z-40">
        <div className="flex items-center gap-md h-full">
          <div className="flex items-center gap-xs pr-md border-r-2 border-outline-variant h-full">
            <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">ASSET</span>
            <span className="font-headline-md text-headline-md font-bold text-primary-fixed glow-text-primary">{activeSymbol}</span>
          </div>
          <span className="font-label-caps text-label-caps text-on-surface-variant tracking-[0.2em]">{PAGE_TITLES[page] ?? ''}</span>
        </div>

        <div className="flex items-center gap-sm h-full">
          <button
            onClick={() => setPanelOpen(o => !o)}
            title="Watchlist"
            className={
              'w-8 h-8 flex items-center justify-center border-2 transition-colors ' +
              (panelOpen
                ? 'border-primary-fixed-dim text-primary-fixed-dim bg-primary-fixed/10'
                : 'border-outline-variant text-on-surface-variant hover:text-primary-fixed-dim')
            }
          >
            <span className="material-symbols-outlined text-[18px]">list_alt</span>
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center border-2 border-outline-variant text-on-surface-variant hover:text-primary-fixed-dim transition-colors relative"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
          </button>
          {topbarInitials && (
            <div
              className="w-8 h-8 flex items-center justify-center bg-secondary/20 border-2 border-secondary text-secondary glow-secondary font-stat-lg text-[11px] font-bold"
              title={data.account.name || `#${data.account.login}`}
            >
              {topbarInitials}
            </div>
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
              {page === 'sage'        && <AIPanel data={data} nudge={nudge} onClose={() => setPage('home')} onAIAnalysis={levels => setAiLevels(levels)} />}
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
      </div>{/* /app-shell */}

      <AnimatePresence>
        {settingsOpen && (
          <Settings
            onClose={() => setSettingsOpen(false)}
            account={data?.account}
          />
        )}
      </AnimatePresence>

      {/* ── Floating Sage companion (bottom-right) ── */}
      <SageBubble data={data} nudge={nudge} hidden={panelOpen} onAIAnalysis={levels => setAiLevels(levels)} />
    </div>
  );
}
