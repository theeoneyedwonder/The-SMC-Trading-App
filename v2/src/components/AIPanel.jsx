import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={style}
    >
      <path d="M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" width="17" height="17">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
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
  const biasColor =
    data.bias === 'bullish' ? 'var(--green)' :
    data.bias === 'bearish' ? 'var(--red)' :
    'var(--muted)';

  return (
    <div className="sage-analysis-card">
      <div className="sac-bias-row">
        <span className="sac-bias-badge" style={{
          color: biasColor,
          borderColor: biasColor + '55',
          background: biasColor + '18',
        }}>
          {(data.bias ?? 'neutral').toUpperCase()}
        </span>
        <span className="sac-confidence">{data.confidence ?? 0}% confidence</span>
      </div>
      <div className="sac-bar-track">
        <div className="sac-bar-fill" style={{ width: `${data.confidence ?? 0}%`, background: biasColor }} />
      </div>

      {data.reason && <p className="sac-reason">{data.reason}</p>}

      {data.setup?.active && (
        <div className="sac-setup">
          <span className={`sac-dir ${(data.setup.direction ?? '').toLowerCase()}`}>
            {data.setup.direction}
          </span>
          {data.setup.entry != null && <span>Entry <strong>{data.setup.entry}</strong></span>}
          {data.setup.sl    != null && <span>SL <strong style={{ color: 'var(--red)' }}>{data.setup.sl}</strong></span>}
          {data.setup.tp    != null && <span>TP <strong style={{ color: 'var(--green)' }}>{data.setup.tp}</strong></span>}
          {data.setup.rr    != null && <span className="sac-rr">R:R {Number(data.setup.rr).toFixed(1)}</span>}
        </div>
      )}

      {data.key_levels?.length > 0 && (
        <div className="sac-levels">
          <div className="sac-levels-title">Key levels · marked on chart</div>
          {data.key_levels.map((lvl, i) => (
            <div key={i} className="sac-level-row">
              <span className={`sac-dot ${lvl.type ?? ''}`} />
              <span className="sac-level-lbl">{lvl.label}</span>
              <span className="sac-level-price">{lvl.price}</span>
            </div>
          ))}
        </div>
      )}

      {data.summary && <p className="sac-summary">{data.summary}</p>}
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
      className="sage-strat-sheet"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.15 }}
    >
      <div className="sss-header">
        <span>Strategy Document</span>
        <button className="sss-close" onClick={onClose}>✕</button>
      </div>
      <p className="sss-hint">
        Upload or paste your trading strategy. Sage will use it in every analysis and chat.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,.csv"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <div className="sss-actions">
        <button className="sss-upload" onClick={() => fileRef.current?.click()}>
          Upload file (.txt / .md)
        </button>
        {strategy && (
          <button className="sss-remove" onClick={() => { onClear(); onClose(); }}>
            Remove
          </button>
        )}
      </div>
      {name && <div className="sss-filename">Document: {name}</div>}
      <textarea
        className="sss-textarea"
        placeholder="Or paste your strategy here — entry rules, exit criteria, risk management, preferred SMC setups…"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={6}
      />
      <button
        className="sss-save"
        disabled={!draft.trim()}
        onClick={() => { onSave(draft, name); onClose(); }}
      >
        {strategy && strategy === draft ? '✓ Strategy saved' : 'Save strategy'}
      </button>
    </motion.div>
  );
}

export default function AIPanel({ data, onClose, onAIAnalysis }) {
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
        setMessages(prev => [...prev, { role: 'analysis', data: d }]);
      } else {
        setMessages(prev => [...prev, { role: 'error', content: d.detail || 'Analysis failed.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Could not reach the backend.' }]);
    }
    setAnalyzing(false);
  };

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading || analyzing) return;
    setInput('');
    setStrategyOpen(false);
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const r = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: data ?? {}, strategy }),
      });
      const d = await r.json();
      setMessages(prev => [...prev, {
        role: r.ok ? 'assistant' : 'error',
        content: r.ok ? d.reply : (d.detail || 'Something went wrong.'),
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Could not reach the backend.' }]);
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

  return (
    <div className="sage-panel">

      {/* ── Header ── */}
      <div className="sage-header">
        <div className="sage-header-brand">
          <div className="sage-logo-mark">
            <SageMark size={16} />
          </div>
          <div>
            <div className="sage-name">Sage</div>
            <div className="sage-tagline">SMART MONEY ANALYST</div>
          </div>
        </div>

        <div className="sage-header-right">
          {acct && (
            <div className="sage-ctx">
              <span className="sage-ctx-sym">{data?.symbol ?? '—'}</span>
              <span className="sage-ctx-sep">·</span>
              <span className="sage-ctx-bal">
                {acct.currency}&nbsp;
                {Number(acct.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {acct.profit != null && (
                <>
                  <span className="sage-ctx-sep">·</span>
                  <span style={{ color: acct.profit >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                    {acct.profit >= 0 ? '+' : ''}{Number(acct.profit).toFixed(2)}
                  </span>
                </>
              )}
            </div>
          )}
          <button className="sage-close-btn" onClick={onClose} title="Close Sage">✕</button>
        </div>
      </div>

      {/* ── Memory bar ── */}
      {hasMessages && (
        <div className="sage-memory-bar">
          <span>✓ Sage remembers this conversation</span>
          <button onClick={clearChat}>Clear</button>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="sage-messages">
        {!hasMessages ? (
          /* Empty / greeting state */
          <div className="sage-empty">
            <div className="sage-empty-mark">
              <SageMark size={34} />
            </div>
            <div className="sage-greeting-text">{sageGreeting(acct?.name)}</div>

            <div className="sage-chips">
              {SUGGESTIONS.map(s => (
                <button key={s.label} className="sage-chip" onClick={() => handleSuggestion(s)}>
                  <span className="sage-chip-label">{s.label}</span>
                  <span className="sage-chip-sub">{s.sub}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => {
              if (m.role === 'analysis') {
                return (
                  <div key={i} className="sage-msg sage-msg-assistant">
                    <div className="sage-avatar"><SageMark size={12} /></div>
                    <AnalysisCard data={m.data} />
                  </div>
                );
              }
              return (
                <div key={i} className={`sage-msg sage-msg-${m.role}`}>
                  {(m.role === 'assistant' || m.role === 'error') && (
                    <div className="sage-avatar"><SageMark size={12} /></div>
                  )}
                  <div className={`sage-bubble sage-bubble-${m.role}`}>
                    {m.content.split('\n').map((line, j, arr) => (
                      <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                    ))}
                  </div>
                </div>
              );
            })}

            {busy && (
              <div className="sage-msg sage-msg-assistant">
                <div className="sage-avatar"><SageMark size={12} /></div>
                <div className="sage-bubble sage-bubble-assistant sage-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Strategy sheet (slides up when + pressed) ── */}
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

      {/* ── Strategy loaded indicator ── */}
      {strategy && !strategyOpen && (
        <div className="sage-strat-indicator">
          <span>📄 {strategyName || 'Strategy loaded'}</span>
          <button onClick={() => setStrategyOpen(true)}>Edit</button>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="sage-input-area">
        <button
          className={`sage-plus-btn${strategyOpen ? ' active' : ''}`}
          onClick={() => setStrategyOpen(o => !o)}
          title={strategy ? 'Edit strategy document' : 'Upload strategy document'}
        >
          <PlusIcon />
        </button>
        <textarea
          ref={inputRef}
          className="sage-input"
          rows={1}
          placeholder="Ask about market structure, your trades…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          disabled={busy}
        />
        <button
          className="sage-send-btn"
          onClick={() => send()}
          disabled={!input.trim() || busy}
        >
          <SendIcon />
        </button>
      </div>

    </div>
  );
}
