import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, ColorType, LineStyle } from 'lightweight-charts';

const API = 'http://127.0.0.1:8000';
const TFS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

// ─── Zone primitive — draws OB / FVG boxes directly on chart ──
class ZonePrimitive {
  constructor() {
    this._zones  = [];
    this._chart  = null;
    this._series = null;
    this._view   = new ZonePaneView(this);
  }

  attached({ chart, series }) {
    this._chart  = chart;
    this._series = series;
  }

  detached() {
    this._chart  = null;
    this._series = null;
  }

  setZones(zones) {
    this._zones = zones;
  }

  paneViews() {
    return [this._view];
  }

  updateAllViews() {}
}

class ZonePaneView {
  constructor(p) { this._p = p; }
  renderer() { return new ZoneRenderer(this._p); }
}

class ZoneRenderer {
  constructor(p) { this._p = p; }

  draw(target) {
    const { _chart: chart, _series: series, _zones: zones } = this._p;
    if (!chart || !series || !zones.length) return;

    const ts = chart.timeScale();

    target.useBitmapCoordinateSpace(
      ({ context: ctx, bitmapSize, horizontalPixelRatio, verticalPixelRatio }) => {
        for (const z of zones) {
          const x1 = ts.timeToCoordinate(z.time);
          const y1 = series.priceToCoordinate(z.high);
          const y2 = series.priceToCoordinate(z.low);

          if (x1 == null || y1 == null || y2 == null) continue;

          const bx1 = Math.max(0, x1 * horizontalPixelRatio);
          const bx2 = bitmapSize.width;
          const by1 = Math.min(y1, y2) * verticalPixelRatio;
          const bh  = Math.abs(y2 - y1) * verticalPixelRatio;

          if (bh < 1 || bx2 <= bx1) continue;

          ctx.fillStyle   = z.fillColor;
          ctx.fillRect(bx1, by1, bx2 - bx1, bh);

          ctx.strokeStyle = z.borderColor;
          ctx.lineWidth   = horizontalPixelRatio;
          ctx.strokeRect(bx1, by1, bx2 - bx1, bh);
        }
      }
    );
  }
}

// ─── React component ──────────────────────────────────────────
export default function Chart({ symbol, patterns }) {
  const containerRef  = useRef(null);
  const chartRef      = useRef(null);
  const seriesRef     = useRef(null);
  const zoneRef       = useRef(null);
  const priceLinesRef = useRef([]);
  const [tf, setTf]           = useState('H1');
  const [loading, setLoading] = useState(false);

  // ── Init chart once ──────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d0d16' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: '#1a1a28' },
        horzLines: { color: '#1a1a28' },
      },
      crosshair: {
        vertLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
        horzLine: { color: '#334155', labelBackgroundColor: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: '#1e1e2e',
      },
      timeScale: {
        borderColor: '#1e1e2e',
        timeVisible: true,
        secondsVisible: false,
      },
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:        '#22c55e',
      downColor:      '#ef4444',
      borderUpColor:  '#22c55e',
      borderDownColor:'#ef4444',
      wickUpColor:    '#22c55e',
      wickDownColor:  '#ef4444',
    });

    const zonePrimitive = new ZonePrimitive();
    series.attachPrimitive(zonePrimitive);

    chartRef.current  = chart;
    seriesRef.current = series;
    zoneRef.current   = zonePrimitive;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.resize(
          containerRef.current.clientWidth,
          containerRef.current.clientHeight,
        );
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      seriesRef.current = null;
      zoneRef.current   = null;
    };
  }, []);

  // ── Clear overlays when symbol changes ────────────────────
  useEffect(() => {
    zoneRef.current?.setZones([]);
    priceLinesRef.current.forEach(pl => {
      try { seriesRef.current?.removePriceLine(pl); } catch {}
    });
    priceLinesRef.current = [];
  }, [symbol]);

  // ── Fetch candles on symbol / TF change ──────────────────
  const fetchCandles = useCallback(async () => {
    if (!symbol || !seriesRef.current) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/candles/${symbol}/${tf}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length && seriesRef.current) {
        seriesRef.current.setData(data);
        chartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      console.error('[Chart] candle fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [symbol, tf]);

  useEffect(() => {
    fetchCandles();
    const id = setInterval(fetchCandles, 60_000);
    return () => clearInterval(id);
  }, [fetchCandles]);

  // ── Update overlays when pattern data arrives ─────────────
  useEffect(() => {
    if (!seriesRef.current || !zoneRef.current) return;

    const tfData = patterns?.[tf];

    // Clear old price lines
    priceLinesRef.current.forEach(pl => {
      try { seriesRef.current.removePriceLine(pl); } catch {}
    });
    priceLinesRef.current = [];

    if (!tfData) {
      zoneRef.current.setZones([]);
      chartRef.current?.applyOptions({});
      return;
    }

    // Build zone list from OBs and FVGs
    const zones = [];

    (tfData.order_blocks || []).forEach(ob => {
      const t = parseTime(ob.time);
      if (!t) return;
      zones.push({
        time:        t,
        high:        ob.high,
        low:         ob.low,
        fillColor:   ob.direction === 'BULLISH'
          ? 'rgba(34,197,94,0.10)'
          : 'rgba(239,68,68,0.10)',
        borderColor: ob.direction === 'BULLISH'
          ? 'rgba(34,197,94,0.55)'
          : 'rgba(239,68,68,0.55)',
      });
    });

    (tfData.fvgs || []).forEach(fvg => {
      const t = parseTime(fvg.time);
      if (!t) return;
      zones.push({
        time:        t,
        high:        fvg.high,
        low:         fvg.low,
        fillColor:   fvg.direction === 'BULLISH'
          ? 'rgba(59,130,246,0.08)'
          : 'rgba(139,92,246,0.08)',
        borderColor: fvg.direction === 'BULLISH'
          ? 'rgba(59,130,246,0.50)'
          : 'rgba(139,92,246,0.50)',
      });
    });

    zoneRef.current.setZones(zones);

    // BOS/MSS as horizontal price lines
    (tfData.bos_mss || []).forEach(bos => {
      const color = bos.direction === 'BULLISH' ? '#22c55e' : '#ef4444';
      const pl = seriesRef.current.createPriceLine({
        price:              bos.level,
        color,
        lineWidth:          1,
        lineStyle:          LineStyle.Dashed,
        axisLabelVisible:   true,
        title:              `BOS ${bos.direction.slice(0, 4)}`,
      });
      priceLinesRef.current.push(pl);
    });

    // Trigger redraw
    chartRef.current?.applyOptions({});
  }, [patterns, tf]);

  return (
    <div className="chart-wrapper">
      <div className="chart-toolbar">
        {TFS.map(t => (
          <button
            key={t}
            className={`tf-btn ${tf === t ? 'active' : ''}`}
            onClick={() => setTf(t)}
          >
            {t}
          </button>
        ))}
        {loading && <span className="chart-loading">Loading…</span>}
        <div className="chart-legend">
          <span className="legend-ob-bull">OB Bull</span>
          <span className="legend-ob-bear">OB Bear</span>
          <span className="legend-fvg-bull">FVG Bull</span>
          <span className="legend-fvg-bear">FVG Bear</span>
          <span className="legend-bos">BOS</span>
        </div>
      </div>
      <div className="chart-container" ref={containerRef} />
    </div>
  );
}

function parseTime(str) {
  if (!str) return null;
  const ms = Date.parse(str.replace(' ', 'T'));
  if (isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}
