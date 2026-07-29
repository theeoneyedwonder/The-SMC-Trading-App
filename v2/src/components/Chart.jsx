import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, ColorType, LineStyle } from 'lightweight-charts';
import { useTheme } from '../contexts/ThemeContext';
import MarketSourcePicker from './MarketSourcePicker';

const API = 'http://127.0.0.1:8000';
const TFS = ['M1','M5','M15','M30','H1','H4','D1','W1','MN1'];
const TF_LABELS = { M1:'1m', M5:'5m', M15:'15m', M30:'30m', H1:'1h', H4:'4h', D1:'D', W1:'W', MN1:'M' };
const TF_SECONDS = { M1:60, M5:300, M15:900, M30:1800, H1:3600, H4:14400, D1:86400, W1:604800, MN1:2592000 };
const INITIAL_BAR_LIMIT = 1000;
const MAX_CACHED_BARS = 50000;
const candleCache = new Map();

function candleKey(provider, symbol, timeframe) {
  return `${provider}::${symbol}::${timeframe}`;
}

function compatiblePrices(left, right) {
  if (!(left > 0) || !(right > 0)) return false;
  const ratio = left / right;
  return ratio >= 0.25 && ratio <= 4;
}

function barBucketTime(timestamp, timeframe) {
  if (timeframe === 'W1') {
    const mondayEpoch = 4 * 86400;
    return Math.floor((timestamp - mondayEpoch) / 604800) * 604800 + mondayEpoch;
  }
  if (timeframe === 'MN1') {
    const value = new Date(timestamp * 1000);
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1) / 1000;
  }
  const seconds = TF_SECONDS[timeframe] ?? 3600;
  return Math.floor(timestamp / seconds) * seconds;
}

function validateCandlePage(payload, expectedProvider, expectedSymbol, expectedTf) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.bars)) {
    throw new Error('Market-data provider returned a malformed response');
  }
  if (payload.provider !== expectedProvider) {
    throw new Error(`Rejected ${payload.provider || 'unidentified'} provider data`);
  }
  if (payload.requested_symbol !== expectedSymbol) {
    throw new Error(`Rejected stale ${payload.requested_symbol || 'unknown'} data`);
  }
  if (Number(payload.timeframe_minutes) !== TF_SECONDS[expectedTf] / 60) {
    throw new Error(`Rejected stale ${expectedTf} timeframe data`);
  }
  if (!payload.symbol || typeof payload.symbol !== 'string') {
    throw new Error('Market-data provider did not identify its symbol');
  }

  let previousTime = 0;
  let previousClose = null;
  const bars = payload.bars.map((raw) => {
    const bar = {
      time: Number(raw.time), open: Number(raw.open), high: Number(raw.high),
      low: Number(raw.low), close: Number(raw.close), volume: Number(raw.volume || 0),
    };
    if (!Object.values(bar).every(Number.isFinite) || bar.time <= previousTime ||
        bar.open <= 0 || bar.high <= 0 || bar.low <= 0 || bar.close <= 0 ||
        bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close) ||
        bar.high < bar.low) {
      throw new Error('Rejected invalid or unordered OHLC history');
    }
    if (previousClose != null && !compatiblePrices(bar.close, previousClose)) {
      throw new Error('Rejected mixed price regimes in candle history');
    }
    previousTime = bar.time;
    previousClose = bar.close;
    return bar;
  });
  return { ...payload, bars };
}

async function readJsonResponse(response) {
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    throw new Error(payload?.detail || `Market-data request failed (${response.status})`);
  }
  return payload;
}

function retryDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Request aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function fetchCandlePage(url, signal) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal });
      return await readJsonResponse(response);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      lastError = error;
      if (attempt < 2) await retryDelay(250 * (attempt + 1), signal);
    }
  }
  throw lastError || new Error('Market-data request failed');
}

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
  { id:'cursor',    label:'Select',             icon:'cursor' },
  { id:'trendline', label:'Trend line',         icon:'trendline' },
  { id:'rect',      label:'Rectangle',          icon:'rectangle' },
  { id:'hline',     label:'Horizontal line',    icon:'hline' },
  { id:'fib',       label:'Fibonacci retrace',  icon:'fib' },
  { id:'eraser',    label:'Erase drawing',      icon:'eraser' },
];

function ChartIcon({ name, size = 18 }) {
  const common = { width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.6, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true };
  const shapes = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    cursor: <><path d="M6 3l11 9-5 .8-2.8 4.4L6 3z" /></>,
    trendline: <><path d="M5 18L19 5" /><circle cx="5" cy="18" r="1.5" /><circle cx="19" cy="5" r="1.5" /></>,
    rectangle: <><rect x="5" y="5" width="14" height="14" /><circle cx="5" cy="5" r="1" fill="currentColor" /><circle cx="19" cy="5" r="1" fill="currentColor" /><circle cx="5" cy="19" r="1" fill="currentColor" /><circle cx="19" cy="19" r="1" fill="currentColor" /></>,
    hline: <><path d="M3 12h18" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /></>,
    fib: <><path d="M4 5h16M4 9h16M4 14h16M4 19h16" /><path d="M7 3v18M17 3v18" strokeDasharray="2 2" /></>,
    eraser: <><path d="M7.2 18.5h10.4M5.3 13.8l7.7-8a2 2 0 012.8 0l2.3 2.2a2 2 0 010 2.8l-7.4 7.7H8.4l-3.1-3a1.2 1.2 0 010-1.7z" /><path d="M10 9l5 5" /></>,
    trash: <><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>,
    candle: <><path d="M8 3v4M8 15v6M5.5 7h5v8h-5zM16 3v7M16 18v3M13.5 10h5v8h-5z" /></>,
    indicators: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /><path d="M3 7l6-4 6 6 6-5" /></>,
    alert: <><circle cx="12" cy="13" r="7" /><path d="M12 9v4l3 2M5 4L3 6M19 4l2 2" /></>,
    replay: <><path d="M7 7H3v-4M4 7a9 9 0 11-1 8" /><path d="M10 9l6 4-6 4z" /></>,
    undo: <><path d="M9 7L4 12l5 5M5 12h8a6 6 0 016 6" /></>,
    redo: <><path d="M15 7l5 5-5 5M19 12h-8a6 6 0 00-6 6" /></>,
    camera: <><path d="M4 7h4l1.5-2h5L16 7h4v12H4z" /><circle cx="12" cy="13" r="4" /></>,
    fullscreen: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></>,
    chevron: <><path d="M8 10l4 4 4-4" /></>,
  };
  return <svg {...common}>{shapes[name] || shapes.cursor}</svg>;
}

function drawColor() { return localStorage.getItem('draw_color') || '#d4ff3f'; }
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
    ctx.strokeStyle = d.color || '#d4ff3f';
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
      ctx.fillStyle = d.color || '#d4ff3f';
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
        ctx.fillStyle=d.color||'#d4ff3f'; ctx.fill();
      });

    } else if (d.type === 'rect') {
      const x1=chart.timeScale().timeToCoordinate(d.p1.time), y1=series.priceToCoordinate(d.p1.price);
      const x2=chart.timeScale().timeToCoordinate(d.p2.time), y2=series.priceToCoordinate(d.p2.price);
      if (x1==null||y1==null||x2==null||y2==null) { ctx.restore(); continue; }
      const rx=Math.min(x1,x2), ry=Math.min(y1,y2), rw=Math.abs(x2-x1), rh=Math.abs(y2-y1);
      const op = drawFillOpacity();
      ctx.fillStyle = (d.color||'#d4ff3f') + Math.round(op*2.55).toString(16).padStart(2,'0');
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

// Creates the "last price" dashed line lazily, seeded with a real price the
// first time one is available. Never seed it with a placeholder like 0 —
// Lightweight Charts factors price lines into the initial autoscale range,
// so a 0 -> realPrice jump bakes in a 0..realPrice Y-axis that never
// recovers, squashing all real candles into a sliver near the top.
function ensurePriceLine(ref, series, price) {
  if (!series) return;
  if (ref.current) {
    ref.current.applyOptions({ price });
  } else {
    ref.current = series.createPriceLine({
      price,
      color: 'rgba(129, 140, 248, 0.9)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: '',
    });
  }
}

// ── Chart component ───────────────────────────────────────────────
// (The order ticket used to float here as an overlay; it now lives as the
// full right-hand Order Execution Panel in Home.jsx, matching the mockup's
// dedicated ticket column instead of a floating widget over the chart.)
export default function Chart({
  provider,
  symbol,
  providers,
  executionProvider,
  patterns,
  aiLevels,
  onChangeMarket,
  onOpenMarketSettings,
  onOpenAlerts,
}) {
  const containerRef  = useRef(null);
  const chartAreaRef  = useRef(null);
  const paletteRef    = useRef(null);
  const chartRef      = useRef(null);
  const seriesRef     = useRef(null);
  const zoneRef       = useRef(null);
  const overlayRef    = useRef(null);
  const priceLinesRef  = useRef([]);
  const lastPriceRef   = useRef(null);
  const priceLineRef   = useRef(null);
  const liveBarRef     = useRef(null);
  const lastTickRef    = useRef(0);
  const wsRef          = useRef(null);
  const connectedAtRef = useRef(0);
  const marketOpenRef  = useRef(true);
  const { vars } = useTheme();

  const [tf, setTf]           = useState('H1');
  const [loading, setLoading] = useState(false);
  const [tool, setTool]       = useState('cursor');

  const [drawings, setDrawings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`drawings_${provider}_${symbol}`) || '[]'); } catch { return []; }
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
  const requestGenerationRef = useRef(0);
  const initialAbortRef = useRef(null);
  const historyAbortRef = useRef(null);
  const datasetKeyRef = useRef('');
  const historyRef = useRef({ nextBefore: null, hasMore: false });
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const paletteDragRef = useRef(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [chartReady,  setChartReady]  = useState(false);
  const [marketOpen,  setMarketOpen]  = useState(true);
  const [feedConnected, setFeedConnected] = useState(true);
  const [feedSymbol, setFeedSymbol] = useState(null);
  const [chartError, setChartError] = useState('');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [palettePosition, setPalettePosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('qc_chart_tool_position') || 'null');
      if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) return saved;
    } catch {}
    return { x: 16, y: 16 };
  });

  useEffect(() => { drawingsRef.current = drawings; },             [drawings]);
  useEffect(() => { activeRef.current   = activeDraw; },           [activeDraw]);
  useEffect(() => { toolRef.current     = tool; },                  [tool]);
  useEffect(() => { aiLevelsRef.current = aiLevels ?? []; },        [aiLevels]);

  const syncHistoryState = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const commitDrawings = useCallback((change) => {
    setDrawings(previous => {
      const next = typeof change === 'function' ? change(previous) : change;
      if (next === previous) return previous;
      undoStackRef.current = [...undoStackRef.current.slice(-99), previous];
      redoStackRef.current = [];
      queueMicrotask(syncHistoryState);
      return next;
    });
  }, [syncHistoryState]);

  const undoDrawing = useCallback(() => {
    setDrawings(current => {
      const previous = undoStackRef.current.pop();
      if (!previous) return current;
      redoStackRef.current = [...redoStackRef.current.slice(-99), current];
      queueMicrotask(syncHistoryState);
      return previous;
    });
  }, [syncHistoryState]);

  const redoDrawing = useCallback(() => {
    setDrawings(current => {
      const next = redoStackRef.current.pop();
      if (!next) return current;
      undoStackRef.current = [...undoStackRef.current.slice(-99), current];
      queueMicrotask(syncHistoryState);
      return next;
    });
  }, [syncHistoryState]);

  // Persist drawings per symbol
  useEffect(() => { localStorage.setItem(`drawings_${provider}_${symbol}`, JSON.stringify(drawings)); }, [drawings, provider, symbol]);

  // Reload drawings when symbol changes
  useEffect(() => {
    try { setDrawings(JSON.parse(localStorage.getItem(`drawings_${provider}_${symbol}`) || '[]')); }
    catch { setDrawings([]); }
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistoryState();
  }, [provider, symbol, syncHistoryState]);

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

    // priceLineRef is intentionally NOT created here — see ensurePriceLine().
    // Creating it now with a placeholder price would corrupt autoscale.

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
    lastTickRef.current = 0;
    zoneRef.current?.setZones([]);
    priceLinesRef.current.forEach(pl => { try { seriesRef.current?.removePriceLine(pl); } catch {} });
    priceLinesRef.current = [];
    if (priceLineRef.current) {
      try { seriesRef.current?.removePriceLine(priceLineRef.current); } catch {}
      priceLineRef.current = null;
    }
    marketOpenRef.current = true;
    setMarketOpen(true);
  }, [provider, symbol, tf]);

  // ── Initial candle page ───────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !symbol || !seriesRef.current) return undefined;

    const generation = ++requestGenerationRef.current;
    const key = candleKey(provider, symbol, tf);
    const controller = new AbortController();
    initialAbortRef.current?.abort();
    historyAbortRef.current?.abort();
    initialAbortRef.current = controller;
    datasetKeyRef.current = key;
    allCandlesRef.current = [];
    historyRef.current = { nextBefore: null, hasMore: false };
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setFeedSymbol(null);
    setChartError('');
    setLoading(true);
    seriesRef.current.setData([]);

    const applyPage = (page, preserveRange = false) => {
      if (generation !== requestGenerationRef.current || datasetKeyRef.current !== key || !seriesRef.current) return;
      if (!page.bars.length) throw new Error(`No ${tf} history is available for ${symbol}`);
      const oldRange = preserveRange ? chartRef.current?.timeScale().getVisibleRange() : null;
      allCandlesRef.current = page.bars;
      historyRef.current = { nextBefore: page.next_before, hasMore: !!page.has_more };
      liveBarRef.current = { ...page.bars[page.bars.length - 1] };
      const close = liveBarRef.current.close;
      lastPriceRef.current = close;
      seriesRef.current.setData(page.bars);
      ensurePriceLine(priceLineRef, seriesRef.current, close);
      setFeedSymbol(page.symbol);
      if (oldRange) {
        chartRef.current?.timeScale().setVisibleRange(oldRange);
      } else {
        const length = page.bars.length;
        chartRef.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, length - 180), to: length + 5 });
      }
      syncOverlayRef.current?.();
    };

    const cached = candleCache.get(key);
    if (cached?.bars?.length) applyPage(cached);

    (async () => {
      try {
        const payload = await fetchCandlePage(
          `${API}/market/bars/${encodeURIComponent(provider)}/${encodeURIComponent(symbol)}/${tf}?limit=${INITIAL_BAR_LIMIT}`,
          controller.signal,
        );
        let page = validateCandlePage(payload, provider, symbol, tf);
        if (generation !== requestGenerationRef.current || datasetKeyRef.current !== key) return;
        if (cached?.bars?.length) {
          const byTime = new Map(cached.bars.map(bar => [bar.time, bar]));
          page.bars.forEach(bar => byTime.set(bar.time, bar));
          const merged = [...byTime.values()].sort((a, b) => a.time - b.time).slice(-MAX_CACHED_BARS);
          if (merged.every((bar, index) => index === 0 || compatiblePrices(bar.close, merged[index - 1].close))) {
            page = {
              ...page,
              bars: merged,
              next_before: cached.next_before ?? page.next_before,
              has_more: cached.has_more ?? page.has_more,
            };
          }
        }
        candleCache.set(key, page);
        applyPage(page, !!cached?.bars?.length);
      } catch (error) {
        if (error.name !== 'AbortError' && generation === requestGenerationRef.current) {
          setChartError(error.message || 'Unable to load chart history');
        }
      } finally {
        if (generation === requestGenerationRef.current) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [chartReady, provider, symbol, tf]);

  const loadMoreCandles = useCallback(async () => {
    if (loadingMoreRef.current || !seriesRef.current || !historyRef.current.hasMore) return;
    const current = allCandlesRef.current;
    const before = historyRef.current.nextBefore;
    if (!current.length || !before) return;
    if (current.length >= MAX_CACHED_BARS) {
      historyRef.current.hasMore = false;
      setChartError(`Local history limit reached (${MAX_CACHED_BARS.toLocaleString()} bars)`);
      return;
    }
    const generation = requestGenerationRef.current;
    const key = candleKey(provider, symbol, tf);
    const controller = new AbortController();
    historyAbortRef.current?.abort();
    historyAbortRef.current = controller;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const payload = await fetchCandlePage(
        `${API}/market/bars/${encodeURIComponent(provider)}/${encodeURIComponent(symbol)}/${tf}?limit=${INITIAL_BAR_LIMIT}&before=${before}`,
        controller.signal,
      );
      const page = validateCandlePage(payload, provider, symbol, tf);
      if (generation !== requestGenerationRef.current || datasetKeyRef.current !== key || !seriesRef.current) return;

      const firstCurrentTime = current[0].time;
      const fresh = page.bars.filter(bar => bar.time < firstCurrentTime);
      if (fresh.length) {
        if (!compatiblePrices(fresh[fresh.length - 1].close, current[0].open)) {
          throw new Error('Rejected incompatible historical price regime');
        }
        const visibleRange = chartRef.current?.timeScale().getVisibleRange();
        const available = MAX_CACHED_BARS - current.length;
        const accepted = fresh.slice(-available);
        const merged = [...accepted, ...current];
        allCandlesRef.current = merged;
        seriesRef.current.setData(merged);
        if (visibleRange) chartRef.current?.timeScale().setVisibleRange(visibleRange);
        const atLimit = merged.length >= MAX_CACHED_BARS;
        const nextBefore = accepted[0]?.time ?? page.next_before;
        const cachePage = { ...page, bars: merged, next_before: nextBefore, has_more: page.has_more && !atLimit };
        candleCache.set(key, cachePage);
      } else if (page.has_more) {
        throw new Error('History provider returned a non-advancing cursor');
      }
      const reachedLimit = allCandlesRef.current.length >= MAX_CACHED_BARS;
      historyRef.current = {
        nextBefore: allCandlesRef.current[0]?.time ?? page.next_before,
        hasMore: !!page.has_more && fresh.length > 0 && !reachedLimit,
      };
      setChartError('');
    } catch (error) {
      if (error.name !== 'AbortError' && generation === requestGenerationRef.current) {
        historyRef.current.hasMore = false;
        setChartError(error.message || 'Unable to load older history');
      }
    } finally {
      if (generation === requestGenerationRef.current) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  }, [provider, symbol, tf]);

  useEffect(() => {
    if (!chartReady || !chartRef.current) return;
    const handler = (range) => { if (range && range.from < 30) loadMoreCandles(); };
    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      try { chartRef.current?.timeScale()?.unsubscribeVisibleLogicalRangeChange(handler); } catch {}
    };
  }, [chartReady, loadMoreCandles]);

  // ── WebSocket tick stream — push-based, as fast as MT5 delivers ─
  useEffect(() => {
    if (!feedSymbol) return undefined;
    let ws = null;
    let reconnectTimer = null;
    let cancelled = false;
    const generation = requestGenerationRef.current;
    const expectedKey = candleKey(provider, symbol, tf);

    const connectWs = () => {
      if (cancelled) return;
      const socketPath = provider === 'oanda'
        ? `/ws/market/oanda/${encodeURIComponent(feedSymbol)}`
        : `/ws/ticks/${encodeURIComponent(feedSymbol)}`;
      try { ws = new WebSocket(`ws://127.0.0.1:8000${socketPath}`); }
      catch { if (!cancelled) reconnectTimer = setTimeout(connectWs, 1000); return; }
      wsRef.current = ws;

      ws.onopen = () => { connectedAtRef.current = Date.now(); setFeedConnected(true); };

      ws.onmessage = (e) => {
        try {
          const t = JSON.parse(e.data);
          if (cancelled || generation !== requestGenerationRef.current || datasetKeyRef.current !== expectedKey) return;
          if (t.type === 'error') {
            setChartError(t.detail || `${provider.toUpperCase()} price stream failed`);
            return;
          }
          if (t.provider !== provider || !t.bid || !t.ask || t.symbol !== feedSymbol) return;

          const price   = (t.bid + t.ask) / 2;
          const barTime = barBucketTime(t.time, tf);
          const reference = liveBarRef.current?.close ?? lastPriceRef.current;
          if (reference && !compatiblePrices(price, reference)) {
            setChartError(`Rejected incompatible live price for ${feedSymbol}`);
            return;
          }
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
              const candles = allCandlesRef.current;
              if (candles.length) {
                const last = candles[candles.length - 1];
                allCandlesRef.current = last.time === bar.time
                  ? [...candles.slice(0, -1), bar]
                  : bar.time > last.time ? [...candles, bar] : candles;
              }
              lastPriceRef.current = price;
            }
            ensurePriceLine(priceLineRef, seriesRef.current, price);
          }
        } catch {}
      };

      ws.onclose  = () => { setFeedConnected(false); if (!cancelled) reconnectTimer = setTimeout(connectWs, 1000); };
      ws.onerror  = () => ws.close();
    };

    connectWs();

    // Staleness watchdog: a "zombie" connection (laptop sleep/wake, NAT
    // timeout, network blip) can go quiet forever without ever firing
    // onclose/onerror — nothing else would recover it. If we haven't heard
    // anything in a while, force-close the socket ourselves; the onclose
    // handler above then reconnects through the normal path. Harmless if
    // the market is just genuinely quiet — it reconnects and waits again.
    const STALE_MS = 25_000;
    const GRACE_MS = 25_000; // don't judge a freshly (re)connected socket too early
    const watchdog = setInterval(() => {
      if (cancelled || !wsRef.current) return;
      const now = Date.now();
      if (now - connectedAtRef.current > GRACE_MS && now - lastTickRef.current > STALE_MS) {
        try { wsRef.current.close(); } catch {}
      }
    }, 10_000);

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      clearInterval(watchdog);
      try { ws?.close(); } catch {}
    };
  }, [feedSymbol, provider, symbol, tf]);

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

  // ── Provider connection status — so a stalled feed can say WHY ─
  // Ticks going quiet is ambiguous on its own: it could be a genuinely
  // closed market (benign) or MT5/the broker actually dropping (a real
  // problem). Polling /health lets the badge tell those apart instead of
  // labelling both "MARKET CLOSED".
  useEffect(() => {
    let live = true;
    const poll = () => {
      const url = provider === 'oanda' ? `${API}/settings/market/oanda` : `${API}/health`;
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!live || !d) return;
          setFeedConnected(provider === 'oanda' ? !!d.configured : !!d.mt5_connected);
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => { live = false; clearInterval(id); };
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

  // ── Floating drawing palette ─────────────────────────────────
  const clampPalettePosition = useCallback((position) => {
    const area = chartAreaRef.current;
    const palette = paletteRef.current;
    if (!area || !palette) return position;
    const maxX = Math.max(8, area.clientWidth - palette.offsetWidth - 8);
    const maxY = Math.max(8, area.clientHeight - palette.offsetHeight - 8);
    return {
      x: Math.min(Math.max(8, position.x), maxX),
      y: Math.min(Math.max(8, position.y), maxY),
    };
  }, [provider]);

  const resetPalettePosition = useCallback(() => {
    const next = clampPalettePosition({ x: 16, y: 16 });
    setPalettePosition(next);
    localStorage.setItem('qc_chart_tool_position', JSON.stringify(next));
  }, [clampPalettePosition]);

  const handlePalettePointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    paletteDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: palettePosition,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [palettePosition]);

  useEffect(() => {
    const move = (event) => {
      const drag = paletteDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setPalettePosition(clampPalettePosition({
        x: drag.origin.x + event.clientX - drag.startX,
        y: drag.origin.y + event.clientY - drag.startY,
      }));
    };
    const finish = (event) => {
      const drag = paletteDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      paletteDragRef.current = null;
      setPalettePosition(current => {
        const next = clampPalettePosition(current);
        localStorage.setItem('qc_chart_tool_position', JSON.stringify(next));
        return next;
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [clampPalettePosition]);

  useEffect(() => {
    if (!chartAreaRef.current) return undefined;
    const observer = new ResizeObserver(() => {
      setPalettePosition(current => clampPalettePosition(current));
    });
    observer.observe(chartAreaRef.current);
    setPalettePosition(current => clampPalettePosition(current));
    return () => observer.disconnect();
  }, [chartReady, clampPalettePosition]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(document.fullscreenElement === chartAreaRef.current?.parentElement);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const workspace = chartAreaRef.current?.parentElement;
    if (!workspace) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await workspace.requestFullscreen();
    } catch {}
  }, []);

  const saveChartImage = useCallback(() => {
    if (!chartRef.current || !overlayRef.current) return;
    try {
      const chartCanvas = chartRef.current.takeScreenshot();
      const output = document.createElement('canvas');
      output.width = chartCanvas.width;
      output.height = chartCanvas.height;
      const context = output.getContext('2d');
      context.drawImage(chartCanvas, 0, 0);
      context.drawImage(overlayRef.current, 0, 0, output.width, output.height);
      const link = document.createElement('a');
      link.download = `${provider}-${symbol}-${tf}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      link.href = output.toDataURL('image/png');
      link.click();
    } catch {}
  }, [provider, symbol, tf]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoDrawing(); else undoDrawing();
      } else if (command && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoDrawing();
      } else if (event.key === 'Escape') {
        activeRef.current = null;
        mouseStartRef.current = null;
        setActive(null);
        setTool('cursor');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redoDrawing, undoDrawing]);

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
      commitDrawings(prev => [...prev, { id: uid(), type:'hline', price: pt.price, color: drawColor(), width: drawWidth() }]);
      mouseStartRef.current = null;
    } else {
      const draft = { id:'active', type:t, p1:{ time:pt.time, price:pt.price }, p2:{ time:pt.time, price:pt.price }, color:drawColor(), width:drawWidth() };
      activeRef.current = draft;
      setActive(draft);
    }
  }, [commitDrawings, getChartCoords]);

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
      if (!same) commitDrawings(prev => [...prev, { ...active, id: uid() }]);
    }
    activeRef.current = null;
    setActive(null);
    mouseStartRef.current = null;
  }, [commitDrawings]);

  const handleClick = useCallback((e) => {
    if (toolRef.current !== 'eraser') return;
    const pt = getChartCoords(e.clientX, e.clientY);
    if (!pt) return;
    commitDrawings(prev => {
      const idx = prev.findIndex(d => isHit(d, pt.x, pt.y, chartRef.current, seriesRef.current));
      if (idx < 0) return prev;
      const next = [...prev]; next.splice(idx, 1); return next;
    });
  }, [commitDrawings, getChartCoords]);

  const cursorStyle = { cursor: tool === 'cursor' ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair' };
  const statusLabel = provider === 'simulated'
    ? 'SIMULATED'
    : marketOpen && feedConnected
    ? `${provider.toUpperCase()} LIVE`
    : !feedConnected
    ? `${provider.toUpperCase()} DISCONNECTED`
    : 'MARKET CLOSED';

  return (
    <>
      <div className="qc-chart-commandbar">
        <MarketSourcePicker
          provider={provider}
          symbol={symbol}
          providers={providers}
          executionProvider={executionProvider}
          onChangeMarket={onChangeMarket}
          onOpenSettings={onOpenMarketSettings}
        />

        <div className="qc-chart-command-separator" />

        <div className="qc-chart-timeframes" aria-label="Chart timeframe">
          {TFS.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setTf(item)}
              className={'qc-chart-timeframe ' + (tf === item ? 'is-active' : '')}
              title={item}
              aria-pressed={tf === item}
            >
              {TF_LABELS[item]}
            </button>
          ))}
          <button className="qc-chart-icon-button is-muted" type="button" title="More timeframes" disabled>
            <ChartIcon name="chevron" size={15} />
          </button>
        </div>

        <div className="qc-chart-command-separator" />

        <button className="qc-chart-icon-button is-active" type="button" title="Candlestick chart" aria-label="Candlestick chart">
          <ChartIcon name="candle" size={19} />
        </button>
        <button className="qc-chart-action is-planned" type="button" title="Indicator manager — next analysis milestone" disabled>
          <ChartIcon name="indicators" size={18} />
          <span>Indicators</span>
        </button>

        <div className="qc-chart-command-separator" />

        <button className="qc-chart-action" type="button" title="Open alerts" onClick={onOpenAlerts} disabled={!onOpenAlerts}>
          <ChartIcon name="alert" size={18} />
          <span>Alert</span>
        </button>
        <button className="qc-chart-action is-planned" type="button" title="Market replay — planned" disabled>
          <ChartIcon name="replay" size={18} />
          <span>Replay</span>
        </button>

        <div className="qc-chart-command-separator" />

        <button className="qc-chart-icon-button" type="button" title="Undo drawing (Ctrl+Z)" onClick={undoDrawing} disabled={!canUndo}>
          <ChartIcon name="undo" size={17} />
        </button>
        <button className="qc-chart-icon-button" type="button" title="Redo drawing (Ctrl+Shift+Z)" onClick={redoDrawing} disabled={!canRedo}>
          <ChartIcon name="redo" size={17} />
        </button>

        <div className="qc-chart-command-spacer" />

        {(loading || loadingMore) && (
          <span className="qc-chart-loading"><span className="qc-chart-spinner" />{loadingMore ? 'History' : 'Loading'}</span>
        )}
        {chartError && (
          <span className="qc-chart-data-error" title={chartError}>Data: {chartError}</span>
        )}
        {aiLevels?.length > 0 && <span className="qc-chart-sage-state" title="Sage levels are visible">SAGE</span>}
        <span className={'qc-chart-live-state ' + (provider === 'simulated' ? 'is-simulated' : marketOpen && feedConnected ? 'is-live' : 'is-offline')} title={statusLabel}>
          <span />{statusLabel}
        </span>
        <button className="qc-chart-icon-button" type="button" title="Save chart image" onClick={saveChartImage}>
          <ChartIcon name="camera" size={18} />
        </button>
        <button className="qc-chart-icon-button" type="button" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen chart'} onClick={toggleFullscreen}>
          <ChartIcon name="fullscreen" size={18} />
        </button>
      </div>

      <div ref={chartAreaRef} className="qc-chart-stage relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0" />
        {chartError && allCandlesRef.current.length === 0 && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none">
            <div className="qc-chart-empty-error">
              <span>Market data unavailable</span>
              <small>{chartError}</small>
            </div>
          </div>
        )}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 z-[2]"
          style={{ pointerEvents: tool==='cursor' ? 'none' : 'all', ...cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          onMouseLeave={handleMouseUp}
        />

        <div
          ref={paletteRef}
          className={'qc-floating-tools ' + (paletteDragRef.current ? 'is-dragging' : '')}
          style={{ transform: `translate3d(${palettePosition.x}px, ${palettePosition.y}px, 0)` }}
          role="toolbar"
          aria-label="Drawing tools"
        >
          <button
            type="button"
            className="qc-tool-grip"
            title="Drag toolbar · double-click to reset"
            aria-label="Move drawing toolbar"
            onPointerDown={handlePalettePointerDown}
            onDoubleClick={resetPalettePosition}
          >
            <span /><span /><span /><span /><span /><span />
          </button>
          <div className="qc-tool-separator" />
          {TOOLS.map(item => (
            <button
              key={item.id}
              type="button"
              className={'qc-floating-tool-button ' + (tool === item.id ? 'is-active' : '')}
              title={item.label}
              aria-label={item.label}
              aria-pressed={tool === item.id}
              onClick={(event) => { event.stopPropagation(); setTool(item.id); }}
            >
              <ChartIcon name={item.icon} size={20} />
            </button>
          ))}
          <div className="qc-tool-separator" />
          <button
            type="button"
            className="qc-floating-tool-button is-danger"
            title="Clear all drawings"
            aria-label="Clear all drawings"
            disabled={drawings.length === 0}
            onClick={(event) => { event.stopPropagation(); commitDrawings([]); }}
          >
            <ChartIcon name="trash" size={19} />
          </button>
        </div>
      </div>
    </>
  );
}
