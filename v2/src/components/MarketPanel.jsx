import { useState, useEffect, useRef, useCallback } from 'react';

const API = 'http://127.0.0.1:8000';

const DEFAULT_WATCHLIST = ['XAUUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm', 'BTCUSDm', 'NAS100m'];

function loadWatchlist() {
  try {
    const raw = JSON.parse(localStorage.getItem('watchlist') || 'null');
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {}
  return DEFAULT_WATCHLIST;
}

function fmtPrice(v, digits = 2) {
  if (v == null || !isFinite(v)) return '—';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function Watchlist({ symbol, onSelectSymbol }) {
  const [watchlist, setWatchlist] = useState(loadWatchlist);
  const [quotes, setQuotes]       = useState({});
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  // Persist watchlist
  useEffect(() => { localStorage.setItem('watchlist', JSON.stringify(watchlist)); }, [watchlist]);

  // Poll live quotes for the watchlist every 2s
  useEffect(() => {
    if (!watchlist.length) { setQuotes({}); return; }
    let live = true;
    const poll = async () => {
      // Primary: batch quotes (last + daily change%)
      try {
        const r = await fetch(`${API}/watchlist/quotes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: watchlist }),
        });
        if (r.ok) {
          const d = await r.json();
          if (live && d && Object.keys(d).length) { setQuotes(d); return; }
        }
      } catch {}
      // Fallback: per-symbol /tick for at least the last price (works even on
      // an older backend without the batch endpoint).
      try {
        const entries = await Promise.all(watchlist.map(async (s) => {
          try {
            const tr = await fetch(`${API}/tick/${s}`);
            if (tr.ok) {
              const t = await tr.json();
              const last = t.bid || t.ask;
              if (last) return [s, { last, digits: last >= 100 ? 2 : last >= 10 ? 3 : 5 }];
            }
          } catch {}
          return null;
        }));
        if (!live) return;
        const map = {};
        for (const e of entries) if (e) map[e[0]] = e[1];
        if (Object.keys(map).length) setQuotes(map);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { live = false; clearInterval(id); };
  }, [watchlist]);

  // Debounced symbol search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/symbols/search?q=${encodeURIComponent(q)}`);
        if (r.ok) { const d = await r.json(); setResults(d.symbols || []); }
      } catch {}
      setSearching(false);
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  const addSymbol = useCallback((sym) => {
    setWatchlist(prev => prev.includes(sym) ? prev : [...prev, sym]);
    setQuery('');
    setResults([]);
  }, []);

  const removeSymbol = useCallback((sym, e) => {
    e?.stopPropagation();
    setWatchlist(prev => prev.filter(s => s !== sym));
  }, []);

  return (
    <div className="wl-body">
      {/* Search */}
      <div className="wl-search">
        <span className="wl-search-icon"><SearchIcon /></span>
        <input
          className="wl-search-input"
          placeholder="Search symbols (e.g. XAU, NAS100, EURUSD)…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && <button className="wl-search-clear" onClick={() => setQuery('')}>✕</button>}
      </div>

      {/* Search results */}
      {query && (
        <div className="wl-results">
          {searching && <div className="wl-results-note">Searching…</div>}
          {!searching && results.length === 0 && <div className="wl-results-note">No matches</div>}
          {results.map(sym => {
            const added = watchlist.includes(sym);
            return (
              <div key={sym} className="wl-result-row" onClick={() => onSelectSymbol(sym)}>
                <span className="wl-result-sym">{sym}</span>
                <button
                  className={`wl-add-btn${added ? ' added' : ''}`}
                  onClick={(e) => { e.stopPropagation(); added ? removeSymbol(sym, e) : addSymbol(sym); }}
                  title={added ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  <StarIcon filled={added} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Watchlist header */}
      {!query && (
        <>
          <div className="wl-col-head">
            <span>Symbol</span>
            <span className="wl-col-right">Last</span>
            <span className="wl-col-right">Chg%</span>
          </div>
          <div className="wl-list">
            {watchlist.length === 0 && (
              <div className="wl-empty">Your watchlist is empty.<br />Search above to add symbols.</div>
            )}
            {watchlist.map(sym => {
              const q   = quotes[sym];
              const pct = q?.change_pct;
              const cls = pct == null ? '' : pct > 0 ? 'pos' : pct < 0 ? 'neg' : '';
              const active = sym === symbol;
              return (
                <div
                  key={sym}
                  className={`wl-row${active ? ' active' : ''}`}
                  onClick={() => onSelectSymbol(sym)}
                >
                  <span className="wl-row-sym">{sym}</span>
                  <span className="wl-row-last">{q ? fmtPrice(q.last, q.digits) : '—'}</span>
                  <span className={`wl-row-pct ${cls}`}>
                    {pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`}
                  </span>
                  <button className="wl-row-remove" onClick={(e) => removeSymbol(sym, e)} title="Remove">✕</button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function MarketPanel({ symbol, onSelectSymbol, onClose }) {
  return (
    <div className="market-panel">
      <div className="mp-header">
        <div className="mp-tabs">
          <button className="mp-tab active">Watchlist</button>
        </div>
        <button className="mp-close" onClick={onClose} title="Close panel">✕</button>
      </div>

      <div className="mp-content">
        <Watchlist symbol={symbol} onSelectSymbol={onSelectSymbol} />
      </div>
    </div>
  );
}
