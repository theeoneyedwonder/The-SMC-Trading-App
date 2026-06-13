function fmt(n, d=2) { return n==null?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }

function Card({ label, value, sub, variant }) {
  return (
    <div className={`metric-card${variant?' '+variant:''}`}>
      <div className="metric-label">{label}</div>
      <div className={`metric-value${variant?' '+variant:''}`}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

export default function AccountMetrics({ account: a }) {
  if (!a) return (
    <>
      <div className="page-header"><h1 className="page-title">Account</h1></div>
      <div className="page-loading"><div className="spinner"/><div className="loading-text">Waiting for connection…</div></div>
    </>
  );

  const marginLevel = a.margin > 0 ? ((a.equity / a.margin) * 100) : null;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Account — #{a.login ?? '—'}</h1>
      </div>
      <div className="metrics-grid">
        <Card label="Balance"      value={`${a.currency??''} ${fmt(a.balance)}`}     variant="highlight gold" />
        <Card label="Equity"       value={`${a.currency??''} ${fmt(a.equity)}`}      variant={a.equity >= a.balance ? 'green' : 'red'} />
        <Card label="Open P&L"     value={`${a.profit>=0?'+':''}${fmt(a.profit)}`}   variant={a.profit>=0?'green':'red'} />
        <Card label="Free Margin"  value={`${a.currency??''} ${fmt(a.free_margin)}`} />
        <Card label="Used Margin"  value={`${a.currency??''} ${fmt(a.margin)}`}      sub="currently in use" />
        <Card label="Margin Level" value={marginLevel != null ? `${fmt(marginLevel, 1)}%` : '—'} sub="equity / margin" />
        <Card label="Leverage"     value={a.leverage ? `1:${a.leverage}` : '—'} variant="indigo" />
        <Card label="Account Name" value={a.name ?? '—'} />
        <Card label="Broker"       value={a.company ?? '—'} />
        <Card label="Server"       value={a.server ?? '—'} />
        <Card label="Currency"     value={a.currency ?? '—'} />
        <Card label="Account #"    value={a.login ?? '—'} />
      </div>
    </>
  );
}
