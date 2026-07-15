// Flattens the per-timeframe SMC pattern payload (order blocks, FVGs, BOS/MSS)
// broadcast by the backend into a single recency-sorted event feed.
export function recentSmcEvents(patterns, limit = 12) {
  if (!patterns) return [];
  const events = [];
  for (const [tf, tfData] of Object.entries(patterns)) {
    for (const b of tfData?.bos_mss ?? [])
      events.push({ tf, kind: 'BOS', direction: b.direction, price: b.level, time: b.time });
    for (const f of tfData?.fvgs ?? [])
      events.push({ tf, kind: 'FVG', direction: f.direction, price: (f.high + f.low) / 2, time: f.time });
    for (const o of tfData?.order_blocks ?? [])
      events.push({ tf, kind: 'OB', direction: o.direction, price: (o.high + o.low) / 2, time: o.time });
  }
  events.sort((a, b) => new Date(b.time) - new Date(a.time));
  return events.slice(0, limit);
}

export function dirClass(direction) {
  return direction === 'BULLISH' ? 'text-primary-fixed-dim' : direction === 'BEARISH' ? 'text-error' : 'text-on-surface-variant';
}

export function fmtClock(iso) {
  if (!iso) return '--:--:--';
  const d = new Date(iso);
  if (isNaN(d)) return '--:--:--';
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

// Tally bullish vs. bearish direction across every detected structure/timeframe
// for the active symbol — a simple, honestly-computed "structure bias" split.
export function structureBias(patterns) {
  let bull = 0, bear = 0;
  if (patterns) {
    for (const tfData of Object.values(patterns)) {
      for (const arr of [tfData?.bos_mss, tfData?.fvgs, tfData?.order_blocks]) {
        for (const e of arr ?? []) {
          if (e.direction === 'BULLISH') bull++;
          else if (e.direction === 'BEARISH') bear++;
        }
      }
    }
  }
  const total = bull + bear;
  if (!total) return { bullPct: 0, bearPct: 0, total: 0 };
  const bullPct = Math.round((bull / total) * 100);
  return { bullPct, bearPct: 100 - bullPct, total };
}
