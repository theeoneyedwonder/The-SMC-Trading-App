import { useState } from 'react';

function fmt(n, d = 2) {
  return n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// Risk:Reward from entry/sl/tp when both are set
function riskReward(t) {
  if (!t.sl || !t.tp || !t.entry) return '—';
  const risk = Math.abs(t.entry - t.sl);
  const reward = Math.abs(t.tp - t.entry);
  if (!risk) return '—';
  return `1 : ${(reward / risk).toFixed(1)}`;
}

export default function Trades({ trades, onViewHistory }) {
  const [filter, setFilter] = useState('');

  const rows = trades.filter(t =>
    !filter.trim() || (t.symbol || '').toLowerCase().includes(filter.trim().toLowerCase())
  );

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
            <button className="py-sm px-xs text-primary-fixed-dim border-b-2 border-primary-fixed-dim -mb-[2px]">
              OPEN POSITIONS ({trades.length})
            </button>
            <button onClick={onViewHistory} className="py-sm px-xs text-on-surface-variant hover:text-primary transition-colors">
              CLOSED HISTORY
            </button>
          </div>
          {/* Filter */}
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
        </div>
      </div>

      {/* Brutalist Data Table */}
      <div className="flex-1 flex flex-col bg-surface-container border-2 border-outline-variant shadow-[4px_4px_0px_#000000] overflow-hidden relative min-h-0">
        {/* Header */}
        <div className="grid grid-cols-7 gap-md px-md py-sm bg-surface-container-highest border-b-2 border-outline-variant font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest shrink-0">
          <div className="col-span-1">Symbol / Pair</div>
          <div className="col-span-1">Type</div>
          <div className="col-span-1 text-right">Entry Price</div>
          <div className="col-span-1 text-right">TP / SL</div>
          <div className="col-span-1 text-right">Risk / Reward</div>
          <div className="col-span-1 text-right">Unrealized P/L</div>
          <div className="col-span-1 text-right pr-sm">Status</div>
        </div>

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

        {/* Footer */}
        <div className="p-sm bg-surface border-t-2 border-outline-variant flex justify-between items-center shrink-0">
          <span className="font-label-caps text-label-caps text-on-surface-variant">
            SHOWING {rows.length} OF {trades.length} OPEN POSITIONS
          </span>
        </div>
      </div>
    </div>
  );
}
