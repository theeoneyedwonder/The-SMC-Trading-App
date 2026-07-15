function fmt(n, d = 2) {
  return n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function StatCard({ label, value, sub, accent = 'primary' }) {
  const accentText = { primary: 'text-primary', green: 'text-primary-fixed-dim', red: 'text-error', secondary: 'text-secondary' }[accent] ?? 'text-primary';
  const glow = { primary: 'bg-primary-fixed-dim/5', green: 'bg-primary-fixed-dim/5', red: 'bg-error/5', secondary: 'bg-secondary/5' }[accent] ?? 'bg-primary-fixed-dim/5';

  return (
    <div className="bg-[#141414] border-2 border-outline-variant p-md shadow-[4px_4px_0px_#000000] relative overflow-hidden">
      <div className={`absolute -right-4 -top-4 w-24 h-24 ${glow} rounded-full blur-xl pointer-events-none`} />
      <div className="font-label-caps text-label-caps text-on-surface-variant mb-sm relative z-10">{label}</div>
      <div className={`font-stat-lg text-stat-lg relative z-10 ${accentText}`}>{value}</div>
      {sub && <div className="font-label-caps text-label-caps text-on-surface-variant mt-sm relative z-10">{sub}</div>}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex flex-col gap-xs p-sm bg-surface-container-low border-2 border-outline-variant">
      <span className="font-label-caps text-label-caps text-on-surface-variant">{label}</span>
      <span className="font-body-bold text-body-bold text-primary truncate">{value ?? '—'}</span>
    </div>
  );
}

export default function AccountMetrics({ account: a }) {
  if (!a || !a.login) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-sm">
        <span className="material-symbols-outlined text-[40px] text-outline-variant animate-pulse">sync</span>
        <div className="font-label-caps text-label-caps text-on-surface-variant">WAITING FOR CONNECTION…</div>
      </div>
    );
  }

  const marginLevel = a.margin > 0 ? (a.equity / a.margin) * 100 : null;
  const profitUp    = (a.profit ?? 0) >= 0;
  const equityUp    = a.equity >= a.balance;

  return (
    <div className="flex-1 flex flex-col gap-md p-md overflow-y-auto min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-outline-variant pb-xs flex-wrap gap-sm shrink-0">
        <h1 className="font-display-lg text-[32px] font-black text-primary uppercase glow-text-primary tracking-tighter">Account</h1>
        <div className="flex items-center gap-xs">
          <span className="w-2 h-2 rounded-full bg-primary-fixed-dim shadow-[0_0_8px_#abd600] animate-pulse" />
          <span className="font-label-caps text-label-caps text-primary-fixed-dim tracking-widest">CONNECTED · #{a.login}</span>
        </div>
      </div>

      {/* Hero: Balance / Equity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md shrink-0">
        <div className="glass-panel module-glow p-md relative overflow-hidden">
          <div className="font-label-caps text-label-caps text-on-surface-variant mb-xs relative z-10">BALANCE</div>
          <div className="font-stat-lg text-[32px] font-black text-primary tracking-tighter relative z-10">
            {a.currency} {fmt(a.balance)}
          </div>
          <div className="absolute bottom-0 right-0 left-0 h-8 flex items-end gap-[2px] opacity-40 px-2 pb-1 pointer-events-none">
            {[40, 70, 50, 90, 100].map((h, i) => (
              <div key={i} className="flex-1 bg-primary-fixed shadow-[0_0_12px_rgba(195,244,0,0.8)]" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className={'glass-panel p-md relative overflow-hidden ' + (equityUp ? 'module-glow' : 'module-glow-secondary')}>
          <div className="font-label-caps text-label-caps text-on-surface-variant mb-xs">EQUITY</div>
          <div className={'font-stat-lg text-[32px] font-black tracking-tighter ' + (equityUp ? 'text-primary-fixed-dim glow-text-primary' : 'text-error')}>
            {a.currency} {fmt(a.equity)}
          </div>
          <div className={'font-label-caps text-label-caps mt-sm ' + (profitUp ? 'text-primary-fixed-dim' : 'text-error')}>
            OPEN P/L {profitUp ? '+' : ''}{fmt(a.profit)}
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md shrink-0">
        <StatCard label="FREE MARGIN"  value={`${a.currency} ${fmt(a.free_margin)}`} />
        <StatCard label="USED MARGIN"  value={`${a.currency} ${fmt(a.margin)}`} />
        <StatCard
          label="MARGIN LEVEL"
          value={marginLevel != null ? `${fmt(marginLevel, 1)}%` : '—'}
          sub="EQUITY / MARGIN"
          accent={marginLevel != null && marginLevel < 150 ? 'red' : 'green'}
        />
        <StatCard label="LEVERAGE" value={a.leverage ? `1:${a.leverage}` : '—'} accent="secondary" />
      </div>

      {/* Identity panel */}
      <div className="glass-panel p-md flex flex-col gap-md shrink-0">
        <div className="flex items-center gap-sm border-b border-white/10 pb-xs">
          <span className="material-symbols-outlined text-primary-fixed-dim">badge</span>
          <h2 className="font-headline-md text-headline-md text-primary">MT5 Account Details</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-md">
          <Field label="ACCOUNT NAME" value={a.name} />
          <Field label="ACCOUNT #"    value={a.login} />
          <Field label="BROKER"       value={a.company} />
          <Field label="SERVER"       value={a.server} />
          <Field label="CURRENCY"     value={a.currency} />
          <Field label="LEVERAGE"     value={a.leverage ? `1:${a.leverage}` : '—'} />
        </div>
      </div>
    </div>
  );
}
