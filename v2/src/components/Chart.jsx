import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, ColorType, LineStyle } from 'lightweight-charts';
import { useTheme } from '../contexts/ThemeContext';

const API = 'http://127.0.0.1:8000';
const TFS = ['M1','M5','M15','M30','H1','H4','D1'];
const TF_SECONDS = { M1:60, M5:300, M15:900, M30:1800, H1:3600, H4:14400, D1:86400, W1:604800 };

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

// ── MT5-style Trade Panel ─────────────────────────────────────────
function splitPrice(p) {
  if (!p || !isFinite(p)) return { main: '—', pips: '' };
  let s;
  if (p >= 100)     s = p.toFixed(2);
  else if (p >= 10) s = p.toFixed(3);
  else              s = p.toFixed(5);
  return { main: s.slice(0, -2), pips: s.slice(-2) };
}

function TradePanel({ symbol, tick }) {
  const [lot, setLot]         = useState('0.01');
  const [trading, setTrading] = useState(null);
  const [result, setResult]   = useState(null);

  const executeTrade = async (side) => {
    const lotNum = parseFloat(lot);
    if (!isFinite(lotNum) || lotNum < 0.01) {
      setResult({ ok: false, msg: 'Enter a lot size of at least 0.01' });
      setTimeout(() => setResult(null), 4000);
      return;
    }
    setTrading(side); setResult(null);
    try {
      const r = await fetch(`${API}/trade/market`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, lot: lotNum, type: side }),
      });
      const d = await r.json();
      setResult(r.ok ? { ok: true, msg: `#${d.ticket} filled @ ${d.price}` }
                     : { ok: false, msg: d.detail || 'Trade failed' });
    } catch { setResult({ ok: false, msg: 'Connection error' }); }
    setTrading(null);
    setTimeout(() => setResult(null), 4000);
  };

  const bid = splitPrice(tick?.bid);
  const ask = splitPrice(tick?.ask);

  return (
    <div className="trade-panel">
      <div className="trade-panel-row">
        <button className="trade-btn sell" onClick={() => executeTrade('SELL')} disabled={!!trading}>
          {trading === 'SELL' ? '…' : 'SELL'}
        </button>
        <input
          className="lot-input"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          value={lot}
          onChange={e => setLot(e.target.value)}
          title="Lot size — use the arrows to step by 0.01"
        />
        <button className="trade-btn buy" onClick={() => executeTrade('BUY')} disabled={!!trading}>
          {trading === 'BUY' ? '…' : 'BUY'}
        </button>
      </div>
      <div className="trade-prices-row">
        <div className="trade-price sell-side">
          <span className="tp-main">{bid.main}</span><span className="tp-pips">{bid.pips}</span>
        </div>
        <div className="trade-price buy-side">
          <span className="tp-main">{ask.main}</span><span className="tp-pips">{ask.pips}</span>
        </div>
      </div>
      {result && (
        <div className={`trade-result ${result.ok ? 'ok' : 'err'}`}>{result.msg}</div>
      )}
    </div>
  );
}

// ── Chart component ───────────────────────────────────────────────
export default function Chart({ symbol, patterns, aiLevels }) {
  const containerRef  = useRef(null);
  const chartRef      = useRef(null);
  const seriesRef     = useRef(null);
  const zoneRef       = useRef(null);
  const overlayRef    = useRef(null);
  const priceLinesRef  = useRef([]);
  const lastPriceRef   = useRef(null);
  const priceLineRef   = useRef(null);
  const liveBarRef     = useRef(null);
  const lastTickRef    = useRef(0);
  const marketOpenRef  = useRef(true);
  const tfSecRef       = useRef(TF_SECONDS['H1']);  // kept in sync below via tf effect
  const { vars } = useTheme();

  const [tf, setTf]           = useState('H1');
  const [loading, setLoading] = useState(false);
  const [tool, setTool]       = useState('cursor');
  const [lastPrice, setLastPrice] = useState(null);

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
  const allCandlesRef  = useRef([]);
  const loadingMoreRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [chartReady,  setChartReady]  = useState(false);
  const [marketOpen,  setMarketOpen]  = useState(true);
  const [liveTick,    setLiveTick]    = useState(null);

  useEffect(() => { drawingsRef.current = drawings; },             [drawings]);
  useEffect(() => { activeRef.current   = activeDraw; },           [activeDraw]);
  useEffect(() => { toolRef.current     = tool; },                  [tool]);
  useEffect(() => { aiLevelsRef.current = aiLevels ?? []; },        [aiLevels]);
  useEffect(() => { tfSecRef.current    = TF_SECONDS[tf] ?? 3600; }, [tf]);

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

    priceLineRef.current = series.createPriceLine({
      price: 0,
      color: 'rgba(129, 140, 248, 0.9)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '',
    });

    setChartReady(true);

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
      priceLineRef.current = null;
      setChartReady(false);
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

  // ── Symbol / tf change: clear zones / price lines / live bar ──
  useEffect(() => {
    liveBarRef.current = null;
    zoneRef.current?.setZones([]);
    priceLinesRef.current.forEach(pl => { try { seriesRef.current?.removePriceLine(pl); } catch {} });
    priceLinesRef.current = [];
  }, [symbol, tf]);

  // ── Candle fetch ──────────────────────────────────────────────
  const fetchCandles = useCallback(async () => {
    if (!symbol || !seriesRef.current) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/candles/${symbol}/${tf}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length && seriesRef.current) {
        allCandlesRef.current = data;
        liveBarRef.current = null;                          // clear before setData to avoid race
        seriesRef.current.setData(data);
        liveBarRef.current = { ...data[data.length - 1] }; // seed live bar from latest candle
        lastPriceRef.current = data[data.length - 1].close;
        setLastPrice(data[data.length - 1].close);
        chartRef.current?.timeScale().fitContent();
        syncOverlayRef.current?.();
      }
    } catch {}
    finally { setLoading(false); }
  }, [symbol, tf]);

  useEffect(() => {
    fetchCandles();
    const id = setInterval(fetchCandles, 5 * 60_000); // safety sync every 5 min; live ticks handle intrabar
    return () => clearInterval(id);
  }, [fetchCandles]);

  const loadMoreCandles = useCallback(async () => {
    if (loadingMoreRef.current || !seriesRef.current) return;
    const current = allCandlesRef.current;
    if (!current.length) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API}/candles/${symbol}/${tf}?offset=${current.length}`);
      const older = await res.json();
      if (Array.isArray(older) && older.length) {
        const existingTimes = new Set(current.map(c => c.time));
        const fresh = older.filter(c => !existingTimes.has(c.time));
        if (fresh.length) {
          const merged = [...fresh, ...current].sort((a, b) => a.time - b.time);
          allCandlesRef.current = merged;
          seriesRef.current.setData(merged);
        }
      }
    } catch {}
    finally { loadingMoreRef.current = false; setLoadingMore(false); }
  }, [symbol, tf]);

  useEffect(() => {
    if (!chartReady || !chartRef.current) return;
    const handler = (range) => { if (range && range.from < 10) loadMoreCandles(); };
    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      try { chartRef.current?.timeScale()?.unsubscribeVisibleLogicalRangeChange(handler); } catch {}
    };
  }, [chartReady, loadMoreCandles]);

  // ── WebSocket tick stream — push-based, as fast as MT5 delivers ─
  useEffect(() => {
    if (!symbol) return;
    let ws = null;
    let reconnectTimer = null;
    let cancelled = false;

    const connectWs = () => {
      if (cancelled) return;
      try { ws = new WebSocket(`ws://127.0.0.1:8000/ws/ticks/${symbol}`); }
      catch { if (!cancelled) reconnectTimer = setTimeout(connectWs, 1000); return; }

      ws.onmessage = (e) => {
        try {
          const t = JSON.parse(e.data);
          if (!t.bid || !t.ask) return;

          const price   = (t.bid + t.ask) / 2;
          const barTime = Math.floor(t.time / tfSecRef.current) * tfSecRef.current;
          lastTickRef.current = Date.now();

          if (!marketOpenRef.current) { marketOpenRef.current = true; setMarketOpen(true); }

          if (seriesRef.current) {
            const prev = liveBarRef.current;
            if (!prev || barTime >= prev.time) {
              const bar = (prev && prev.time === barTime)
                ? { time: barTime, open: prev.open, high: Math.max(prev.high, price), low: Math.min(prev.low, price), close: price }
                : { time: barTime, open: price, high: price, low: price, close: price };
              liveBarRef.current = bar;
              seriesRef.current.update(bar);
            }
            priceLineRef.current?.applyOptions({ price });
          }

          setLiveTick(t);
        } catch {}
      };

      ws.onclose  = () => { if (!cancelled) reconnectTimer = setTimeout(connectWs, 1000); };
      ws.onerror  = () => ws.close();
    };

    connectWs();
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
    };
  }, [symbol]);

  // ── Market-closed detector ────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (lastTickRef.current > 0 && Date.now() - lastTickRef.current > 30_000 && marketOpenRef.current) {
        marketOpenRef.current = false;
        setMarketOpen(false);
      }
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  // ── Structural patterns are no longer auto-drawn ──────────────
  // OB / FVG / BOS used to be painted directly onto the chart, which made it
  // look cluttered. The backend still DETECTS them and feeds them to Sage (the
  // AI Companion); Sage curates a clean, reasonable set of levels on demand
  // (rendered via `aiLevels`). Here we just make sure no stale structural
  // zones / price lines remain on screen.
  useEffect(() => {
    if (!seriesRef.current || !zoneRef.current) return;
    const toRemove = priceLinesRef.current;
    priceLinesRef.current = [];
    toRemove.forEach(pl => { try { seriesRef.current.removePriceLine(pl); } catch {} });
    zoneRef.current.setZones([]);
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
        <div className="chart-symbol">{symbol}</div>

        <div className="chart-toolbar-sep" />

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
        {loadingMore && <span className="chart-status">◂ Loading history…</span>}

        <div className="chart-legend">
          {aiLevels?.length > 0
            ? <span className="legend-item" style={{color:'var(--indigo)'}}>◈ Sage levels</span>
            : <span className="legend-item" style={{color:'var(--muted)'}}>Run Sage analysis to mark key levels</span>}
        </div>
      </div>

      <div style={{ position:'relative', flex:1, minHeight:0 }}>
        <div ref={containerRef} style={{ position:'absolute', inset:0 }} />
        <TradePanel symbol={symbol} tick={liveTick} />
        <div className={`market-status${marketOpen ? ' open' : ' closed'}`}>
          <span className="market-dot" />
          {marketOpen ? 'LIVE' : 'MARKET CLOSED'}
        </div>
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
