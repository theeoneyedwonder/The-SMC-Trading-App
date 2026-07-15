import { useState, useEffect } from 'react';

const API = 'http://127.0.0.1:8000';

function fmt(n, d = 2) {
  return n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function StatCard({ label, value, sub, accent = 'primary', bar }) {
  const accentText = { primary: 'text-primary', green: 'text-primary-fixed-dim', red: 'text-error', secondary: 'text-secondary' }[accent] ?? 'text-primary';
  const glow = { primary: 'bg-primary-fixed-dim/5', green: 'bg-primary-fixed-dim/5', red: 'bg-error/5', secondary: 'bg-secondary/5' }[accent] ?? 'bg-primary-fixed-dim/5';
  const barColor = { primary: 'bg-primary', green: 'bg-primary-fixed-dim', red: 'bg-error', secondary: 'bg-secondary' }[accent] ?? 'bg-primary';

  return (
    <div className="bg-[#141414] border-2 border-outline-variant p-md shadow-[4px_4px_0px_#000000] relative overflow-hidden">
      <div className={`absolute -right-4 -top-4 w-24 h-24 ${glow} rounded-full blur-xl pointer-events-none`} />
      <div className="font-label-caps text-label-caps text-on-surface-variant mb-sm relative z-10">{label}</div>
      <div className={`font-stat-lg text-stat-lg relative z-10 ${accentText}`}>{value}</div>
      {sub && <div className="font-label-caps text-label-caps text-on-surface-variant mt-sm relative z-10">{sub}</div>}
      {bar != null && (
        <div className="mt-sm h-1 w-full bg-surface-variant relative z-10">
          <div className={`h-full ${barColor}`} style={{ width: `${Math.min(Math.max(bar, 0), 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export default function Performance() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch(`${API}/performance`)
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-sm">
        <span className="material-symbols-outlined text-[40px] text-outline-variant animate-pulse">sync</span>
        <div className="font-label-caps text-label-caps text-on-surface-variant">LOADING PERFORMANCE DATA…</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-sm">
        <span className="material-symbols-outlined text-[40px] text-outline-variant">query_stats</span>
        <div className="font-headline-md text-headline-md text-on-surface-variant">NOT CONNECTED</div>
        <div className="font-label-caps text-label-caps text-outline">Connect to MT5 to see performance data</div>
      </div>
    );
  }

  const bestPeriod =
    Math.max(stats.today, stats.week, stats.month) === stats.month ? 'THIS MONTH' :
    Math.max(stats.today, stats.week) === stats.week ? 'THIS WEEK' : 'TODAY';

  return (
    <div className="flex-1 flex flex-col gap-md p-md overflow-y-auto min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-outline-variant pb-xs flex-wrap gap-sm shrink-0">
        <h1 className="font-display-lg text-[32px] font-black text-primary uppercase glow-text-primary tracking-tighter">Analytics</h1>
        <div className="flex items-center gap-xs px-sm py-xs bg-surface-container border-2 border-outline-variant">
          <span className="w-2 h-2 rounded-full bg-primary-fixed-dim shadow-[0_0_8px_#abd600] animate-pulse" />
          <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">LIVE DATA</span>
        </div>
      </div>

      {/* Realized P&L by period */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md shrink-0">
        <StatCard
          label="TODAY"
          value={`${stats.today >= 0 ? '+' : ''}${fmt(stats.today)}`}
          sub={`${stats.trades_today} TRADE${stats.trades_today !== 1 ? 'S' : ''} CLOSED`}
          accent={stats.today >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="THIS WEEK"
          value={`${stats.week >= 0 ? '+' : ''}${fmt(stats.week)}`}
          sub={`MON – ${new Date().toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}`}
          accent={stats.week >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="THIS MONTH"
          value={`${stats.month >= 0 ? '+' : ''}${fmt(stats.month)}`}
          sub={new Date().toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}
          accent={stats.month >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md shrink-0">
        <StatCard
          label="WIN RATE (TODAY)"
          value={`${fmt(stats.win_rate, 1)}%`}
          sub={stats.win_rate >= 50 ? 'ABOVE AVERAGE' : 'BELOW AVERAGE'}
          accent={stats.win_rate >= 50 ? 'green' : 'red'}
          bar={stats.win_rate}
        />
        <StatCard label="TRADES TODAY" value={String(stats.trades_today)} accent="secondary" />
        <StatCard label="BEST PERIOD" value={bestPeriod} accent="primary" />
      </div>
    </div>
  );
}
