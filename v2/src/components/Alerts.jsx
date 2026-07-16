import { useState, useEffect, useCallback } from 'react';
import Button from './Button';

const API = 'http://127.0.0.1:8000';
const FALLBACK_SYMBOLS = ['XAUUSDm', 'XAGUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm', 'BTCUSDm', 'NAS100m', 'US30m'];

const KIND_ICON = {
  SAGE:         { icon: 'auto_awesome',   fill: true,  wrap: 'bg-secondary-container/20 border-secondary-container', text: 'text-secondary' },
  EXECUTION:    { icon: 'bolt',           fill: false, wrap: 'bg-primary-fixed/20 border-primary-fixed-dim',         text: 'text-primary-fixed-dim' },
  PRICE_ALERT:  { icon: 'notifications',  fill: false, wrap: 'bg-surface-container-high border-outline',            text: 'text-on-surface' },
  SYSTEM:       { icon: 'info',           fill: false, wrap: 'bg-surface-container-high border-outline-variant',    text: 'text-on-surface-variant' },
};

function fmtClock(iso) {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  if (isNaN(d)) return '--:--:--';
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

function CreateAlertModal({ symbols, onClose, onCreated }) {
  const [symbol, setSymbol]       = useState(symbols[0] || 'XAUUSDm');
  const [condition, setCondition] = useState('above');
  const [target, setTarget]       = useState('');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  const submit = async () => {
    const val = Number(target);
    if (!val || val <= 0) { setErr('Enter a valid target price.'); return; }
    setSaving(true);
    setErr('');
    try {
      const r = await fetch(`${API}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, condition, target: val }),
      });
      if (!r.ok) throw new Error();
      onCreated();
      onClose();
    } catch {
      setErr('Could not create alert.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-surface-container-lowest/80 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div className="bg-[#141414]/90 backdrop-blur-xl border-2 border-outline-variant w-[400px] max-w-[90vw] flex flex-col relative z-10 shadow-[10px_10px_0px_0px_#000]">
        <div className="p-md border-b-2 border-outline-variant flex justify-between items-center">
          <h3 className="font-headline-md text-headline-md text-primary">Configure Alert</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-md flex flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant">SYMBOL</label>
            <select
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              className="bg-[#0e0e0e] border-2 border-outline-variant p-sm font-stat-lg text-stat-lg text-[13px] text-primary w-full focus:outline-none focus:border-primary-fixed-dim"
            >
              {symbols.map(s => <option key={s} value={s} className="bg-surface-container text-on-surface">{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant">CONDITION</label>
            <div className="grid grid-cols-2 gap-sm">
              <button
                type="button"
                onClick={() => setCondition('above')}
                className={'p-sm font-body-bold text-sm border-2 transition-colors ' + (condition === 'above' ? 'bg-surface-variant border-primary-fixed-dim text-primary-fixed-dim' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-outline')}
              >
                CROSS ABOVE
              </button>
              <button
                type="button"
                onClick={() => setCondition('below')}
                className={'p-sm font-body-bold text-sm border-2 transition-colors ' + (condition === 'below' ? 'bg-surface-variant border-error text-error' : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-outline')}
              >
                CROSS BELOW
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-xs">
            <label className="font-label-caps text-label-caps text-on-surface-variant">TARGET PRICE</label>
            <input
              type="number"
              step="any"
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              className="bg-[#0e0e0e] border-2 border-outline-variant p-sm font-stat-lg text-stat-lg text-[13px] text-primary w-full text-right focus:outline-none focus:border-primary-fixed-dim"
              placeholder="0.00"
            />
          </div>
          {err && <div className="font-label-caps text-label-caps text-error">{err}</div>}
          <Button variant="primary" size="md" disabled={saving} onClick={submit} className="mt-sm w-full">
            {saving ? 'SAVING…' : 'SET ALERT'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Alerts() {
  const [alerts, setAlerts]     = useState([]);
  const [log, setLog]           = useState([]);
  const [symbols, setSymbols]   = useState(FALLBACK_SYMBOLS);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const loadAlerts = useCallback(() => {
    fetch(`${API}/alerts`).then(r => r.ok ? r.json() : []).then(d => setAlerts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const loadLog = useCallback(() => {
    fetch(`${API}/alerts/log?limit=50`).then(r => r.ok ? r.json() : []).then(d => { setLog(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/symbols/available`).then(r => r.ok ? r.json() : null).then(d => { if (d?.symbols?.length) setSymbols(d.symbols); }).catch(() => {});
    loadAlerts();
    loadLog();
    const id = setInterval(() => { loadAlerts(); loadLog(); }, 5_000);
    return () => clearInterval(id);
  }, [loadAlerts, loadLog]);

  const removeAlert = async (id) => {
    try { await fetch(`${API}/alerts/${id}`, { method: 'DELETE' }); } catch {}
    loadAlerts();
  };

  const activeCount = alerts.filter(a => a.enabled && !a.triggered).length;
  const triggeredToday = alerts.filter(a => a.triggered).length;

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-md p-md overflow-hidden min-h-0">
      {/* Log panel */}
      <section className="flex-1 flex flex-col bg-surface-container-low border-2 border-outline-variant min-h-0">
        <div className="px-md py-sm border-b-2 border-outline-variant flex justify-between items-center bg-surface-container-highest shrink-0">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary-fixed-dim">format_list_bulleted</span>
            <h2 className="font-headline-md text-headline-md text-primary">System Log</h2>
          </div>
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
            <span className="material-symbols-outlined text-[14px]">add</span>
            Create Alert
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-sm">
              <span className="material-symbols-outlined text-[32px] text-outline-variant animate-pulse">sync</span>
              <div className="font-label-caps text-label-caps text-on-surface-variant">LOADING EVENT LOG…</div>
            </div>
          ) : log.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-sm text-center py-xl">
              <span className="material-symbols-outlined text-[40px] text-outline-variant">inbox</span>
              <div className="font-headline-md text-headline-md text-on-surface-variant">NO EVENTS YET</div>
              <div className="font-label-caps text-label-caps text-outline">System events, trades, and alerts will appear here</div>
            </div>
          ) : (
            <table className="w-full text-left font-body-base">
              <thead className="sticky top-0 bg-surface-container-lowest border-b-2 border-outline-variant z-10 font-label-caps text-label-caps text-on-surface-variant">
                <tr>
                  <th className="py-sm px-md w-24">TIME</th>
                  <th className="py-sm px-md w-16">TYPE</th>
                  <th className="py-sm px-md">EVENT / MESSAGE</th>
                  <th className="py-sm px-md w-32 text-right">VALUE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {log.map(e => {
                  const meta = KIND_ICON[e.kind] || KIND_ICON.SYSTEM;
                  return (
                    <tr key={e.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-md px-md text-on-surface-variant font-stat-lg text-sm">{fmtClock(e.time)}</td>
                      <td className="py-md px-md">
                        <div className={`w-8 h-8 flex items-center justify-center border-2 ${meta.wrap}`}>
                          <span className={`material-symbols-outlined ${meta.text}`} style={meta.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}>{meta.icon}</span>
                        </div>
                      </td>
                      <td className="py-md px-md">
                        <div className="flex flex-col">
                          <span className={`font-body-bold ${meta.text}`}>{e.kind.replace('_', ' ')}: {e.title}</span>
                          <span className="text-on-surface text-sm">{e.message}</span>
                        </div>
                      </td>
                      <td className="py-md px-md text-right font-stat-lg text-sm text-primary">{e.value ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Active alerts + stats */}
      <aside className="w-full md:w-[320px] shrink-0 flex flex-col gap-md min-h-0">
        <div className="bg-surface-container-low border-2 border-outline-variant flex flex-col flex-1 min-h-0">
          <div className="p-sm bg-secondary-container/20 border-b-2 border-secondary-container flex items-center justify-between shrink-0">
            <div className="flex items-center gap-xs text-secondary">
              <span className="material-symbols-outlined text-[16px]">notifications_active</span>
              <span className="font-label-caps text-label-caps">ACTIVE ALERTS ({activeCount})</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-sm flex flex-col gap-xs min-h-0">
            {alerts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-xs text-center py-lg">
                <span className="material-symbols-outlined text-[24px] text-outline-variant">notifications_off</span>
                <span className="font-label-caps text-label-caps text-on-surface-variant">NO ALERTS SET</span>
              </div>
            ) : alerts.map(a => (
              <div key={a.id} className={'p-sm border-2 flex items-center justify-between gap-sm ' + (a.triggered ? 'border-outline-variant bg-surface/30 opacity-60' : 'border-outline-variant bg-surface')}>
                <div className="flex flex-col min-w-0">
                  <span className="font-body-bold text-primary truncate">{a.symbol}</span>
                  <span className="font-label-caps text-label-caps text-on-surface-variant">
                    {a.condition === 'above' ? 'CROSS ABOVE' : 'CROSS BELOW'} {a.target}
                  </span>
                  {a.triggered && <span className="font-label-caps text-label-caps text-primary-fixed-dim mt-1">TRIGGERED</span>}
                </div>
                <button onClick={() => removeAlert(a.id)} className="text-on-surface-variant hover:text-error transition-colors shrink-0">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low border-2 border-outline-variant shrink-0">
          <div className="px-md py-sm border-b-2 border-outline-variant bg-surface-container-highest">
            <span className="font-label-caps text-label-caps text-on-surface-variant">NODE STATUS</span>
          </div>
          <div className="p-md flex flex-col gap-md">
            <div className="flex items-center justify-between">
              <span className="font-body-base text-sm text-on-surface-variant">Active Alerts</span>
              <span className="font-stat-lg text-sm text-primary">{activeCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body-base text-sm text-on-surface-variant">Triggered</span>
              <span className="font-stat-lg text-sm text-primary-fixed-dim">{triggeredToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body-base text-sm text-on-surface-variant">Events Logged</span>
              <span className="font-stat-lg text-sm text-primary">{log.length}</span>
            </div>
          </div>
        </div>
      </aside>

      {modalOpen && (
        <CreateAlertModal symbols={symbols} onClose={() => setModalOpen(false)} onCreated={loadAlerts} />
      )}
    </div>
  );
}
