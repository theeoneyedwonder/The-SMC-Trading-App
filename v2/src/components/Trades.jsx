function fmt(n, d = 2) { return n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits:d, maximumFractionDigits:d }); }

function duration(openTime) {
  if (!openTime) return '—';
  const secs = Math.floor(Date.now() / 1000) - openTime;
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs/60)}m`;
  if (secs < 86400)return `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`;
  return `${Math.floor(secs/86400)}d ${Math.floor((secs%86400)/3600)}h`;
}

export default function Trades({ trades }) {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          Open Positions
          <span className="page-count">{trades.length}</span>
        </h1>
      </div>

      {trades.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◈</div>
          <div className="empty-state-text">No Open Positions</div>
          <div className="empty-state-sub">Your active trades will appear here</div>
        </div>
      ) : (
        <div className="page-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Direction</th>
                <th>Lots</th>
                <th>Entry Price</th>
                <th>Stop Loss</th>
                <th>Take Profit</th>
                <th>Swap</th>
                <th>Duration</th>
                <th style={{textAlign:'right'}}>P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(t => {
                const pnl = t.profit ?? 0;
                return (
                  <tr key={t.ticket}>
                    <td style={{fontWeight:700, color:'var(--text)'}}>{t.symbol ?? '—'}</td>
                    <td><span className={t.direction==='BUY'?'badge-buy':'badge-sell'}>{t.direction}</span></td>
                    <td>{fmt(t.lots, 2)}</td>
                    <td>{fmt(t.entry, 5)}</td>
                    <td style={{color:'var(--red)'}}>{t.sl ? fmt(t.sl, 5) : '—'}</td>
                    <td style={{color:'var(--green)'}}>{t.tp ? fmt(t.tp, 5) : '—'}</td>
                    <td style={{color:'var(--text2)'}}>{fmt(t.swap ?? 0)}</td>
                    <td style={{color:'var(--text2)'}}>{duration(t.time)}</td>
                    <td style={{textAlign:'right'}}>
                      <span className={pnl>0?'pnl-pos':pnl<0?'pnl-neg':'pnl-zero'}>
                        {pnl>=0?'+':''}{fmt(pnl)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
