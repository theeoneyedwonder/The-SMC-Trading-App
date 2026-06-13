import { useState, useEffect } from 'react';
import './App.css';
import { useWebSocket }    from './hooks/useWebSocket';
import Setup               from './components/Setup';
import Header              from './components/Header';
import AccountPanel        from './components/AccountPanel';
import TradePanel          from './components/TradePanel';
import StructurePanel      from './components/StructurePanel';
import Chart               from './components/Chart';

const API = 'http://127.0.0.1:8000';

export default function App() {
  // null = still checking, false = need setup, true = ready
  const [configured, setConfigured] = useState(null);
  const [symbol, setSymbol]         = useState('XAUUSDm');
  const { data, connected }         = useWebSocket();

  // On mount, poll /setup/status until the backend responds
  useEffect(() => {
    let live = true;
    const check = async () => {
      try {
        const r = await fetch(`${API}/setup/status`);
        if (r.ok && live) {
          const d = await r.json();
          setConfigured(d.configured);
          return;
        }
      } catch {}
      if (live) setTimeout(check, 1000);
    };
    check();
    return () => { live = false; };
  }, []);

  const activeSymbol = data?.symbol ?? symbol;

  // Still checking → blank (Electron splash covers this window)
  if (configured === null) return null;

  // Not configured → setup wizard
  if (!configured) {
    return <Setup onComplete={() => setConfigured(true)} />;
  }

  // Dashboard
  return (
    <div className="app">
      <Header
        connected={connected}
        symbol={activeSymbol}
        onSymbolChange={setSymbol}
        onSettings={() => setConfigured(false)}
      />
      <div className="main">
        <div className="chart-col">
          <Chart symbol={activeSymbol} patterns={data?.patterns} />
        </div>
        <div className="sidebar">
          <AccountPanel account={data?.account} />
          <TradePanel   trades={data?.trades ?? []} />
          <StructurePanel indicators={data?.indicators} />
        </div>
      </div>
    </div>
  );
}
