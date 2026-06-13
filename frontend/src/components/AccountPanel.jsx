const fmt = (n) => (n != null ? n.toFixed(2) : '—');

export default function AccountPanel({ account }) {
  const empty = !account || !Object.keys(account).length;

  return (
    <div className="panel">
      <div className="panel-title">
        Account
        {!empty && <span className="muted" style={{ marginLeft: 6 }}>#{account.login}</span>}
      </div>

      {empty ? (
        <div className="no-data">Waiting for connection…</div>
      ) : (
        <div className="account-grid">
          <Stat label="Balance"     value={`$${fmt(account.balance)}`} />
          <Stat label="Equity"      value={`$${fmt(account.equity)}`}  />
          <Stat label="Free Margin" value={`$${fmt(account.margin)}`}  />
          <Stat
            label="Open P&L"
            value={`${account.profit >= 0 ? '+' : ''}$${fmt(account.profit)}`}
            color={account.profit >= 0 ? 'green' : 'red'}
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className={`stat-value${color ? ` ${color}` : ''}`}>{value}</span>
    </div>
  );
}
