import { useState, useEffect, useCallback } from 'react';
import Button from './Button';

const API = 'http://127.0.0.1:8000';

const RANGES = [
  { label: 'TODAY',  days: 0 },
  { label: '3 DAYS', days: 3 },
  { label: 'WEEK',   days: 7 },
];

const IMPACT_STYLE = {
  high:   'bg-error border-error-container',
  medium: 'bg-secondary border-secondary-container',
  low:    'bg-surface-tint border-outline-variant',
};

function fmtTime(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso.replace(' ', 'T'));
  if (isNaN(d)) return iso.split(' ')[1]?.slice(0, 5) ?? '--:--';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function fmtVal(v, unit) {
  if (v == null) return '—';
  return `${v}${unit || ''}`;
}

export default function EconomicCalendar({ onOpenSettings }) {
  const [days, setDays]         = useState(0);
  const [configured, setConfigured] = useState(true);
  const [events, setEvents]     = useState([]);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [highImpactOnly, setHighImpactOnly] = useState(false);

  const load = useCallback(() => {
    fetch(`${API}/economic-calendar?days=${days}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setConfigured(d.configured !== false);
        setEvents(Array.isArray(d.events) ? d.events : []);
        setError(d.error || null);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setError('Could not reach the backend.'); });
  }, [days]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const rows = highImpactOnly ? events.filter(e => e.impact === 'high') : events;

  return (
    <div className="qc-page qc-calendar flex-1 flex flex-col gap-lg p-lg overflow-hidden min-h-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-outline-variant pb-md shrink-0 gap-sm">
        <div>
          <h1 className="font-display-lg text-[32px] font-black text-primary uppercase glow-text-primary tracking-tighter">Economic Calendar</h1>
          <p className="font-body-base text-on-surface-variant mt-xs">High-impact macroeconomic event tracker.</p>
        </div>
        <div className="flex items-center gap-sm">
          <label className="flex items-center gap-xs font-label-caps text-label-caps text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={highImpactOnly} onChange={e => setHighImpactOnly(e.target.checked)} className="w-4 h-4 accent-error" />
            HIGH IMPACT ONLY
          </label>
          <div className="flex gap-xs bg-surface-container-low p-xs border-2 border-outline-variant shadow-[3px_3px_0px_#000]">
            {RANGES.map(r => (
              <button
                key={r.label}
                onClick={() => setDays(r.days)}
                className={
                  'px-md py-xs font-label-caps text-label-caps border-b-2 transition-colors ' +
                  (days === r.days ? 'bg-secondary-container/20 text-secondary border-secondary' : 'text-on-surface-variant border-transparent hover:text-primary')
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel border-2 border-outline-variant shadow-[4px_4px_0px_#000] flex-1 flex flex-col overflow-hidden min-h-0">
        {!configured ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-md text-center p-xl">
            <span className="material-symbols-outlined text-[40px] text-outline-variant">event_busy</span>
            <div className="font-headline-md text-headline-md text-on-surface-variant">CALENDAR NOT CONFIGURED</div>
            <p className="font-body-base text-[13px] text-on-surface-variant max-w-[380px]">
              Add a free Finnhub API key in Settings &gt; Economic Calendar to see live high-impact events here.
            </p>
            {onOpenSettings && (
              <Button variant="primary" size="md" onClick={onOpenSettings}>
                <span className="material-symbols-outlined text-[16px]">settings</span>
                Open Settings
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-sm p-sm border-b-2 border-outline-variant bg-surface-container-highest font-label-caps text-label-caps text-on-surface-variant shrink-0">
              <div className="col-span-2 md:col-span-1">Time</div>
              <div className="col-span-2 md:col-span-1 text-center">Impact</div>
              <div className="col-span-8 md:col-span-5">Event</div>
              <div className="col-span-4 md:col-span-1 text-right hidden md:block">Actual</div>
              <div className="col-span-4 md:col-span-2 text-right hidden md:block">Forecast</div>
              <div className="col-span-4 md:col-span-2 text-right hidden md:block">Previous</div>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-sm py-xl">
                  <span className="material-symbols-outlined text-[32px] text-outline-variant animate-pulse">sync</span>
                  <div className="font-label-caps text-label-caps text-on-surface-variant">LOADING CALENDAR…</div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-full gap-sm text-center py-xl">
                  <span className="material-symbols-outlined text-[32px] text-error">error</span>
                  <div className="font-label-caps text-label-caps text-error">COULD NOT FETCH CALENDAR</div>
                  <div className="font-body-base text-[12px] text-on-surface-variant max-w-[380px]">{error}</div>
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-sm text-center py-xl">
                  <span className="material-symbols-outlined text-[32px] text-outline-variant">event_available</span>
                  <div className="font-label-caps text-label-caps text-on-surface-variant">NO EVENTS IN THIS WINDOW</div>
                </div>
              ) : rows.map((e, i) => (
                <div key={i} className="grid grid-cols-12 gap-sm p-sm border-b-2 border-outline-variant items-center hover:bg-surface-container-high transition-colors">
                  <div className="col-span-2 md:col-span-1 font-label-caps text-on-surface">{fmtTime(e.time)}</div>
                  <div className="col-span-2 md:col-span-1 flex justify-center">
                    <div className={`w-3 h-3 border-2 ${IMPACT_STYLE[e.impact] || IMPACT_STYLE.low}`} title={`${e.impact} impact`} />
                  </div>
                  <div className="col-span-8 md:col-span-5 font-body-bold text-primary truncate">
                    <span className="font-label-caps text-label-caps text-on-surface-variant mr-xs">{e.country}</span>
                    {e.event}
                  </div>
                  <div className="col-span-4 md:col-span-1 text-right font-headline-md text-headline-md text-on-surface hidden md:block">{fmtVal(e.actual, e.unit)}</div>
                  <div className="col-span-4 md:col-span-2 text-right font-headline-md text-headline-md text-on-surface-variant hidden md:block">{fmtVal(e.estimate, e.unit)}</div>
                  <div className="col-span-4 md:col-span-2 text-right font-headline-md text-headline-md text-on-surface-variant hidden md:block">{fmtVal(e.previous, e.unit)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
