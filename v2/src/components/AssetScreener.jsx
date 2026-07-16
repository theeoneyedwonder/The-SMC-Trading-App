import { useState, useEffect, useCallback } from 'react';
import { dirClass } from '../lib/smcEvents';

const API = 'http://127.0.0.1:8000';

const TIMEFRAMES = ['M15', 'H1', 'H4', 'D1'];
const SIGNAL_FILTERS = [
  { value: 'all', label: 'ALL SIGNALS' },
  { value: 'OB',  label: 'ORDER BLOCK' },
  { value: 'FVG', label: 'FAIR VALUE GAP' },
  { value: 'BOS', label: 'BREAK OF STRUCTURE' },
];

function fmt(n, d = 2) {
  return n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function confidenceBarColor(direction) {
  if (direction === 'BULLISH') return 'bg-primary-fixed-dim';
  if (direction === 'BEARISH') return 'bg-error';
  return 'bg-surface-container-high';
}

export default function AssetScreener({ onSelectSymbol, onNavigateHome }) {
  const [timeframe, setTimeframe]   = useState('H1');
  const [signalFilter, setSignalFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [rows, setRows]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/screener?timeframe=${timeframe}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false); setError(false); })
      .catch(() => { setLoading(false); setError(true); });
  }, [timeframe]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = rows.filter(r => {
    if (search.trim() && !r.symbol.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (signalFilter !== 'all' && r.signal !== signalFilter) return false;
    return true;
  });

  const trade = (symbol) => {
    onSelectSymbol?.(symbol);
    onNavigateHome?.();
  };

  return (
    <div className="flex-1 flex flex-col gap-md p-md overflow-hidden min-h-0">
      {/* Header / Filters */}
      <div className="flex flex-col lg:flex-row gap-md justify-between items-start lg:items-center shrink-0 border-b-2 border-outline-variant pb-xs">
        <div>
          <h1 className="font-display-lg text-[32px] font-black text-primary uppercase glow-text-primary tracking-tighter">Asset Screener</h1>
          <p className="font-label-caps text-label-caps text-on-surface-variant mt-1">LIVE MARKET DATA &amp; SMC SIGNALS</p>
        </div>
        <div className="flex flex-wrap gap-sm">
          <div className="bg-surface-container border-2 border-outline-variant flex items-center px-sm h-8">
            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-primary font-label-caps text-label-caps w-32 placeholder-on-surface-variant h-full py-0 pl-xs outline-none"
              placeholder="SEARCH SYMBOL..."
            />
          </div>
          <div className="bg-surface-container border-2 border-outline-variant flex items-center px-sm h-8">
            <span className="material-symbols-outlined text-secondary text-[16px]">filter_alt</span>
            <select
              value={signalFilter}
              onChange={e => setSignalFilter(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-secondary font-label-caps text-label-caps h-full py-0 pl-xs outline-none"
            >
              {SIGNAL_FILTERS.map(f => <option key={f.value} value={f.value} className="bg-surface-container text-on-surface">{f.label}</option>)}
            </select>
          </div>
          <div className="flex bg-surface-container border-2 border-outline-variant h-8">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={
                  'px-sm font-label-caps text-label-caps border-r-2 border-outline-variant last:border-r-0 transition-colors ' +
                  (timeframe === tf ? 'text-primary-fixed-dim bg-surface-container-highest' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high')
                }
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="w-full bg-[#141414] border-2 border-outline-variant shadow-[4px_4px_0px_#000000]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low border-b-2 border-outline-variant sticky top-0 z-10">
              <tr>
                <th className="p-sm font-label-caps text-label-caps text-on-surface-variant border-r-2 border-outline-variant w-12 text-center">#</th>
                <th className="p-sm font-label-caps text-label-caps text-on-surface-variant border-r-2 border-outline-variant">ASSET</th>
                <th className="p-sm font-label-caps text-label-caps text-on-surface-variant border-r-2 border-outline-variant text-right">LAST PRICE</th>
                <th className="p-sm font-label-caps text-label-caps text-on-surface-variant border-r-2 border-outline-variant text-right">24H %</th>
                <th className="p-sm font-label-caps text-label-caps text-on-surface-variant border-r-2 border-outline-variant">SMC SIGNAL</th>
                <th className="p-sm font-label-caps text-label-caps text-on-surface-variant border-r-2 border-outline-variant text-center">CONFIDENCE</th>
                <th className="p-sm font-label-caps text-label-caps text-on-surface-variant text-center w-24">ACTION</th>
              </tr>
            </thead>
            <tbody className="font-stat-lg text-[14px] leading-tight">
              {loading ? (
                <tr><td colSpan={7} className="p-lg text-center font-label-caps text-label-caps text-on-surface-variant">SCANNING MARKET…</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="p-lg text-center font-label-caps text-label-caps text-error">NOT CONNECTED — could not reach the screener</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-lg text-center font-label-caps text-label-caps text-on-surface-variant">NO SYMBOLS MATCH THIS FILTER</td></tr>
              ) : filtered.map((r, i) => {
                const changeUp = (r.change_pct ?? 0) > 0;
                const changeDown = (r.change_pct ?? 0) < 0;
                const borderClass = r.direction === 'BULLISH' ? 'border-l-primary-fixed-dim' : r.direction === 'BEARISH' ? 'border-l-error' : 'border-l-surface-container-high';
                const actionLabel = r.direction === 'BULLISH' ? 'LONG' : r.direction === 'BEARISH' ? 'SHORT' : 'WATCH';
                const actionClass = r.direction === 'BULLISH'
                  ? 'bg-primary-fixed-dim text-on-primary-fixed'
                  : r.direction === 'BEARISH'
                  ? 'bg-error text-on-error'
                  : 'bg-surface-container-high text-on-surface-variant';
                return (
                  <tr key={r.symbol} className={`border-b-2 border-outline-variant hover:bg-surface-container-high transition-colors border-l-4 ${borderClass} ${i % 2 ? 'bg-surface/40' : ''}`}>
                    <td className="p-sm border-r-2 border-outline-variant text-center text-on-surface-variant">{i + 1}</td>
                    <td className="p-sm border-r-2 border-outline-variant">
                      <span className="text-primary font-bold">{r.symbol}</span>
                    </td>
                    <td className="p-sm border-r-2 border-outline-variant text-right text-primary">{fmt(r.last, r.digits > 3 ? r.digits : 2)}</td>
                    <td className={'p-sm border-r-2 border-outline-variant text-right ' + (changeUp ? 'text-primary-fixed-dim' : changeDown ? 'text-error' : 'text-on-surface-variant')}>
                      {r.change_pct == null ? '—' : `${changeUp ? '+' : ''}${fmt(r.change_pct)}%`}
                    </td>
                    <td className="p-sm border-r-2 border-outline-variant">
                      {r.signal ? (
                        <div className="flex items-center gap-xs">
                          <span className={'w-2 h-2 rounded-full ' + (r.direction === 'BULLISH' ? 'bg-primary-fixed-dim' : 'bg-error')} />
                          <span className={dirClass(r.direction)}>{timeframe} {r.signal} ({r.direction})</span>
                        </div>
                      ) : (
                        <span className="text-on-surface-variant">NO STRUCTURE</span>
                      )}
                    </td>
                    <td className="p-sm border-r-2 border-outline-variant">
                      <div className="flex h-2 w-full bg-surface-container-low border border-outline-variant">
                        <div className={`h-full ${confidenceBarColor(r.direction)}`} style={{ width: `${r.confidence ?? 0}%` }} />
                      </div>
                    </td>
                    <td className="p-sm text-center">
                      <button
                        onClick={() => trade(r.symbol)}
                        className={`${actionClass} font-label-caps px-2 py-1 text-[10px] border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:-translate-y-[1px] hover:-translate-x-[1px] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all`}
                      >
                        {actionLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
