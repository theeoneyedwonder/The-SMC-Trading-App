import { useState } from 'react';

const API     = 'http://127.0.0.1:8000';
const SYMBOLS = [
  'XAUUSDm', 'XAGUSDm', 'EURUSDm', 'GBPUSDm',
  'USDJPYm', 'BTCUSDm', 'NAS100m', 'US30m',
];

export default function Header({ connected, symbol, onSymbolChange, onSettings }) {
  const [busy, setBusy] = useState(false);

  const handleChange = async (e) => {
    const sym = e.target.value;
    setBusy(true);
    try {
      await fetch(`${API}/symbol/${sym}`, { method: 'POST' });
      onSymbolChange(sym);
    } catch {
      onSymbolChange(sym);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <span className="logo">SMC Bot</span>
        <select
          value={symbol}
          onChange={handleChange}
          disabled={busy}
          className="symbol-select"
        >
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="header-right">
        <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
        <span className="status-text">{connected ? 'Live' : 'Disconnected'}</span>
        <button
          className="settings-btn"
          onClick={onSettings}
          title="Change MT5 Account"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
