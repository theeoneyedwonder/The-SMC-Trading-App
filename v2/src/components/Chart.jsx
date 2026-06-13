import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, ColorType, LineStyle } from 'lightweight-charts';
import { useTheme } from '../contexts/ThemeContext';

const API = 'http://127.0.0.1:8000';
const TFS = ['M1','M5','M15','M30','H1','H4','D1'];

// ── Zone primitive (OB / FVG overlay) ────────────────────────────
class ZonePrimitive {
  constructor() { this._zones=[]; this._view=new ZonePaneView(this); }
  attached({ chart, series }) { this._chart=chart; this._series=series; }
  detached() { this._chart=null; this._series=null; }
  setZones(z) { this._zones=z; }
  paneViews() { return [this._view]; }
  updateAllViews() {}
}
class ZonePaneView {
  constructor(p) { this._p=p; }
  renderer() { return new ZoneRenderer(this._p); }
}
class ZoneRenderer {
  constructor(p) { this._p=p; }
  draw(target) {
    const { _chart:c, _series:s, _zones:zones } = this._p;
    if (!c || !s || !zones.length) return;
    const ts = c.timeScale();
    target.useBitmapCoordinateSpace(({ context:ctx, bitmapSize, horizontalPixelRatio:hpr, verticalPixelRatio:vpr }) => {
      for (const z of zones) {
        const x1=ts.timeToCoordinate(z.time), y1=s.priceToCoordinate(z.high), y2=s.priceToCoordinate(z.low);
        if (x1==null||y1==null||y2==null) continue;
        const bx1=Math.max(0,x1*hpr), bx2=bitmapSize.width;
        const by1=Math.min(y1,y2)*vpr, bh=Math.abs(y2-y1)*vpr;
        if (bh<1||bx2<=bx1) continue;
        ctx.fillStyle=z.fillColor; ctx.fillRect(bx1,by1,bx2-bx1,bh);
        ctx.strokeStyle=z.borderColor; ctx.lineWidth=hpr;
        ctx.strokeRect(bx1,by1,bx2-bx1,bh);
      }
    });
  }
}

// ── Drawing helpers ───────────────────────────────────────────────
const TOOLS = [
  { id:'cursor',    label:'Select',      icon:'↖' },
  { id:'hline',     label:'H-Line',      icon:'—' },
  { id:'trendline', label:'Trend Line',  icon:'╱' },
  { id:'rect',      label:'Rectangle',   icon:'▭' },
  { id:'fib',       label:'Fibonacci',   icon:'Φ' },
  { id:'eraser',    label:'Eraser',      icon:'⌦' },
];

function drawColor() { return localStorage.getItem('draw_color') || '#818cf8'; }
function drawWidth() { return Number(localStorage.getItem('draw_width') || 2); }
function drawFillOpacity() { return Number(localStorage.getItem('draw_fill_opacity') || 15); }
function uid() { return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }

function renderDrawings(canvas, chart, series, drawings, active, aiLevels) {
  if (!canvas || !chart || !series) return;
  const ctx  = canvas.getContext('2d');
  const W    = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const all = active ? [...drawings, active] : drawings;

  for (const d of all) {
    ctx.save();
    ctx.strokeStyle = d.color || '#818cf8';
    ctx.lineWidth   = d.width || 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    if (d.type === 'hline') {
      const y = series.priceToCoordinate(d.price);
      if (y == null) { ctx.restore(); continue; }
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      // label
      ctx.font = '11px monospace';
      ctx.fillStyle = d.color || '#818cf8';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(Number(d.price).toFixed(d.price > 100 ? 2 : 5), W - 72, y - 3);

    } else if (d.type === 'trendline') {
      const x1=chart.timeScale().timeToCoordinate(d.p1.time), y1=series.priceToCoordinate(d.p1.price);
      const x2=chart.timeScale().timeToCoordinate(d.p2.time), y2=series.priceToCoordinate(d.p2.price);
      if (x1==null||y1==null||x2==null||y2==null) { ctx.restore(); continue; }
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      // end dots
      [[ x1,y1],[x2,y2]].forEach(([cx,cy]) => {
        ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2);
        ctx.fillStyle=d.color||'#818cf8'; ctx.fill();
      });

    } else if (d.type === 'rect') {
      const x1=chart.timeScale().timeToCoordinate(d.p1.time), y1=series.priceToCoordinate(d.p1.price);
      const x2=chart.timeScale().timeToCoordinate(d.p2.time), y2=series.priceToCoordinate(d.p2.price);
      if (x1==null||y1==null||x2==null||y2==null) { ctx.restore(); continue; }
      const rx=Math.min(x1,x2), ry=Math.min(y1,y2), rw=Math.abs(x2-x1), rh=Math.abs(y2-y1);
      const op = drawFillOpacity();
      ctx.fillStyle = (d.color||'#818cf8') + Math.round(op*2.55).toString(16).padStart(2,'0');
      ctx.setLineDash([]);
      ctx.fillRect(rx,ry,rw,rh); ctx.strokeRect(rx,ry,rw,rh);

    } else if (d.type === 'fib') {
      const x1=chart.timeScale().timeToCoordinate(d.p1.time), y1=series.priceToCoordinate(d.p1.price);
      const x2=chart.timeScale().timeToCoordinate(d.p2.time), y2=series.priceToCoordinate(d.p2.price);
      if (x1==null||y1==null||x2==null||y2==null) { ctx.restore(); continue; }
      const levels = [[0,'#6b7299'],[0.236,'#3b82f6'],[0.382,'#a78bfa'],[0.5,'#818cf8'],[0.618,'#34d399'],[0.786,'#fbbf24'],[1,'#fb7185']];
      const priceRange = d.p1.price - d.p2.price;
      const lx = Math.min(x1,x2), rx2 = Math.max(x1,x2);
      for (const [lvl, col] of levels) {
        const price = d.p2.price + priceRange * lvl;
        const fy = series.priceToCoordinate(price);
        if (fy == null) continue;
        ctx.strokeStyle = col; ctx.lineWidth = d.id === 'active' ? 1 : (lvl===0.618||lvl===0.5?2:1);
        ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(lx,fy); ctx.lineTo(rx2,fy); ctx.stroke();
        ctx.fillStyle = col; ctx.font = '10px monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(`${(lvl*100).toFixed(1)}%  ${price.toFixed(price>100?2:5)}`, lx+4, fy-2);
      }
    }

    ctx.restore();
  }

  // AI key levels (dashed, labeled)
  if (aiLevels?.length) {
    for (const lvl of aiLevels) {
      const y = series.priceToCoordinate(lvl.price);
      if (y == null) continue;
      const col = lvl.type === 'support' ? '#34d399'
                : lvl.type === 'target'  ? '#fbbf24'
                : '#fb7185';
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.65;
      ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = '10px Aptos, Segoe UI, system-ui, sans-serif';
      ctx.fillStyle = col;
      ctx.textAlign = 'left';
      ctx.fillText(`◈ ${lvl.label}`, 8, y - 4);
      ctx.textAlign = 'right';
      ctx.fillText(Number(lvl.price).toFixed(lvl.price > 100 ? 2 : 5), W - 76, y - 4);
      ctx.restore();
    }
  }
}

function isHit(d, mx, my, chart, series, thr=10) {
  if (d.type === 'hline') {
    const y=series.priceToCoordinate(d.price);
    return y!=null && Math.abs(my-y)<thr;
  }
  if (d.type === 'trendline') {
    const x1=chart.timeScale().timeToCoordinate(d.p1.time), y1=series.priceToCoordinate(d.p1.price);
    const x2=chart.timeScale().timeToCoordinate(d.p2.time), y2=series.priceToCoordinate(d.p2.price);
    if (x1==null||y1==null||x2==null||y2==null) return false;
    const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy;
    if (!len2) return Math.hypot(mx-x1,my-y1)<thr;
    const t=Math.max(0,Math.min(1,((mx-x1)*dx+(my-y1)*dy)/len2));
    return Math.hypot(mx-x1-t*dx, my-y1-t*dy)<thr;
  }
  if (d.type === 'rect' || d.type === 'fib') {
    const x1=chart.timeScale().timeToCoordinate(d.p1.time), y1=series.priceToCoordinate(d.p1.price);
    const x2=chart.timeScale().timeToCoordinate(d.p2.time), y2=series.priceToCoordinate(d.p2.price);
    if (x1==null||y1==null||x2==null||y2==null) return false;
    return mx>=Math.min(x1,x2)&&mx<=Math.max(x1,x2)&&my>=Math.min(y1,y2)&&my<=Math.max(y1,y2);
  }
  return false;
}

function parseTime(str) {
  if (!str) return null;
  const ms = Date.parse(str.replace(' ','T'));
  return isNaN(ms) ? null : Math.floor(ms/1000);
}

// ── Chart component ───────────────────────────────────────────────
export default function Chart({ symbol, patterns, aiLevels }) {
  const containerRef  = useRef(null);
  const chartRef      = useRef(null);
  const seriesRef     = useRef(null);
  const zoneRef       = useRef(null);
  const overlayRef    = useRef(null);
  const priceLinesRef = useRef([]);
  const { vars } = useTheme();

  const [tf, setTf]           = useState('H1');
  const [loading, setLoading] = useState(false);
  const [tool, setTool]       = useState('cursor');

  const [drawings, setDrawings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`drawings_${symbol}`) || '[]'); } catch { return []; }
  });
  const [activeDraw, setActive] = useState(null);

  const drawingsRef    = useRef(drawings);
  const activeRef      = useRef(activeDraw);
  const toolRef        = useRef(tool);
  const mouseStartRef  = useRef(null);
  const syncOverlayRef = useRef(null);
  const aiLevelsRef    = useRef([]);

  useEffect(() => { drawingsRef.current = drawings; },    [drawings]);
  useEffect(() => { activeRef.current   = activeDraw; },  [activeDraw]);
  useEffect(() => { toolRef.current     = tool; },        [tool]);
  useEffect(() => { aiLevelsRef.current = aiLevels ?? []; }, [aiLevels]);

  // Persist drawings per symbol
  useEffect(() => { localStorage.setItem(`drawings_${symbol}`, JSON.stringify(drawings)); }, [drawings, symbol]);

  // Reload drawings when symbol changes
  useEffect(() => {
    try { setDrawings(JSON.parse(localStorage.getItem(`drawings_${symbol}`) || '[]')); }
    catch { setDrawings([]); }
  }, [symbol]);

  // ── Chart init ────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const v = vars;
    const chart = createChart(containerRef.current, {
      layout:    { background: { type: ColorType.Solid, color: v['--chart-bg'] || '#08081a' }, textColor: v['--muted'] || '#6b7299' },
      grid:      { vertLines: { color: v['--surf2'] || '#101022' }, horzLines: { color: v['--surf2'] || '#101022' } },
      crosshair: { vertLine: { color: v['--border2'] || '#22223c', labelBackgroundColor: v['--surf3'] || '#141430' },
                   horzLine: { color: v['--border2'] || '#22223c', labelBackgroundColor: v['--surf3'] || '#141430' } },
      rightPriceScale: { borderColor: v['--border'] || '#1a1a30' },
      timeScale:       { borderColor: v['--border'] || '#1a1a30', timeVisible: true, secondsVisible: false },
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const up   = v['--candle-up']   || '#34d399';
    const down = v['--candle-down'] || '#fb7185';
    const series = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down,
      borderUpColor: up, borderDownColor: down,
      wickUpColor: up, wickDownColor: down,
    });

    const zone = new ZonePrimitive();
    series.attachPrimitive(zone);
    chartRef.current = chart; seriesRef.current = series; zoneRef.current = zone;

    const syncOverlay = () => {
      if (overlayRef.current && containerRef.current) {
        overlayRef.current.width  = containerRef.current.clientWidth;
        overlayRef.current.height = containerRef.current.clientHeight;
      }
    };
    syncOverlay();
    syncOverlayRef.current = syncOverlay;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.resize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        syncOverlay();
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect(); chart.remove();
      chartRef.current = null; seriesRef.current = null; zoneRef.current = null;
    };
  }, []);  // eslint-disable-line

  // ── Re-apply chart colours when theme changes ─────────────────
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    const up   = vars['--candle-up']   || '#34d399';
    const down = vars['--candle-down'] || '#fb7185';
    chartRef.current.applyOptions({
      layout:    { background: { type: ColorType.Solid, color: vars['--chart-bg'] || '#08081a' }, textColor: vars['--muted'] || '#6b7299' },
      grid:      { vertLines: { color: vars['--surf2'] || '#101022' }, horzLines: { color: vars['--surf2'] || '#101022' } },
      rightPriceScale: { borderColor: vars['--border'] || '#1a1a30' },
      timeScale:       { borderColor: vars['--border'] || '#1a1a30' },
    });
    seriesRef.current.applyOptions({
      upColor: up, downColor: down, borderUpColor: up, borderDownColor: down,
      wickUpColor: up, wickDownColor: down,
    });
  }, [vars]);

  // ── RAF render loop for drawing overlay ───────────────────────
  useEffect(() => {
    let id;
    const loop = () => {
      renderDrawings(overlayRef.current, chartRef.current, seriesRef.current, drawingsRef.current, activeRef.current, aiLevelsRef.current);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Symbol change: clear zones / price lines ──────────────────
  useEffect(() => {
    zoneRef.current?.setZones([]);
    priceLinesRef.current.forEach(pl => { try { seriesRef.current?.removePriceLine(pl); } catch {} });
    priceLinesRef.current = [];
  }, [symbol]);

  // ── Candle fetch ──────────────────────────────────────────────
  const fetchCandles = useCallback(async () => {
    if (!symbol || !seriesRef.current) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/candles/${symbol}/${tf}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length && seriesRef.current) {
        seriesRef.current.setData(data);
        chartRef.current?.timeScale().fitContent();
        syncOverlayRef.current?.();
      }
    } catch {}
    finally { setLoading(false); }
  }, [symbol, tf]);

  useEffect(() => {
    fetchCandles();
    const id = setInterval(fetchCandles, 60_000);
    return () => clearInterval(id);
  }, [fetchCandles]);

  // ── Patterns (OB / FVG / BOS) ────────────────────────────────
  useEffect(() => {
    if (!seriesRef.current || !zoneRef.current) return;
    const tfData = patterns?.[tf];
    priceLinesRef.current.forEach(pl => { try { seriesRef.current.removePriceLine(pl); } catch {} });
    priceLinesRef.current = [];
    if (!tfData) { zoneRef.current.setZones([]); return; }

    const zones = [];
    (tfData.order_blocks||[]).forEach(ob => {
      const t = parseTime(ob.time); if (!t) return;
      zones.push({ time:t, high:ob.high, low:ob.low,
        fillColor:   ob.direction==='BULLISH'?'rgba(52,211,153,.09)':'rgba(251,113,133,.09)',
        borderColor: ob.direction==='BULLISH'?'rgba(52,211,153,.5)':'rgba(251,113,133,.5)' });
    });
    (tfData.fvgs||[]).forEach(fvg => {
      const t = parseTime(fvg.time); if (!t) return;
      zones.push({ time:t, high:fvg.high, low:fvg.low,
        fillColor:   fvg.direction==='BULLISH'?'rgba(96,165,250,.07)':'rgba(167,139,250,.07)',
        borderColor: fvg.direction==='BULLISH'?'rgba(96,165,250,.45)':'rgba(167,139,250,.45)' });
    });
    zoneRef.current.setZones(zones);

    (tfData.bos_mss||[]).forEach(bos => {
      const pl = seriesRef.current.createPriceLine({
        price: bos.level, lineWidth:1, lineStyle:LineStyle.Dashed,
        color: bos.direction==='BULLISH'?'#34d399':'#fb7185',
        axisLabelVisible:true, title:`BOS ${bos.direction.slice(0,4)}`,
      });
      priceLinesRef.current.push(pl);
    });
    chartRef.current?.applyOptions({});
  }, [patterns, tf]);

  // ── Mouse events for drawing ──────────────────────────────────
  const getChartCoords = useCallback((clientX, clientY) => {
    if (!overlayRef.current || !chartRef.current || !seriesRef.current) return null;
    const rect  = overlayRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const time  = chartRef.current.timeScale().coordinateToTime(x);
    const price = seriesRef.current.coordinateToPrice(y);
    return (time != null && price != null) ? { x, y, time, price } : null;
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const t = toolRef.current;
    if (t === 'cursor' || t === 'eraser') return;
    const pt = getChartCoords(e.clientX, e.clientY);
    if (!pt) return;
    mouseStartRef.current = pt;

    if (t === 'hline') {
      setDrawings(prev => [...prev, { id: uid(), type:'hline', price: pt.price, color: drawColor(), width: drawWidth() }]);
      mouseStartRef.current = null;
    } else {
      const draft = { id:'active', type:t, p1:{ time:pt.time, price:pt.price }, p2:{ time:pt.time, price:pt.price }, color:drawColor(), width:drawWidth() };
      activeRef.current = draft;
      setActive(draft);
    }
  }, [getChartCoords]);

  const handleMouseMove = useCallback((e) => {
    if (!mouseStartRef.current || !activeRef.current) return;
    const pt = getChartCoords(e.clientX, e.clientY);
    if (!pt) return;
    setActive(prev => {
      const next = prev ? { ...prev, p2:{ time:pt.time, price:pt.price } } : null;
      activeRef.current = next;
      return next;
    });
  }, [getChartCoords]);

  const handleMouseUp = useCallback(() => {
    const active = activeRef.current;
    if (active) {
      const same = active.p1.time === active.p2.time && active.p1.price === active.p2.price;
      if (!same) setDrawings(prev => [...prev, { ...active, id: uid() }]);
    }
    activeRef.current = null;
    setActive(null);
    mouseStartRef.current = null;
  }, []);

  const handleClick = useCallback((e) => {
    if (toolRef.current !== 'eraser') return;
    const pt = getChartCoords(e.clientX, e.clientY);
    if (!pt) return;
    setDrawings(prev => {
      const idx = prev.findIndex(d => isHit(d, pt.x, pt.y, chartRef.current, seriesRef.current));
      if (idx < 0) return prev;
      const next = [...prev]; next.splice(idx, 1); return next;
    });
  }, [getChartCoords]);

  const cursorStyle = { cursor: tool === 'cursor' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair' };

  return (
    <>
      <div className="chart-toolbar">
        <div className="tf-group">
          {TFS.map(t => (
            <button key={t} className={`tf-btn${tf===t?' active':''}`} onClick={() => setTf(t)}>{t}</button>
          ))}
        </div>

        <div className="chart-toolbar-sep" />

        <div className="draw-group">
          {TOOLS.map(({ id, label, icon }) => (
            <button key={id} title={label} className={`draw-btn${tool===id?' active':''}`} onClick={() => setTool(id)}>
              {icon}
            </button>
          ))}
          {drawings.length > 0 && (
            <button className="draw-btn clear-btn" title="Clear all drawings" onClick={() => setDrawings([])}>
              ✕
            </button>
          )}
        </div>

        {loading && <span className="chart-status">Loading...</span>}

        <div className="chart-legend">
          <span className="legend-item"><span className="legend-dot" style={{background:'rgba(52,211,153,.5)'}}/> OB Bull</span>
          <span className="legend-item"><span className="legend-dot" style={{background:'rgba(251,113,133,.5)'}}/> OB Bear</span>
          <span className="legend-item"><span className="legend-dot" style={{background:'rgba(96,165,250,.5)'}}/> FVG</span>
          <span className="legend-item" style={{color:'var(--muted)'}}>-- BOS</span>
        </div>
      </div>

      <div style={{ position:'relative', flex:1, minHeight:0 }}>
        <div ref={containerRef} style={{ position:'absolute', inset:0 }} />
        <canvas
          ref={overlayRef}
          style={{ position:'absolute', inset:0, zIndex:2, pointerEvents: tool==='cursor' ? 'none' : 'all', ...cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </>
  );
}
