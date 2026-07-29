import { useState, useEffect, useRef } from 'react';
import Chart from './Chart';
import TradingViewResearch from './TradingViewResearch';
import { recentSmcEvents, dirClass, fmtClock, structureBias } from '../lib/smcEvents';
import { playOrderFill, playError } from '../lib/sound';

const API = 'http://127.0.0.1:8000';
const DEFAULT_WATCHLIST = ['XAUUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm', 'BTCUSDm', 'NAS100m'];

function fmt(n, d = 2) {
  return n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function loadWatchlist() {
  try {
    const raw = JSON.parse(localStorage.getItem('watchlist') || 'null');
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {}
  return DEFAULT_WATCHLIST;
}

// ── Bottom widget row ──────────────────────────────────────────────
function PositionsWidget({ trades }) {
  return (
    <div className="glass-panel module-glow flex flex-col overflow-hidden">
      <div className="p-sm border-b border-white/10 flex justify-between items-center shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest font-headline-md">POSITIONS</h3>
        <span className="text-[10px] bg-white/10 px-2 py-0.5 border border-white/10 font-body-base">{trades.length} OPEN</span>
      </div>
      <div className="flex-1 p-sm overflow-y-auto min-h-0">
        {trades.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] text-on-surface-variant font-label-caps text-center">NO OPEN POSITIONS</div>
        ) : (
          <table className="w-full text-left text-xs font-body-base">
            <thead>
              <tr className="text-[10px] text-on-surface-variant uppercase border-b border-white/10">
                <th className="pb-xs font-normal">SYMBOL</th>
                <th className="pb-xs font-normal">TYPE</th>
                <th className="pb-xs font-normal text-right">VOLUME</th>
                <th className="pb-xs font-normal text-right">P/L</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 6).map(t => {
                const up = (t.profit ?? 0) > 0, down = (t.profit ?? 0) < 0;
                return (
                  <tr key={t.ticket} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-sm">{t.symbol}</td>
                    <td className={'py-sm ' + (t.direction === 'BUY' ? 'text-primary-fixed glow-text-primary' : 'text-error')}>{t.direction}</td>
                    <td className="py-sm text-right font-mono">{fmt(t.lots)}</td>
                    <td className={'py-sm text-right font-mono ' + (up ? 'text-primary-fixed glow-text-primary' : down ? 'text-error' : 'text-on-surface-variant')}>
                      {(t.profit ?? 0) >= 0 ? '+' : ''}{fmt(t.profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function WatchlistWidget({ symbol, onSelectSymbol }) {
  const [quotes, setQuotes] = useState({});
  const listRef = useRef(loadWatchlist());

  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const r = await fetch(`${API}/watchlist/quotes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: listRef.current }),
        });
        if (r.ok) { const d = await r.json(); if (live) setQuotes(d); }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { live = false; clearInterval(id); };
  }, []);

  const list = listRef.current.slice(0, 6);

  return (
    <div className="glass-panel module-glow flex flex-col overflow-hidden">
      <div className="p-sm border-b border-white/10 flex justify-between items-center shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest font-headline-md">SAVED PAIRS</h3>
      </div>
      <div className="flex-1 p-sm overflow-y-auto min-h-0">
        <table className="w-full text-left text-xs font-body-base">
          <thead>
            <tr className="text-[10px] text-on-surface-variant uppercase border-b border-white/10">
              <th className="pb-xs font-normal">SYMBOL</th>
              <th className="pb-xs font-normal text-right">PRICE</th>
              <th className="pb-xs font-normal text-right">CHANGE</th>
            </tr>
          </thead>
          <tbody>
            {list.map(sym => {
              const q = quotes[sym];
              const pct = q?.change_pct;
              const up = pct > 0, down = pct < 0;
              const active = sym === symbol;
              return (
                <tr
                  key={sym}
                  onClick={() => onSelectSymbol?.(sym)}
                  className={'border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ' + (active ? 'bg-white/5' : '')}
                >
                  <td className={'py-sm font-bold ' + (active ? 'text-primary-fixed' : '')}>{sym}</td>
                  <td className="py-sm text-right font-mono">{q ? fmt(q.last, q.digits ?? 2) : '—'}</td>
                  <td className={'py-sm text-right font-mono ' + (up ? 'text-primary-fixed glow-text-primary' : down ? 'text-error' : 'text-on-surface-variant')}>
                    {pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SageWidget({ nudge, onOpen }) {
  return (
    <div className="glass-panel module-glow-secondary flex flex-col relative overflow-hidden border-secondary/30">
      <div className="p-sm border-b border-secondary/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-xs">
          <h3 className="text-xs font-bold uppercase tracking-widest font-headline-md text-secondary glow-text-secondary">SAGE</h3>
          <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_12px_rgba(220,184,255,0.9)] animate-pulse" />
        </div>
      </div>
      <div className="flex-1 p-sm flex flex-col justify-center items-center text-center gap-sm min-h-0">
        <div className="w-8 h-8 rounded-full border border-secondary glow-secondary flex items-center justify-center bg-secondary/20 shrink-0 shadow-[inset_0_0_10px_rgba(220,184,255,0.3)]">
          <span className="material-symbols-outlined text-secondary text-sm">auto_awesome</span>
        </div>
        <p className="text-[11px] text-on-surface leading-relaxed line-clamp-3">
          {nudge?.text ?? 'Ask Sage for a full SMC structure read on the active symbol.'}
        </p>
      </div>
      <div className="p-sm shrink-0 relative z-10">
        <button
          onClick={onOpen}
          className="w-full py-xs border border-primary-fixed text-primary-fixed text-xs font-bold hover:bg-primary-fixed/20 transition-colors flex items-center justify-center gap-xs glow-primary glow-text-primary bg-primary-fixed/5 backdrop-blur-md"
        >
          <span className="material-symbols-outlined text-sm">troubleshoot</span> ANALYZE MARKET
        </button>
      </div>
    </div>
  );
}

function EventsWidget({ patterns }) {
  const events = recentSmcEvents(patterns, 6);
  return (
    <div className="glass-panel module-glow flex flex-col overflow-hidden">
      <div className="p-sm border-b border-white/10 flex justify-between items-center shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest font-headline-md">SMC_EVENTS</h3>
        <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
      </div>
      <div className="flex-1 p-sm overflow-y-auto space-y-sm min-h-0">
        {events.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[11px] text-on-surface-variant font-label-caps text-center">SCANNING…</div>
        ) : events.map((e, i) => (
          <div key={i} className="flex gap-sm items-start">
            <span className="text-[10px] text-on-surface-variant w-10 shrink-0 pt-[2px] font-mono">{fmtClock(e.time)}</span>
            <p className={'text-[11px] flex-1 font-body-base ' + dirClass(e.direction)}>
              {e.kind} · {e.tf} · {fmt(e.price, e.price > 100 ? 1 : 4)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Right column: Order Execution Panel ─────────────────────────────
function FieldRow({ label, children }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-[10px] text-on-surface-variant uppercase font-label-caps">{label}</label>
      {children}
    </div>
  );
}

function StructureDonut({ bullPct, bearPct }) {
  const r = 36, c = 2 * Math.PI * r;
  const bullLen = (bullPct / 100) * c;
  const bearLen = (bearPct / 100) * c;
  return (
    <div className="w-20 h-20 rounded-full border-4 border-white/5 relative shrink-0 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#c3f400" strokeWidth="8"
          strokeDasharray={`${bullLen} ${c - bullLen}`} strokeDashoffset="0"
          style={{ filter: 'drop-shadow(0 0 6px rgba(195,244,0,0.9))' }} />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#ffb4ab" strokeWidth="8"
          strokeDasharray={`${bearLen} ${c - bearLen}`} strokeDashoffset={-bullLen}
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,180,171,0.9))' }} />
      </svg>
    </div>
  );
}

function OrderPanel({ symbol, account, patterns, analysisProvider, analysisSymbol, executionProvider }) {
  const [lot, setLot]         = useState('0.10');
  const [risk, setRisk]       = useState('1.00');
  const [sl, setSl]           = useState('');
  const [tp, setTp]           = useState('');
  const [tick, setTick]       = useState(null);
  const [trading, setTrading] = useState(null);
  const [result, setResult]   = useState(null);

  // Independent live tick stream for the ticket — deliberately not shared
  // with Chart.jsx's own WS connection, so the order panel never risks
  // destabilizing the chart's tick-handling internals.
  useEffect(() => {
    if (!symbol) return;
    let ws = null, timer = null, cancelled = false;
    const connect = () => {
      if (cancelled) return;
      try { ws = new WebSocket(`ws://127.0.0.1:8000/ws/ticks/${symbol}`); }
      catch { if (!cancelled) timer = setTimeout(connect, 1000); return; }
      ws.onmessage = e => { try { const t = JSON.parse(e.data); if (t.bid && t.ask) setTick(t); } catch {} };
      ws.onclose = () => { if (!cancelled) timer = setTimeout(connect, 1000); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { cancelled = true; clearTimeout(timer); try { ws?.close(); } catch {} };
  }, [symbol]);

  const executeTrade = async (side) => {
    const lotNum = parseFloat(lot);
    if (!isFinite(lotNum) || lotNum < 0.01) {
      setResult({ ok: false, msg: 'Enter a lot size of at least 0.01' });
      setTimeout(() => setResult(null), 4000);
      return;
    }
    setTrading(side); setResult(null);
    try {
      const r = await fetch(`${API}/trade/market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, lot: lotNum, type: side,
          sl: sl ? parseFloat(sl) : undefined,
          tp: tp ? parseFloat(tp) : undefined,
        }),
      });
      const d = await r.json();
      if (r.ok) { setResult({ ok: true, msg: `#${d.ticket} filled @ ${d.price}` }); playOrderFill(); }
      else       { setResult({ ok: false, msg: d.detail || 'Trade failed' }); playError(); }
    } catch { setResult({ ok: false, msg: 'Connection error' }); playError(); }
    setTrading(null);
    setTimeout(() => setResult(null), 4000);
  };

  const bias          = structureBias(patterns);
  const marginUsedPct = account?.equity > 0 ? ((account.margin ?? 0) / account.equity) * 100 : 0;
  const profitUp      = (account?.profit ?? 0) >= 0;
  const dominant       = bias.total === 0 ? 'NEUTRAL' : bias.bullPct >= bias.bearPct ? 'BULLISH' : 'BEARISH';
  const simulated      = executionProvider === 'simulated';
  const sourceDiffers  = analysisProvider !== executionProvider || analysisSymbol !== symbol;

  return (
    <aside className="qc-order-panel w-80 shrink-0 flex flex-col gap-sm h-full overflow-y-auto min-h-0 bg-[#101010] border-l-2 border-outline-variant p-sm">
      <div className="qc-order-header shrink-0 flex items-center justify-between border-2 border-outline-variant bg-surface-container-lowest px-sm py-xs shadow-[3px_3px_0_#000]">
        <div>
          <div className="font-headline-md text-[13px] font-bold text-primary tracking-wider">EXECUTION_TICKET</div>
          <div className="font-label-caps text-[9px] text-on-surface-variant mt-1">MARKET ORDER · {symbol}</div>
        </div>
        <div className={'font-label-caps text-[9px] border px-xs py-1 flex items-center gap-xs ' + (simulated ? 'qc-execution-simulated' : 'text-primary-fixed border-primary-fixed')}>
          <span className={'w-1.5 h-1.5 animate-pulse ' + (simulated ? 'bg-error' : 'bg-primary-fixed')} /> {simulated ? 'SIMULATED' : 'MT5 ARMED'}
        </div>
      </div>

      {(sourceDiffers || simulated) && (
        <div className={'qc-feed-boundary ' + (simulated ? 'is-simulated' : '')}>
          <div><span>CHART</span><strong>{analysisProvider?.toUpperCase()}:{analysisSymbol}</strong></div>
          <div><span>EXECUTION</span><strong>{executionProvider?.toUpperCase()}:{symbol}</strong></div>
          <p>{simulated
            ? 'Development runtime — no live broker order is sent.'
            : 'Chart prices are analysis-only. This ticket uses the MT5 broker quote.'}</p>
        </div>
      )}

      {/* Balance card */}
      <div className="qc-order-balance p-md shrink-0 relative overflow-hidden border-2 border-outline-variant bg-surface-container-lowest shadow-[3px_3px_0_#000]">
        <div className="font-label-caps text-[10px] font-bold uppercase mb-xs text-on-surface-variant">ACCOUNT BALANCE</div>
        <div className="text-2xl font-black tracking-tighter font-mono text-primary">
          {account?.currency ?? ''} {fmt(account?.balance)}
        </div>
        <div className="grid grid-cols-2 gap-sm mt-sm pt-sm border-t-2 border-outline-variant">
          <div><div className="font-label-caps text-[9px] text-on-surface-variant">EQUITY</div><div className="font-mono text-[12px] text-primary">{fmt(account?.equity)}</div></div>
          <div className="text-right"><div className="font-label-caps text-[9px] text-on-surface-variant">FREE MARGIN</div><div className="font-mono text-[12px] text-primary-fixed">{fmt(account?.free_margin)}</div></div>
        </div>
      </div>

      {/* Buy/Sell */}
      <div className="flex gap-sm shrink-0">
        <button
          onClick={() => executeTrade('SELL')}
          disabled={!!trading}
          className="qc-order-action qc-order-sell flex-1 h-12 bg-surface-container-high border-2 border-error text-error font-bold tracking-wider shadow-[3px_3px_0_#000] transition-all text-sm flex items-center justify-center disabled:opacity-50"
        >
          {trading === 'SELL' ? '…' : 'SELL'}
        </button>
        <button
          onClick={() => executeTrade('BUY')}
          disabled={!!trading}
          className="qc-order-action qc-order-buy flex-1 h-12 bg-primary-fixed border-2 border-black text-on-primary-fixed font-bold tracking-wider shadow-[3px_3px_0_#000] transition-all text-sm flex items-center justify-center disabled:opacity-50"
        >
          {trading === 'BUY' ? '…' : 'BUY'}
        </button>
      </div>

      {result && (
        <div className={'text-[11px] font-label-caps px-sm py-xs border shrink-0 ' + (result.ok ? 'border-primary-fixed-dim text-primary-fixed-dim bg-primary-fixed/10' : 'border-error text-error bg-error/10')}>
          {result.msg}
        </div>
      )}

      {/* Live bid/ask */}
      <div className="flex gap-sm shrink-0 font-mono text-xs">
        <div className="qc-order-quote flex-1 text-center py-xs border-2 border-outline-variant bg-surface-container-lowest">
          <div className="text-[9px] text-on-surface-variant">BID</div>
          <div className="text-error">{tick?.bid ? fmt(tick.bid, tick.bid > 100 ? 2 : 5) : '—'}</div>
        </div>
        <div className="qc-order-quote flex-1 text-center py-xs border-2 border-outline-variant bg-surface-container-lowest">
          <div className="text-[9px] text-on-surface-variant">ASK</div>
          <div className="text-primary-fixed">{tick?.ask ? fmt(tick.ask, tick.ask > 100 ? 2 : 5) : '—'}</div>
        </div>
      </div>

      {/* Inputs */}
      <div className="qc-order-parameters p-sm space-y-sm shrink-0 border-2 border-outline-variant bg-surface-container-lowest shadow-[3px_3px_0_#000]">
        <div className="font-headline-md text-[12px] font-bold text-primary border-b-2 border-outline-variant pb-xs mb-sm">ORDER PARAMETERS</div>
        <FieldRow label="VOLUME">
          <input type="number" step="0.01" min="0.01" value={lot} onChange={e => setLot(e.target.value)}
            className="w-28 bg-[#141414] border-2 border-outline-variant text-right text-xs p-xs text-primary outline-none font-mono focus:border-primary-fixed transition-colors" />
        </FieldRow>
        <FieldRow label="RISK %">
          <input type="number" step="0.1" min="0" value={risk} onChange={e => setRisk(e.target.value)}
            className="w-28 bg-[#141414] border-2 border-outline-variant text-right text-xs p-xs text-primary outline-none font-mono focus:border-primary-fixed transition-colors" />
        </FieldRow>
        <FieldRow label="STOP LOSS">
          <input type="number" step="0.00001" value={sl} onChange={e => setSl(e.target.value)} placeholder="—"
            className="w-28 bg-[#141414] border-2 border-outline-variant text-right text-xs p-xs text-primary outline-none font-mono focus:border-error transition-colors placeholder:text-on-surface-variant" />
        </FieldRow>
        <FieldRow label="TAKE PROFIT">
          <input type="number" step="0.00001" value={tp} onChange={e => setTp(e.target.value)} placeholder="—"
            className="w-28 bg-[#141414] border-2 border-outline-variant text-right text-xs p-xs text-primary outline-none font-mono focus:border-primary-fixed transition-colors placeholder:text-on-surface-variant" />
        </FieldRow>
      </div>

      {/* Account summary */}
      <div className="qc-order-summary p-sm border-2 border-outline-variant grid grid-cols-2 gap-sm bg-surface-container-lowest shrink-0 shadow-[3px_3px_0_#000]">
        <div>
          <div className="text-[10px] text-on-surface-variant uppercase mb-xs">OPEN P/L</div>
          <div className={'font-bold text-sm font-mono ' + (profitUp ? 'text-primary-fixed glow-text-primary' : 'text-error')}>
            {profitUp ? '+' : ''}{fmt(account?.profit)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-on-surface-variant uppercase mb-xs">MARGIN USED</div>
          <div className="text-primary font-bold text-sm font-mono">{fmt(marginUsedPct, 1)}%</div>
        </div>
      </div>

      {/* Structure bias donut */}
      <div className="qc-order-structure border-2 border-outline-variant bg-surface-container-lowest shadow-[3px_3px_0_#000] flex flex-col shrink-0">
        <div className="p-sm border-b-2 border-outline-variant shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-widest font-headline-md">STRUCTURE BIAS</h3>
        </div>
        <div className="flex-1 p-sm flex items-center gap-md">
          <StructureDonut bullPct={bias.bullPct} bearPct={bias.bearPct} />
          <div className="flex-1 space-y-xs">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-xs"><span className="w-2 h-2 bg-primary-fixed rounded-sm shadow-[0_0_8px_rgba(195,244,0,0.9)]" /> BULLISH</div>
              <span className="text-on-surface-variant font-mono">{bias.total ? `${bias.bullPct}%` : '—'}</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-xs"><span className="w-2 h-2 bg-error rounded-sm shadow-[0_0_8px_rgba(255,180,171,0.9)]" /> BEARISH</div>
              <span className="text-on-surface-variant font-mono">{bias.total ? `${bias.bearPct}%` : '—'}</span>
            </div>
          </div>
        </div>
        <div className="p-xs border-t-2 border-outline-variant flex justify-between items-center shrink-0 bg-surface-container-high">
          <div className="flex flex-col">
            <span className="text-[8px] text-on-surface-variant uppercase">{symbol}</span>
            <span className={'text-xs font-bold uppercase ' + (dominant === 'BULLISH' ? 'text-primary-fixed glow-text-primary' : dominant === 'BEARISH' ? 'text-error' : 'text-on-surface-variant')}>
              {dominant}
            </span>
          </div>
          <span className={'material-symbols-outlined text-sm ' + (dominant === 'BULLISH' ? 'text-primary-fixed' : dominant === 'BEARISH' ? 'text-error' : 'text-on-surface-variant')}>
            {dominant === 'BEARISH' ? 'trending_down' : 'trending_up'}
          </span>
        </div>
      </div>
    </aside>
  );
}

// ── Terminal dashboard ───────────────────────────────────────────────
export default function Home({
  executionSymbol,
  chartSymbol,
  chartProvider,
  marketCatalog,
  onChangeMarket,
  data,
  aiLevels,
  onNavigate,
}) {
  const executionProvider = marketCatalog?.execution_provider || 'mt5';
  const sourceMatchesExecution = chartProvider === executionProvider && chartSymbol === executionSymbol;
  const providers = marketCatalog?.providers || [];

  return (
    <div className="qc-page qc-terminal flex-1 flex gap-md p-md overflow-hidden min-h-0">
      <div className="qc-terminal-chart flex-1 flex flex-col min-w-0 min-h-0 border-2 border-outline-variant bg-surface-container-lowest shadow-[4px_4px_0_#000] overflow-hidden">
        {chartProvider === 'tradingview' ? (
          <TradingViewResearch
            symbol={chartSymbol}
            providers={providers}
            executionProvider={executionProvider}
            executionSymbol={executionSymbol}
            onChangeMarket={onChangeMarket}
            onOpenSettings={() => onNavigate?.('settings')}
          />
        ) : (
          <Chart
            provider={chartProvider}
            symbol={chartSymbol}
            providers={providers}
            executionProvider={executionProvider}
            patterns={sourceMatchesExecution ? data?.patterns : null}
            aiLevels={sourceMatchesExecution ? aiLevels : []}
            onChangeMarket={onChangeMarket}
            onOpenMarketSettings={() => onNavigate?.('settings')}
            onOpenAlerts={() => onNavigate?.('alerts')}
          />
        )}
      </div>
      <OrderPanel
        symbol={executionSymbol}
        account={data?.account}
        patterns={data?.patterns}
        analysisProvider={chartProvider}
        analysisSymbol={chartSymbol}
        executionProvider={executionProvider}
      />
    </div>
  );
}
