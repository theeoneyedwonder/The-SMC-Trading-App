import { useState, useEffect } from 'react';

const API = 'http://127.0.0.1:8000';

function fmt(n, d=2) { return n==null?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function pnlClass(n) { return n>0?'pos':n<0?'neg':'zero'; }
function sign(n)     { return n>=0?'+':''; }

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

  if (loading) return (
    <>
      <div className="page-header"><h1 className="page-title">Performance</h1></div>
      <div className="page-loading"><div className="spinner"/><div className="loading-text">Loading performance data…</div></div>
    </>
  );

  if (!stats) return (
    <>
      <div className="page-header"><h1 className="page-title">Performance</h1></div>
      <div className="empty-state"><div className="empty-state-icon">📈</div><div className="empty-state-text">Not Connected</div><div className="empty-state-sub">Connect to MT5 to see performance data</div></div>
    </>
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Performance</h1>
      </div>

      <div className="perf-grid">
        <div className={`perf-card featured`}>
          <div className="perf-period">Today</div>
          <div className={`perf-pnl ${pnlClass(stats.today)}`}>{sign(stats.today)}{fmt(stats.today)}</div>
          <div className="perf-sub">{stats.trades_today} trade{stats.trades_today!==1?'s':''} closed today</div>
        </div>
        <div className="perf-card">
          <div className="perf-period">This Week</div>
          <div className={`perf-pnl ${pnlClass(stats.week)}`}>{sign(stats.week)}{fmt(stats.week)}</div>
          <div className="perf-sub">Mon – {new Date().toLocaleDateString('en-US',{weekday:'short'})}</div>
        </div>
        <div className="perf-card">
          <div className="perf-period">This Month</div>
          <div className={`perf-pnl ${pnlClass(stats.month)}`}>{sign(stats.month)}{fmt(stats.month)}</div>
          <div className="perf-sub">{new Date().toLocaleDateString('en-US',{month:'long'})}</div>
        </div>
      </div>

      <div className="perf-stats">
        <div className="perf-stat-card">
          <div className="perf-stat-label">Win Rate (Today)</div>
          <div className="perf-stat-value">{fmt(stats.win_rate, 1)}%</div>
          <div className="win-bar-wrap">
            <div className="win-bar-bg">
              <div className="win-bar-fill" style={{width:`${Math.min(stats.win_rate, 100)}%`}} />
            </div>
            <div className="win-bar-label">{stats.win_rate >= 50 ? 'Above average' : 'Below average'}</div>
          </div>
        </div>
        <div className="perf-stat-card">
          <div className="perf-stat-label">Trades Today</div>
          <div className="perf-stat-value">{stats.trades_today}</div>
        </div>
        <div className="perf-stat-card">
          <div className="perf-stat-label">Best Period</div>
          <div className="perf-stat-value" style={{fontSize:14}}>
            {Math.max(stats.today, stats.week, stats.month) === stats.month ? 'This Month' :
             Math.max(stats.today, stats.week) === stats.week ? 'This Week' : 'Today'}
          </div>
        </div>
      </div>
    </>
  );
}
