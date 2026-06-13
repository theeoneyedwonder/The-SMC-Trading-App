import Chart from './Chart';

function fmt(n, decimals = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pnlClass(n) {
  if (n == null) return '';
  return n > 0 ? 'pos' : n < 0 ? 'neg' : '';
}

export default function Home({ symbol, data, aiLevels }) {
  const acct = data?.account;

  return (
    <div className="home">
      <Chart symbol={symbol} patterns={data?.patterns} aiLevels={aiLevels} />
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-item-label">Balance</span>
          <span className="stat-item-value">{acct ? `${acct.currency ?? ''} ${fmt(acct.balance)}` : '—'}</span>
        </div>
        <div className="stats-bar-divider" />
        <div className="stat-item">
          <span className="stat-item-label">Equity</span>
          <span className="stat-item-value">{acct ? `${acct.currency ?? ''} ${fmt(acct.equity)}` : '—'}</span>
        </div>
        <div className="stats-bar-divider" />
        <div className="stat-item">
          <span className="stat-item-label">Free Margin</span>
          <span className="stat-item-value">{acct ? `${acct.currency ?? ''} ${fmt(acct.free_margin)}` : '—'}</span>
        </div>
        <div className="stats-bar-divider" />
        <div className="stat-item">
          <span className="stat-item-label">Open P&L</span>
          <span className={`stat-item-value ${pnlClass(acct?.profit)}`}>
            {acct ? `${acct.profit >= 0 ? '+' : ''}${fmt(acct.profit)}` : '—'}
          </span>
        </div>
        <div className="stats-bar-divider" />
        <div className="stat-item">
          <span className="stat-item-label">Open Trades</span>
          <span className="stat-item-value">{data?.trades?.length ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}
