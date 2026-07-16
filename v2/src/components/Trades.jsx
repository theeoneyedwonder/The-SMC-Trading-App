import { useState, useEffect } from 'react';
import Button from './Button';
import { dirClass } from '../lib/smcEvents';

const API = 'http://127.0.0.1:8000';

function fmt(n, d = 2) {
  return n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtDate(unix) {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Risk:Reward from entry/sl/tp when both are set
function riskReward(t) {
  if (!t.sl || !t.tp || !t.entry) return '—';
  const risk = Math.abs(t.entry - t.sl);
  const reward = Math.abs(t.tp - t.entry);
  if (!risk) return '—';
  return `1 : ${(reward / risk).toFixed(1)}`;
}

function OpenPositions({ trades, filter, setFilter }) {
  const [closing, setClosing] = useState(null); // 'all' | 'profitable' | 'unprofitable' | ticket
  const [journal, setJournal] = useState({}); // ticket -> annotation, the "why" behind each trade

  useEffect(() => {
    let live = true;
    const load = () => fetch(`${API}/journal?limit=200`)
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        if (!live || !Array.isArray(list)) return;
        const map = {};
        for (const j of list) map[j.ticket] = j;
        setJournal(map);
      })
      .catch(() => {});
    load();
    const id = setInterval(load, 15_000);
    return () => { live = false; clearInterval(id); };
  }, []);

  const rows = trades.filter(t =>
    !filter.trim() || (t.symbol || '').toLowerCase().includes(filter.trim().toLowerCase())
  );
  const hasProfitable = trades.some(t => (t.profit ?? 0) > 0);
  const hasUnprofitable = trades.some(t => (t.profit ?? 0) < 0);

  const closeBulk = async (mode) => {
    setClosing(mode);
    try {
      await fetch(`${API}/trade/close-all?mode=${mode}`, { method: 'POST' });
    } catch {}
    setClosing(null);
  };

  return (
    <>
      {/* Body */}
      <div className="flex-1 overflow-y-auto font-headline-md text-headline-md min-h-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-sm text-center py-xl">
            <span className="material-symbols-outlined text-[40px] text-outline-variant">inbox</span>
            <div className="font-headline-md text-headline-md text-on-surface-variant">NO OPEN POSITIONS</div>
            <div className="font-label-caps text-label-caps text-outline">Your active trades will appear here</div>
          </div>
        ) : rows.map((t, i) => {
          const pnl = t.profit ?? 0;
          const up = pnl > 0;
          const down = pnl < 0;
          return (
            <div
              key={t.ticket}
              className={
                'grid grid-cols-7 gap-md px-md py-md border-b-2 border-outline-variant border-l-4 items-center transition-colors hover:bg-surface-container-high ' +
                (up ? 'border-l-primary-fixed-dim ' : down ? 'border-l-error ' : 'border-l-transparent ') +
                (i % 2 ? 'bg-surface' : 'bg-surface-container')
              }
            >
              {/* Symbol */}
              <div className="col-span-1 flex flex-col">
                <span className="text-primary font-bold">{t.symbol}</span>
                <span className="font-label-caps text-label-caps text-on-surface-variant mt-xs">{fmt(t.lots, 2)} LOTS</span>
                {journal[t.ticket]?.setup_kind && (
                  <span
                    title={`Taken on the ${journal[t.ticket].setup_direction?.toLowerCase()} ${journal[t.ticket].setup_kind} setup detected on ${journal[t.ticket].setup_timeframe}`}
                    className={'font-label-caps text-label-caps mt-xs flex items-center gap-1 ' + dirClass(journal[t.ticket].setup_direction)}
                  >
                    <span className="material-symbols-outlined text-[11px]">psychology</span>
                    {journal[t.ticket].setup_timeframe} {journal[t.ticket].setup_kind}
                  </span>
                )}
              </div>
              {/* Type */}
              <div className={'col-span-1 flex items-center gap-xs ' + (t.direction === 'BUY' ? 'text-primary-fixed-dim' : 'text-error')}>
                <span className="material-symbols-outlined text-sm">{t.direction === 'BUY' ? 'north_east' : 'south_west'}</span>
                SMC {t.direction}
              </div>
              {/* Entry */}
              <div className="col-span-1 text-right text-on-surface">{fmt(t.entry, 5)}</div>
              {/* TP / SL */}
              <div className="col-span-1 text-right flex flex-col items-end">
                <span className="text-primary-fixed-dim">{t.tp ? fmt(t.tp, 5) : '—'}</span>
                <span className="text-error font-label-caps text-label-caps mt-xs">{t.sl ? fmt(t.sl, 5) : '—'}</span>
              </div>
              {/* R:R */}
              <div className="col-span-1 text-right text-on-surface-variant">{riskReward(t)}</div>
              {/* P/L */}
              <div className={'col-span-1 text-right flex flex-col items-end ' + (up ? 'text-primary-fixed-dim' : down ? 'text-error' : 'text-on-surface-variant')}>
                {pnl >= 0 ? '+' : ''}{fmt(pnl)}
                <span className="font-label-caps text-label-caps mt-xs text-on-surface-variant">SWAP {fmt(t.swap ?? 0)}</span>
              </div>
              {/* Status */}
              <div className="col-span-1 flex items-center justify-end pr-sm gap-sm">
                <div className={'w-2 h-2 ' + (up ? 'bg-primary-fixed-dim shadow-[0_0_8px_#abd600]' : down ? 'bg-error shadow-[0_0_8px_#ffb4ab]' : 'bg-on-surface-variant')} />
                <span className={'font-label-caps text-label-caps ' + (up ? 'text-primary-fixed-dim' : down ? 'text-error' : 'text-on-surface-variant')}>LIVE</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: count + bulk close actions */}
      <div className="p-sm bg-surface border-t-2 border-outline-variant flex justify-between items-center shrink-0 gap-md flex-wrap">
        <span className="font-label-caps text-label-caps text-on-surface-variant">
          SHOWING {rows.length} OF {trades.length} OPEN POSITIONS
        </span>
        {trades.length > 0 && (
          <div className="flex items-center gap-sm">
            <Button
              variant="primary" size="sm"
              disabled={!hasProfitable || closing !== null}
              onClick={() => closeBulk('profitable')}
            >
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              {closing === 'profitable' ? 'CLOSING…' : 'CLOSE PROFITABLE'}
            </Button>
            <Button
              variant="neutral" size="sm"
              disabled={!hasUnprofitable || closing !== null}
              onClick={() => closeBulk('unprofitable')}
            >
              <span className="material-symbols-outlined text-[14px]">trending_down</span>
              {closing === 'unprofitable' ? 'CLOSING…' : 'CLOSE UNPROFITABLE'}
            </Button>
            <Button
              variant="danger" size="sm"
              disabled={closing !== null}
              onClick={() => closeBulk('all')}
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              {closing === 'all' ? 'CLOSING…' : 'CLOSE ALL POSITIONS'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function ClosedHistory() {
  const [deals, setDeals]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays]       = useState(30);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetch(`${API}/history?days=${days}`)
      .then(r => r.json())
      .then(d => { if (live) { setDeals(Array.isArray(d) ? d : []); setLoading(false); } })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [days]);

  const totalPnl = deals.reduce((s, d) => s + (d.net ?? d.profit ?? 0), 0);

  return (
    <>
      <div className="flex items-center justify-between px-md py-sm border-b-2 border-outline-variant bg-surface-container-highest shrink-0 gap-md flex-wrap">
        <div className="flex items-center gap-md">
          <span className="font-label-caps text-label-caps text-on-surface-variant">
            {deals.length} TRADES
          </span>
          {deals.length > 0 && (
            <span className={'font-label-caps text-label-caps ' + (totalPnl >= 0 ? 'text-primary-fixed-dim' : 'text-error')}>
              NET: {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-xs">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={
                'px-sm py-xs font-label-caps text-label-caps border-2 transition-colors ' +
                (days === d
                  ? 'border-primary-fixed-dim text-primary-fixed-dim bg-primary-fixed/10'
                  : 'border-outline-variant text-on-surface-variant hover:text-primary')
              }
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-sm">
            <span className="material-symbols-outlined text-[32px] text-outline-variant animate-pulse">sync</span>
            <div className="font-label-caps text-label-caps text-on-surface-variant">LOADING HISTORY…</div>
          </div>
        ) : deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-sm text-center py-xl">
            <span className="material-symbols-outlined text-[40px] text-outline-variant">history</span>
            <div className="font-headline-md text-headline-md text-on-surface-variant">NO HISTORY FOUND</div>
            <div className="font-label-caps text-label-caps text-outline">No closed trades in the last {days} days</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-md px-md py-sm bg-surface-container-highest border-b-2 border-outline-variant font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest sticky top-0 z-10">
              <div className="col-span-1">Date / Time</div>
              <div className="col-span-1">Symbol</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1 text-right">Volume</div>
              <div className="col-span-1 text-right">Entry / Exit</div>
              <div className="col-span-1 text-right">Commission</div>
              <div className="col-span-1 text-right pr-sm">Net P/L</div>
            </div>
            {[...deals].reverse().map((d, i) => {
              const net = d.net ?? d.profit ?? 0;
              const up = net > 0, down = net < 0;
              return (
                <div
                  key={d.ticket}
                  className={
                    'grid grid-cols-7 gap-md px-md py-md border-b-2 border-outline-variant border-l-4 items-center transition-colors hover:bg-surface-container-high ' +
                    (up ? 'border-l-primary-fixed-dim ' : down ? 'border-l-error ' : 'border-l-transparent ') +
                    (i % 2 ? 'bg-surface' : 'bg-surface-container')
                  }
                >
                  <div className="col-span-1 font-label-caps text-label-caps text-on-surface-variant">{fmtDate(d.time)}</div>
                  <div className="col-span-1 text-primary font-bold font-headline-md text-headline-md">{d.symbol}</div>
                  <div className={'col-span-1 flex items-center gap-xs font-headline-md text-headline-md ' + (d.direction === 'BUY' ? 'text-primary-fixed-dim' : 'text-error')}>
                    <span className="material-symbols-outlined text-sm">{d.direction === 'BUY' ? 'north_east' : 'south_west'}</span>
                    {d.direction}
                  </div>
                  <div className="col-span-1 text-right text-on-surface font-headline-md text-headline-md">{fmt(d.volume, 2)}</div>
                  <div className="col-span-1 text-right flex flex-col items-end font-headline-md text-headline-md">
                    <span className="text-on-surface">{fmt(d.entry, 5)}</span>
                    <span className="text-on-surface-variant font-label-caps text-label-caps mt-xs">{fmt(d.price, 5)}</span>
                  </div>
                  <div className="col-span-1 text-right text-on-surface-variant font-headline-md text-headline-md">{fmt(d.commission)}</div>
                  <div className={'col-span-1 text-right pr-sm font-headline-md text-headline-md ' + (up ? 'text-primary-fixed-dim' : down ? 'text-error' : 'text-on-surface-variant')}>
                    {net >= 0 ? '+' : ''}{fmt(net)}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}

export default function Trades({ trades }) {
  const [tab, setTab] = useState('open'); // 'open' | 'closed'
  const [filter, setFilter] = useState('');

  return (
    <div className="flex-1 flex flex-col gap-md p-md overflow-hidden min-h-0">
      {/* Section Header & Controls */}
      <div className="flex flex-col gap-sm shrink-0">
        <h1 className="font-display-lg text-[32px] font-black text-primary uppercase border-b-2 border-outline-variant pb-xs w-max pr-lg glow-text-primary tracking-tighter">
          Positions &amp; History
        </h1>
        <div className="flex items-center justify-between mt-sm">
          {/* Tabs */}
          <div className="flex gap-md font-label-caps text-label-caps border-b-2 border-outline-variant flex-1">
            <button
              onClick={() => setTab('open')}
              className={'py-sm px-xs -mb-[2px] border-b-2 transition-colors ' + (tab === 'open' ? 'text-primary-fixed-dim border-primary-fixed-dim' : 'text-on-surface-variant border-transparent hover:text-primary')}
            >
              OPEN POSITIONS ({trades.length})
            </button>
            <button
              onClick={() => setTab('closed')}
              className={'py-sm px-xs -mb-[2px] border-b-2 transition-colors ' + (tab === 'closed' ? 'text-primary-fixed-dim border-primary-fixed-dim' : 'text-on-surface-variant border-transparent hover:text-primary')}
            >
              CLOSED HISTORY
            </button>
          </div>
          {/* Filter (open tab only) */}
          {tab === 'open' && (
            <div className="flex items-center gap-sm ml-md">
              <div className="flex items-center bg-surface-container border-2 border-outline-variant px-sm py-xs focus-within:border-primary-fixed-dim transition-colors shadow-[2px_2px_0px_#000000]">
                <span className="material-symbols-outlined text-on-surface-variant text-sm mr-xs">filter_list</span>
                <input
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  className="bg-transparent border-none text-body-base font-body-base text-primary p-0 w-32 placeholder-on-surface-variant outline-none"
                  placeholder="FILTER SYMBOL..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Brutalist Data Table */}
      <div className="flex-1 flex flex-col bg-surface-container border-2 border-outline-variant shadow-[4px_4px_0px_#000000] overflow-hidden relative min-h-0">
        {tab === 'open' ? (
          <>
            <div className="grid grid-cols-7 gap-md px-md py-sm bg-surface-container-highest border-b-2 border-outline-variant font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">
              <div className="col-span-1">Symbol / Pair</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-1 text-right">Entry Price</div>
              <div className="col-span-1 text-right">TP / SL</div>
              <div className="col-span-1 text-right">Risk / Reward</div>
              <div className="col-span-1 text-right">Unrealized P/L</div>
              <div className="col-span-1 text-right pr-sm">Status</div>
            </div>
            <OpenPositions trades={trades} filter={filter} setFilter={setFilter} />
          </>
        ) : (
          <ClosedHistory />
        )}
      </div>
    </div>
  );
}
