import { useState, useEffect } from 'react';

const API = 'http://127.0.0.1:8000';

function fmt(n, d=2) { return n==null?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtDate(unix) { if (!unix) return '—'; return new Date(unix*1000).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }

export default function History() {
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

  const totalPnl = deals.reduce((s, d) => s + (d.profit ?? 0), 0);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">
          Trade History
          <span className="page-count">{deals.length} trades</span>
          {deals.length > 0 && (
            <span style={{marginLeft:'auto', fontSize:13, fontWeight:700, color: totalPnl>=0?'var(--green)':'var(--red)'}}>
              Net: {totalPnl>=0?'+':''}{fmt(totalPnl)}
            </span>
          )}
        </h1>
      </div>

      <div className="filter-bar">
        <span style={{fontSize:11,color:'var(--text2)'}}>Show last</span>
        <select className="filter-select" value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={7}>7 days</option>
          <option value={14}>14 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="spinner"/>
          <div className="loading-text">Loading trade history…</div>
        </div>
      ) : deals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◷</div>
          <div className="empty-state-text">No History Found</div>
          <div className="empty-state-sub">No closed trades in the last {days} days</div>
        </div>
      ) : (
        <div className="page-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Symbol</th>
                <th>Direction</th>
                <th>Volume</th>
                <th>Price</th>
                <th>Commission</th>
                <th>Swap</th>
                <th style={{textAlign:'right'}}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {[...deals].reverse().map(d => {
                const profit = d.profit ?? 0;
                return (
                  <tr key={d.ticket}>
                    <td style={{color:'var(--text2)',fontSize:11}}>{fmtDate(d.time)}</td>
                    <td style={{fontWeight:700}}>{d.symbol}</td>
                    <td><span className={d.direction==='BUY'?'badge-buy':'badge-sell'}>{d.direction}</span></td>
                    <td>{fmt(d.volume, 2)}</td>
                    <td>{fmt(d.price, 5)}</td>
                    <td style={{color:'var(--text2)'}}>{fmt(d.commission)}</td>
                    <td style={{color:'var(--text2)'}}>{fmt(d.swap)}</td>
                    <td style={{textAlign:'right'}}>
                      <span className={profit>0?'pnl-pos':profit<0?'pnl-neg':'pnl-zero'}>
                        {profit>=0?'+':''}{fmt(profit)}
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
