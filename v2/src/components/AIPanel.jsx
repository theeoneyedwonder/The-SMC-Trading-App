import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from './Button';
import { recentSmcEvents, dirClass, fmtClock } from '../lib/smcEvents';

const API = 'http://127.0.0.1:8000';

const SUGGESTIONS = [
  { label: 'Analyze the chart',         sub: 'Full SMC structure analysis',      action: 'analyze' },
  { label: 'What\'s the market bias?',  sub: 'Current directional sentiment',     action: 'chat' },
  { label: 'Key order blocks',          sub: 'Identify high-probability zones',   action: 'chat' },
  { label: 'Review my open trades',     sub: 'P&L, risk, and exposure summary',   action: 'chat' },
  { label: 'Next session watchlist',    sub: 'What to prepare for',               action: 'chat' },
  { label: 'Explain market structure',  sub: 'BOS, ChoCH, liquidity sweeps',      action: 'chat' },
];

// 4-pointed sparkle — the Sage mark
export function SageMark({ size = 20, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
      <path d="M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z" />
    </svg>
  );
}

function fmtNum(n, d = 2) {
  return n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function sageGreeting(name) {
  const h = new Date().getHours();
  const who = name ? `, ${String(name).split(' ')[0]}` : '';
  let pool;
  if      (h < 5)  pool = ['Still up? Markets never sleep.', 'Burning the midnight oil?'];
  else if (h < 8)  pool = ['Up early — hunting setups?', `Pre-market prep${who}?`];
  else if (h < 11) pool = [`Tea and trades${who}?`, "Morning. What's the plan today?"];
  else if (h < 14) pool = ["What's cooking on the markets today?", 'Midday check-in?'];
  else if (h < 17) pool = ["Afternoon — what's moving?", `How's the day shaping up${who}?`];
  else if (h < 21) pool = [`Evening${who}. How did the day trade?`, 'Reviewing the session?'];
  else             pool = ['Watching the Asia open?', 'Late one — what\'s on the radar?'];
  return pool[h % pool.length];
}

// Rich analysis card — shown inline in chat when /ai/analyze is called
function AnalysisCard({ data }) {
  const bullish = data.bias === 'bullish';
  const bearish = data.bias === 'bearish';
  const biasClass = bullish ? 'text-primary-fixed-dim border-primary-fixed-dim bg-primary-fixed/10'
                   : bearish ? 'text-error border-error bg-error/10'
                   : 'text-on-surface-variant border-outline-variant bg-surface-container-high';
  const barColor = bullish ? 'bg-primary-fixed-dim' : bearish ? 'bg-error' : 'bg-on-surface-variant';

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-sm flex-wrap">
        <span className={`font-label-caps text-label-caps px-sm py-xs border-2 ${biasClass}`}>
          {(data.bias ?? 'neutral').toUpperCase()}
        </span>
        <span className="font-label-caps text-label-caps text-on-surface-variant">{data.confidence ?? 0}% CONFIDENCE</span>
      </div>
      <div className="h-2 w-full bg-surface-variant border-2 border-outline-variant">
        <div className={`h-full ${barColor}`} style={{ width: `${data.confidence ?? 0}%` }} />
      </div>

      {data.reason && <p className="text-on-surface text-[13px] font-body-base leading-relaxed">{data.reason}</p>}

      {data.setup?.active && (
        <div className="bg-surface border-2 border-outline-variant p-sm">
          <div className="grid grid-cols-3 gap-xs mb-sm border-b-2 border-outline-variant pb-xs">
            <div>
              <div className="font-label-caps text-[9px] text-on-surface-variant">ENTRY</div>
              <div className="font-stat-lg text-[14px] text-primary">{data.setup.entry ?? '—'}</div>
            </div>
            <div>
              <div className="font-label-caps text-[9px] text-on-surface-variant">SL</div>
              <div className="font-stat-lg text-[14px] text-error">{data.setup.sl ?? '—'}</div>
            </div>
            <div>
              <div className="font-label-caps text-[9px] text-on-surface-variant">TP</div>
              <div className="font-stat-lg text-[14px] text-primary-fixed-dim">{data.setup.tp ?? '—'}</div>
            </div>
          </div>
          <div className="flex items-center gap-sm flex-wrap">
            <span className={`font-label-caps text-label-caps px-xs py-[2px] border-2 ${data.setup.direction === 'BUY' ? 'border-primary-fixed-dim text-primary-fixed-dim' : 'border-error text-error'}`}>
              {data.setup.direction}
            </span>
            {data.setup.rr != null && <span className="font-label-caps text-label-caps text-secondary">R:R {Number(data.setup.rr).toFixed(1)}</span>}
          </div>
        </div>
      )}

      {data.key_levels?.length > 0 && (
        <div className="flex flex-col gap-xs">
          <div className="font-label-caps text-label-caps text-on-surface-variant">KEY LEVELS · MARKED ON CHART</div>
          {data.key_levels.map((lvl, i) => (
            <div key={i} className="flex items-center gap-sm font-stat-lg text-[12px]">
              <span className={'w-2 h-2 shrink-0 ' + (lvl.type === 'support' ? 'bg-primary-fixed-dim' : lvl.type === 'resistance' ? 'bg-error' : 'bg-secondary')} />
              <span className="flex-1 text-on-surface-variant truncate">{lvl.label}</span>
              <span className="text-primary">{lvl.price}</span>
            </div>
          ))}
        </div>
      )}

      {data.summary && <p className="text-on-surface-variant text-[12px] font-body-base leading-relaxed border-t-2 border-outline-variant pt-sm">{data.summary}</p>}
    </div>
  );
}

// Strategy document upload panel — slides up above the input bar
function StrategySheet({ strategy, strategyName, onSave, onClear, onClose }) {
  const [draft, setDraft] = useState(strategy || '');
  const [name,  setName]  = useState(strategyName || '');
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setName(f.name);
    const reader = new FileReader();
    reader.onload = ev => setDraft(ev.target.result || '');
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <motion.div
      className="border-t-2 border-outline-variant bg-surface-container-low p-md flex flex-col gap-sm shrink-0"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center justify-between">
        <span className="font-label-caps text-label-caps text-secondary">STRATEGY DOCUMENT</span>
        <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors">
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
      <p className="font-body-base text-[12px] text-on-surface-variant">
        Upload or paste your trading strategy. Sage will use it in every analysis and chat.
      </p>
      <input ref={fileRef} type="file" accept=".txt,.md,.csv" className="hidden" onChange={handleFile} />
      <div className="flex gap-sm">
        <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>Upload File</Button>
        {strategy && <Button variant="danger" size="sm" onClick={() => { onClear(); onClose(); }}>Remove</Button>}
      </div>
      {name && <div className="font-label-caps text-label-caps text-secondary">DOCUMENT: {name}</div>}
      <textarea
        className="bg-[#141414] border-2 border-outline-variant p-sm text-[13px] text-on-surface font-body-base focus:outline-none focus:border-secondary transition-colors resize-none placeholder:text-on-surface-variant"
        placeholder="Or paste your strategy here — entry rules, exit criteria, risk management, preferred SMC setups…"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={5}
      />
      <Button variant="secondary" size="md" disabled={!draft.trim()} onClick={() => { onSave(draft, name); onClose(); }}>
        {strategy && strategy === draft ? 'Strategy Saved' : 'Save Strategy'}
      </Button>
    </motion.div>
  );
}

export default function AIPanel({ data, nudge, onClose, onAIAnalysis }) {
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [analyzing,     setAnalyzing]     = useState(false);
  const [strategy,      setStrategy]      = useState(() => localStorage.getItem('ai_strategy') || '');
  const [strategyName,  setStrategyName]  = useState(() => localStorage.getItem('ai_strategy_name') || '');
  const [strategyOpen,  setStrategyOpen]  = useState(false);

  const login     = data?.account?.login || 0;
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Restore conversation on login
  const historyLoadedRef = useRef(0);
  useEffect(() => {
    if (!login || historyLoadedRef.current === login) return;
    historyLoadedRef.current = login;
    (async () => {
      try {
        const r = await fetch(`${API}/ai/history?login=${login}`);
        if (!r.ok) return;
        const past = await r.json();
        if (Array.isArray(past) && past.length) setMessages(past);
      } catch {}
    })();
  }, [login]);

  // Proactive nudges: append live while the panel is open (it's already
  // persisted server-side, so if the panel were closed it'd just show up
  // next time history loads).
  const lastNudgeIdRef = useRef(null);
  useEffect(() => {
    if (!nudge || nudge.id === lastNudgeIdRef.current) return;
    lastNudgeIdRef.current = nudge.id;
    setMessages(prev => [...prev, { role: 'assistant', content: nudge.text, time: new Date().toISOString() }]);
  }, [nudge]);

  const clearChat = async () => {
    setMessages([]);
    try { await fetch(`${API}/ai/clear?login=${login}`, { method: 'POST' }); } catch {}
  };

  const saveStrategy = (text, name) => {
    setStrategy(text);
    setStrategyName(name);
    localStorage.setItem('ai_strategy', text);
    localStorage.setItem('ai_strategy_name', name);
  };

  const clearStrategy = () => {
    setStrategy('');
    setStrategyName('');
    localStorage.removeItem('ai_strategy');
    localStorage.removeItem('ai_strategy_name');
  };

  const runAnalysis = async () => {
    if (analyzing || loading) return;
    setAnalyzing(true);
    setStrategyOpen(false);
    setMessages(prev => [...prev, {
      role: 'user',
      content: 'Analyze the chart and identify key trade setups.',
      time: new Date().toISOString(),
    }]);
    try {
      const r = await fetch(`${API}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: data ?? {}, strategy }),
      });
      const d = await r.json();
      if (r.ok) {
        onAIAnalysis?.(d.key_levels ?? []);
        setMessages(prev => [...prev, { role: 'analysis', data: d, time: new Date().toISOString() }]);
      } else {
        setMessages(prev => [...prev, { role: 'error', content: d.detail || 'Analysis failed.', time: new Date().toISOString() }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Could not reach the backend.', time: new Date().toISOString() }]);
    }
    setAnalyzing(false);
  };

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading || analyzing) return;
    setInput('');
    setStrategyOpen(false);
    setMessages(prev => [
      ...prev,
      { role: 'user', content: msg, time: new Date().toISOString() },
      { role: 'assistant', content: '', streaming: true, time: new Date().toISOString() },
    ]);
    setLoading(true);

    const replaceLast = (next) => setMessages(prev => {
      const copy = [...prev];
      copy[copy.length - 1] = typeof next === 'function' ? next(copy[copy.length - 1]) : next;
      return copy;
    });

    try {
      const r = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: data ?? {}, strategy }),
      });

      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        replaceLast({ role: 'error', content: d.detail || 'Something went wrong.', time: new Date().toISOString() });
        setLoading(false);
        return;
      }

      const reader  = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done   = false;

      while (!done) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;

          let evt;
          try { evt = JSON.parse(payload); } catch { continue; }

          if (evt.delta) {
            replaceLast(last => ({ ...last, role: 'assistant', content: (last.content || '') + evt.delta }));
          } else if (evt.error) {
            replaceLast({ role: 'error', content: evt.error, time: new Date().toISOString() });
            done = true;
            break;
          } else if (evt.done) {
            replaceLast(last => ({ ...last, streaming: false }));
            done = true;
            break;
          }
        }
      }
    } catch {
      replaceLast({ role: 'error', content: 'Could not reach the backend.', time: new Date().toISOString() });
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSuggestion = (s) => {
    if (s.action === 'analyze') runAnalysis();
    else send(s.label);
  };

  const busy        = loading || analyzing;
  const hasMessages = messages.length > 0 || busy;
  const acct        = data?.account;
  const events      = recentSmcEvents(data?.patterns);

  return (
    <div className="flex-1 h-full flex gap-md p-md overflow-hidden min-h-0">

      {/* ── LEFT: Sage Terminal ── */}
      <section className="flex-[2] flex flex-col glass-panel module-glow-secondary relative overflow-hidden min-w-0 border-secondary/30">

        {/* Header */}
        <div className="p-sm border-b border-white/10 flex justify-between items-center shrink-0 gap-sm flex-wrap bg-white/[0.02]">
          <div className="flex items-center gap-sm">
            <div className="w-7 h-7 border-2 border-secondary text-secondary glow-secondary flex items-center justify-center bg-secondary/10 shrink-0">
              <SageMark size={14} />
            </div>
            <div>
              <h3 className="font-headline-md text-headline-md text-secondary glow-text-secondary leading-none">SAGE_TERMINAL</h3>
              <p className="font-label-caps text-label-caps text-on-surface-variant mt-1 tracking-widest">SMART MONEY ANALYST</p>
            </div>
          </div>
          <div className="flex items-center gap-sm">
            {acct && (
              <div className="hidden md:flex items-center gap-xs font-label-caps text-label-caps text-on-surface-variant border-r-2 border-outline-variant pr-sm mr-xs">
                <span className="text-primary">{data?.symbol ?? '—'}</span>
                <span>·</span>
                <span>{acct.currency} {fmtNum(acct.balance)}</span>
              </div>
            )}
            <span className="font-label-caps text-label-caps px-sm py-xs bg-surface-container border-2 border-outline-variant text-primary-fixed-dim shrink-0">
              STATUS: ONLINE
            </span>
            <button
              onClick={onClose}
              title="Close Sage"
              className="w-7 h-7 flex items-center justify-center border-2 border-outline-variant text-on-surface-variant hover:text-error hover:border-error transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>

        {/* Memory bar */}
        {hasMessages && (
          <div className="px-md py-xs border-b border-white/10 bg-secondary/5 flex items-center justify-between shrink-0">
            <span className="font-label-caps text-label-caps text-secondary flex items-center gap-xs">
              <span className="material-symbols-outlined text-[12px]">check_circle</span>
              MEMORY: CONVERSATION SAVED
            </span>
            <button onClick={clearChat} className="font-label-caps text-label-caps text-on-surface-variant hover:text-error transition-colors">
              CLEAR
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-md flex flex-col gap-md font-stat-lg text-body-base min-h-0">
          {!hasMessages ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-lg text-center p-lg">
              <div className="w-14 h-14 border-2 border-secondary text-secondary glow-secondary flex items-center justify-center bg-secondary/10">
                <SageMark size={28} />
              </div>
              <div className="font-headline-md text-headline-md text-on-surface max-w-[360px]">{sageGreeting(acct?.name)}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm w-full max-w-[560px]">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestion(s)}
                    className="flex flex-col items-start gap-xs p-sm border-2 border-outline-variant bg-surface-container hover:border-secondary hover:bg-secondary/5 transition-colors text-left"
                  >
                    <span className="font-body-bold text-body-bold text-primary">{s.label}</span>
                    <span className="font-label-caps text-label-caps text-on-surface-variant">{s.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => {
                const time = fmtClock(m.time);

                if (m.role === 'analysis') {
                  return (
                    <div key={i} className="flex flex-col gap-xs max-w-[85%]">
                      <div className="font-label-caps text-label-caps text-on-surface-variant">SAGE_AI // {time}</div>
                      <div className="bg-[#141414] border-2 border-secondary p-sm hover:bg-surface-container-high transition-colors">
                        <AnalysisCard data={m.data} />
                      </div>
                    </div>
                  );
                }

                if (m.role === 'assistant' && m.streaming && !m.content) {
                  return (
                    <div key={i} className="flex flex-col gap-xs max-w-[85%]">
                      <div className="font-label-caps text-label-caps text-on-surface-variant">SAGE_AI // {time}</div>
                      <div className="bg-surface border-2 border-outline-variant p-sm flex gap-1 items-center w-fit">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '120ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce" style={{ animationDelay: '240ms' }} />
                      </div>
                    </div>
                  );
                }

                if (m.role === 'user') {
                  return (
                    <div key={i} className="flex flex-col gap-xs max-w-[85%] self-end items-end">
                      <div className="font-label-caps text-label-caps text-on-surface-variant">USER // {time}</div>
                      <div className="bg-surface-container-high border-2 border-primary-fixed-dim p-sm text-primary whitespace-pre-wrap">{m.content}</div>
                    </div>
                  );
                }

                if (m.role === 'error') {
                  return (
                    <div key={i} className="flex flex-col gap-xs max-w-[85%]">
                      <div className="font-label-caps text-label-caps text-error">SAGE_AI // {time}</div>
                      <div className="bg-error/10 border-2 border-error p-sm text-error whitespace-pre-wrap">{m.content}</div>
                    </div>
                  );
                }

                // assistant (plain text; may still be streaming with partial content)
                return (
                  <div key={i} className="flex flex-col gap-xs max-w-[85%]">
                    <div className="font-label-caps text-label-caps text-on-surface-variant">SAGE_AI // {time}</div>
                    <div className="bg-surface border-2 border-outline-variant p-sm text-on-surface hover:bg-surface-container-high transition-colors whitespace-pre-wrap">
                      {m.content}
                      {m.streaming && <span className="inline-block w-[6px] h-[14px] bg-secondary ml-1 align-middle animate-pulse" />}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Strategy sheet (slides up when the attach button is pressed) */}
        <AnimatePresence>
          {strategyOpen && (
            <StrategySheet
              strategy={strategy}
              strategyName={strategyName}
              onSave={saveStrategy}
              onClear={clearStrategy}
              onClose={() => setStrategyOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Strategy loaded indicator */}
        {strategy && !strategyOpen && (
          <div className="px-md py-xs border-t border-white/10 bg-secondary/5 flex items-center justify-between shrink-0">
            <span className="font-label-caps text-label-caps text-secondary flex items-center gap-xs">
              <span className="material-symbols-outlined text-[12px]">description</span>
              {strategyName || 'Strategy loaded'}
            </span>
            <button onClick={() => setStrategyOpen(true)} className="font-label-caps text-label-caps text-on-surface-variant hover:text-secondary transition-colors">
              EDIT
            </button>
          </div>
        )}

        {/* Input */}
        <div className="p-sm border-t-2 border-outline-variant bg-surface-container-low shrink-0 flex gap-sm items-end">
          <button
            onClick={() => setStrategyOpen(o => !o)}
            title={strategy ? 'Edit strategy document' : 'Upload strategy document'}
            className={
              'w-9 h-9 shrink-0 flex items-center justify-center border-2 transition-colors ' +
              (strategyOpen ? 'border-secondary text-secondary bg-secondary/10' : 'border-outline-variant text-on-surface-variant hover:text-secondary hover:border-secondary')
            }
          >
            <span className="material-symbols-outlined text-[18px]">attach_file</span>
          </button>
          <div className="flex-1 relative">
            <span className="absolute left-sm top-1/2 -translate-y-1/2 font-stat-lg text-body-bold text-secondary pointer-events-none">&gt;</span>
            <textarea
              ref={inputRef}
              rows={1}
              className="w-full bg-[#141414] border-2 border-outline-variant py-sm pl-lg pr-sm font-stat-lg text-body-base text-primary focus:outline-none focus:border-secondary placeholder:text-on-surface-variant transition-colors resize-none"
              placeholder="Query Sage AI..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={busy}
            />
          </div>
          <Button variant="secondary" size="md" disabled={!input.trim() || busy} onClick={() => send()}>
            <span className="material-symbols-outlined text-[16px]">send</span>
          </Button>
        </div>
      </section>

      {/* ── RIGHT: Live data & actions ── */}
      <aside className="w-[300px] shrink-0 flex flex-col gap-md">

        {/* SMC Logic Stream */}
        <div className="flex-1 glass-panel module-glow flex flex-col overflow-hidden min-h-0">
          <div className="p-sm border-b border-white/10 flex justify-between items-center shrink-0">
            <h3 className="font-label-caps text-label-caps text-primary tracking-widest">LIVE_SMC_EVENTS</h3>
            <div className="w-2 h-2 rounded-full bg-error shadow-[0_0_8px_#ffb4ab] animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto p-xs min-h-0">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-xs text-center py-lg">
                <span className="material-symbols-outlined text-[24px] text-outline-variant">radar</span>
                <span className="font-label-caps text-label-caps text-on-surface-variant">SCANNING FOR EVENTS…</span>
              </div>
            ) : (
              <table className="w-full text-left font-stat-lg text-[12px]">
                <tbody className="divide-y divide-white/5">
                  {events.map((e, i) => (
                    <tr key={i} className="hover:bg-white/5 cursor-default transition-colors">
                      <td className="py-xs px-sm text-on-surface-variant">{fmtClock(e.time)}</td>
                      <td className={'py-xs px-sm font-bold ' + dirClass(e.direction)}>
                        {e.kind} <span className="text-on-surface-variant font-normal">{e.tf}</span>
                      </td>
                      <td className="py-xs px-sm text-right text-primary">{fmtNum(e.price, e.price > 100 ? 1 : 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* AI Analysis Action */}
        <div className="glass-panel module-glow-secondary p-md flex flex-col justify-center items-center gap-md relative overflow-hidden shrink-0 border-secondary/30">
          <div className="text-center z-10">
            <h4 className="font-headline-md text-headline-md text-secondary glow-text-secondary mb-xs">ANALYZE MARKET</h4>
            <p className="font-body-base text-[12px] text-on-surface-variant">
              Run a full SMC structure scan on <span className="text-primary">{data?.symbol ?? 'the active symbol'}</span> across every timeframe.
            </p>
          </div>
          <Button variant="secondary" size="md" className="w-full z-10" disabled={busy} onClick={runAnalysis}>
            <span className="material-symbols-outlined text-[16px]">radar</span>
            {analyzing ? 'SCANNING…' : 'ANALYZE CHART'}
          </Button>
        </div>
      </aside>
    </div>
  );
}
