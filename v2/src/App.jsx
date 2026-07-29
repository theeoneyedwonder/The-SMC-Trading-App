import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './App.css';
import { useWebSocket }   from './hooks/useWebSocket';
import Setup              from './components/Setup';
import Settings           from './components/Settings';
import AIPanel            from './components/AIPanel';
import SideRail           from './components/SideRail';
import Home               from './components/Home';
import Trades             from './components/Trades';
import AccountMetrics     from './components/AccountMetrics';
import Performance        from './components/Performance';
import LoadingScreen      from './components/LoadingScreen';
import AssetScreener      from './components/AssetScreener';
import Alerts             from './components/Alerts';
import EconomicCalendar   from './components/EconomicCalendar';

const API              = 'http://127.0.0.1:8000';
const FALLBACK_SYMBOLS = ['XAUUSDm','XAGUSDm','EURUSDm','GBPUSDm','USDJPYm','BTCUSDm','NAS100m','US30m'];
const MARKET_SYMBOL_DEFAULTS = {
  simulated: 'XAUUSDm',
  mt5: 'XAUUSDm',
  oanda: 'XAU_USD',
  tradingview: 'OANDA:XAUUSD',
};

function loadChartSymbols() {
  try {
    const value = JSON.parse(localStorage.getItem('qc_chart_symbols') || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

// Apply persisted interface prefs immediately (module level — no hook, no
// lifecycle delay): display density (font-scale), neon bloom (glow-scale),
// and UI typography (Inter vs Mono).
const _savedScale = localStorage.getItem('ui_font_scale');
if (_savedScale) document.documentElement.style.setProperty('--font-scale', _savedScale);
const _savedGlow = localStorage.getItem('ui_glow_scale');
if (_savedGlow) document.documentElement.style.setProperty('--glow-scale', _savedGlow);
if (localStorage.getItem('ui_font_family') === 'mono') {
  document.documentElement.style.setProperty('--font-ui', "'JetBrains Mono Variable','JetBrains Mono',ui-monospace,monospace");
}

export default function App() {
  const compactQuery = '(max-width: 1279px)';
  const [compactLayout, setCompactLayout] = useState(() => window.matchMedia(compactQuery).matches);
  const [railOpen, setRailOpen] = useState(() => !window.matchMedia(compactQuery).matches);

  const [configured, setConfigured] = useState(null);
  const [page, setPage]             = useState('home');
  const [symbol, setSymbol]         = useState('XAUUSDm');
  const symbolRef                   = useRef('XAUUSDm');
  const [symbols, setSymbols]       = useState(FALLBACK_SYMBOLS);
  const [changingSymbol, setChangingSymbol] = useState(false);
  const [aiLevels, setAiLevels]             = useState([]);
  const { data, connected, nudge }          = useWebSocket();
  const [marketCatalog, setMarketCatalog]   = useState(null);
  const [chartProvider, setChartProvider]   = useState(() => localStorage.getItem('qc_chart_provider') || 'simulated');
  const [chartSymbols, setChartSymbols]     = useState(loadChartSymbols);

  // Preserve usable workspace width: below the desktop breakpoint the nav
  // becomes an overlay drawer instead of squeezing the terminal columns.
  useEffect(() => {
    const query = window.matchMedia(compactQuery);
    const syncLayout = event => {
      setCompactLayout(event.matches);
      setRailOpen(!event.matches);
    };
    query.addEventListener('change', syncLayout);
    return () => query.removeEventListener('change', syncLayout);
  }, []);

  useEffect(() => {
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return;
      if (compactLayout) setRailOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [compactLayout]);

  // Keep ref in sync so the symbol load effect can read current value without a closure stale
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);

  const loadMarketCatalog = useCallback(async () => {
    try {
      const response = await fetch(`${API}/market/providers`);
      if (!response.ok) return;
      const catalog = await response.json();
      setMarketCatalog(catalog);
      setChartProvider(current => {
        const selected = catalog.providers?.find(item => item.id === current);
        const next = selected?.available ? current : catalog.default_chart_provider;
        localStorage.setItem('qc_chart_provider', next);
        return next;
      });
    } catch {}
  }, []);

  useEffect(() => {
    loadMarketCatalog();
    const refresh = () => loadMarketCatalog();
    window.addEventListener('qc-market-providers-changed', refresh);
    return () => window.removeEventListener('qc-market-providers-changed', refresh);
  }, [loadMarketCatalog]);

  useEffect(() => {
    if (!marketCatalog) return;
    const localProvider = marketCatalog.default_chart_provider;
    if (chartProvider !== localProvider) return;
    setChartSymbols(previous => {
      const next = { ...previous, [localProvider]: symbol };
      localStorage.setItem('qc_chart_symbols', JSON.stringify(next));
      return next;
    });
  }, [chartProvider, marketCatalog, symbol]);

  const selectChartMarket = useCallback((provider, selectedSymbol) => {
    const item = marketCatalog?.providers?.find(candidate => candidate.id === provider);
    if (item && !item.available) return;
    const nextSymbol = selectedSymbol
      || chartSymbols[provider]
      || ((provider === 'mt5' || provider === 'simulated') ? symbol : MARKET_SYMBOL_DEFAULTS[provider]);
    setChartProvider(provider);
    localStorage.setItem('qc_chart_provider', provider);
    if (nextSymbol) {
      setChartSymbols(previous => {
        const next = { ...previous, [provider]: nextSymbol };
        localStorage.setItem('qc_chart_symbols', JSON.stringify(next));
        return next;
      });
    }
  }, [chartSymbols, marketCatalog, symbol]);

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
    <LoadingScreen>
      {backendTimeout ? (
        <div className="loading-error">
          <div className="loading-error-title">Backend not responding</div>
          <div className="loading-error-body">
            The Python backend failed to start. This is usually caused by antivirus software blocking it.<br/><br/>
            Open <strong>Windows Security → Virus &amp; threat protection → Protection history</strong> and check if <code>quant-core-backend.exe</code> was blocked, then add an exclusion for the app folder.
          </div>
        </div>
      ) : undefined}
    </LoadingScreen>
  );
  if (!configured) return <Setup onComplete={() => setConfigured(true)} />;

  const activeSymbol = symbol;
  const chartSymbol = chartSymbols[chartProvider]
    || ((chartProvider === 'mt5' || chartProvider === 'simulated') ? activeSymbol : MARKET_SYMBOL_DEFAULTS[chartProvider]);

  const disconnect = async () => {
    try { await fetch(`${API}/setup/logout`, { method: 'POST' }); } catch {}
    window.location.reload();
  };

  return (
    <div className="app">
      {compactLayout && railOpen && (
        <button
          className="nav-drawer-backdrop"
          onClick={() => setRailOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* ── Persistent desktop rail / compact overlay drawer ── */}
      <SideRail
        page={page}
        setPage={setPage}
        account={data?.account}
        connected={connected}
        onSettingsClick={() => setPage('settings')}
        onLogout={disconnect}
        compact={compactLayout}
        open={railOpen}
        onClose={() => setRailOpen(false)}
      />

      {/* ── Full-height workspace with one floating navigation control ── */}
      <div className="app-shell">
      <button
        className="floating-hamburger-btn"
        onClick={() => setRailOpen(open => !open)}
        aria-label={railOpen ? 'Collapse navigation' : 'Open navigation'}
        aria-expanded={railOpen}
        title={railOpen ? 'Collapse navigation' : 'Open navigation'}
      >
        <span /><span /><span />
      </button>

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
              {page === 'home'        && <Home
                executionSymbol={activeSymbol}
                chartSymbol={chartSymbol}
                chartProvider={chartProvider}
                marketCatalog={marketCatalog}
                onChangeMarket={selectChartMarket}
                data={data}
                aiLevels={aiLevels}
                onNavigate={setPage}
              />}
              {page === 'trades'      && <Trades      trades={data?.trades ?? []} />}
              {page === 'account'     && <AccountMetrics account={data?.account} />}
              {page === 'performance' && <Performance />}
              {page === 'screener'    && <AssetScreener onSelectSymbol={selectSymbol} onNavigateHome={() => setPage('home')} />}
              {page === 'alerts'      && <Alerts />}
              {page === 'calendar'    && <EconomicCalendar onOpenSettings={() => setPage('settings')} />}
              {page === 'sage'        && <AIPanel data={data} nudge={nudge} onClose={() => setPage('home')} onAIAnalysis={levels => setAiLevels(levels)} />}
              {page === 'settings'    && <Settings account={data?.account} onLogout={disconnect} onNavigate={setPage} />}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>
      </div>{/* /app-shell */}
    </div>
  );
}
