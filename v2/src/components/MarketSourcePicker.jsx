import { useEffect, useRef, useState } from 'react';

const API = 'http://127.0.0.1:8000';

const SOURCE_COPY = {
  simulated: {
    label: 'QUANT_CORE Chart',
    shortLabel: 'QUANT_CORE Chart',
    description: 'Native QUANT_CORE chart with Sage integration.',
  },
  mt5: {
    label: 'MetaTrader 5 Chart',
    shortLabel: 'MetaTrader 5 Chart',
    description: 'Requires MetaTrader 5 on this platform to be accessed.',
  },
  oanda: {
    label: 'OANDA Chart',
    shortLabel: 'OANDA Chart',
    description: 'Direct OANDA market data. Requires configuration.',
  },
  tradingview: {
    label: 'TradingView Port',
    shortLabel: 'TradingView',
    description: 'Official TradingView-hosted research chart with TradingView data and tools; isolated from Sage and order execution.',
  },
};

export default function MarketSourcePicker({
  provider,
  symbol,
  providers = [],
  executionProvider,
  onChangeMarket,
  onOpenSettings,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const active = providers.find(item => item.id === provider)
    || { id: provider, label: provider?.toUpperCase() || 'SOURCE', available: true };
  const activeCopy = SOURCE_COPY[provider] || {
    label: active.label,
    shortLabel: active.short_label || active.label,
    description: active.description || '',
  };

  useEffect(() => {
    const close = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);

  useEffect(() => {
    if (!open || provider === 'tradingview') return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `${API}/market/search/${provider}?q=${encodeURIComponent(query)}&limit=30`,
          { signal: controller.signal },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || `Search failed (${response.status})`);
        setResults(payload.symbols || []);
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setResults([]);
          setError(requestError.message || 'Symbol search unavailable');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, provider, query]);

  const selectProvider = item => {
    if (!item.available) {
      if (item.id === 'oanda') onOpenSettings?.();
      return;
    }
    setQuery('');
    setResults([]);
    onChangeMarket?.(item.id);
    if (item.id === 'tradingview') setOpen(false);
  };

  return (
    <div ref={rootRef} className="qc-market-source-picker">
      <button
        type="button"
        className="qc-chart-symbol-chip"
        title={`Chart source: ${activeCopy.label}`}
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
      >
        <span className={`qc-source-indicator is-${provider}`} aria-hidden="true" />
        <strong>{activeCopy.shortLabel}</strong>
        <span className="material-symbols-outlined qc-source-chevron">expand_more</span>
      </button>

      {open && (
        <div className="qc-market-source-menu">
          <div className="qc-source-menu-title">
            <span>CHART SOURCE</span>
            <small>ORDERS: {executionProvider?.toUpperCase() || 'MT5'}</small>
          </div>
          <div className="qc-source-provider-grid">
            {providers.map(item => {
              const copy = SOURCE_COPY[item.id] || {
                label: item.label,
                description: item.description || '',
              };
              const state = item.id === provider
                ? 'ACTIVE'
                : item.available
                ? 'AVAILABLE'
                : item.id === 'oanda'
                ? 'CONFIGURE'
                : item.id === 'mt5'
                ? 'REQUIRES MT5'
                : 'UNAVAILABLE';
              return (
                <button
                  key={item.id}
                  type="button"
                  className={(item.id === provider ? 'is-active ' : '') + (!item.available ? 'is-unavailable' : '')}
                  onClick={() => selectProvider(item)}
                  title={copy.description}
                >
                  <span className="qc-source-option-copy">
                    <strong>{copy.label}</strong>
                    <small>{copy.description}</small>
                  </span>
                  <em>{state}</em>
                </button>
              );
            })}
          </div>

          {provider === 'tradingview' ? (
            <div className="qc-source-research-note">
              Use TradingView&apos;s symbol field inside the research chart. Its data remains isolated from Sage and order execution.
            </div>
          ) : (
            <>
              <label className="qc-source-search">
                <span className="material-symbols-outlined">search</span>
                <input
                  autoFocus
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={provider === 'oanda' ? 'Search OANDA instruments…' : 'Search broker symbols…'}
                />
                {loading && <span className="qc-chart-spinner" />}
              </label>
              <div className="qc-source-results">
                {error && <div className="qc-source-result-error">{error}</div>}
                {!error && results.map(item => (
                  <button
                    key={item.symbol}
                    type="button"
                    className={item.symbol === symbol ? 'is-active' : ''}
                    onClick={() => { onChangeMarket?.(provider, item.symbol); setOpen(false); }}
                  >
                    <span><strong>{item.display_symbol || item.symbol}</strong><small>{item.name}</small></span>
                    <em>{item.type || provider.toUpperCase()}</em>
                  </button>
                ))}
                {!loading && !error && results.length === 0 && (
                  <div className="qc-source-result-empty">NO MATCHING INSTRUMENTS</div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
