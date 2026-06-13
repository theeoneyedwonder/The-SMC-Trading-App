export default function TradePanel({ trades }) {
  return (
    <div className="panel">
      <div className="panel-title">
        Open Trades
        <span className="badge">{trades.length}</span>
      </div>

      {trades.length === 0 ? (
        <div className="no-data">No open positions</div>
      ) : (
        <div className="trades-list">
          {trades.map(t => (
            <div key={t.ticket} className="trade-row">
              <span className={`dir-badge ${t.direction.toLowerCase()}`}>
                {t.direction}
              </span>
              <span className="trade-info">
                {t.lots}L&nbsp;&nbsp;@&nbsp;{t.entry.toFixed(2)}
              </span>
              <span className={`trade-pnl ${t.profit >= 0 ? 'green' : 'red'}`}>
                {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
