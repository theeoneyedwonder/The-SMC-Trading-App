import { useState, useRef, useEffect } from 'react';

const API = 'http://127.0.0.1:8000';

const MODES = [
  { id: 'manual',   label: 'Manual' },
  { id: 'assisted', label: 'Assisted' },
  { id: 'semi',     label: 'Semi-Auto' },
  { id: 'auto',     label: 'Full Auto' },
];

const SUGGESTIONS = [
  'What is the current market bias?',
  'Identify key order blocks on this chart',
  'Any FVGs worth watching?',
  'Summarise my open positions',
  'What should I watch for next session?',
];

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

export default function AIPanel({ data, onClose, onAIAnalysis }) {
  const [tab, setTab]             = useState('chat');
  const [mode, setMode]           = useState(() => localStorage.getItem('ai_mode') || 'assisted');
  const [messages, setMessages]   = useState([{
    role: 'assistant',
    content: "Hi! I'm your SMC trading companion. I can see your live account data, open positions, and market structure analysis.\n\nAsk me anything about the current market, your trades, or SMC concepts.",
  }]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [analysis, setAnalysis]   = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const bottomRef                 = useRef(null);
  const inputRef                  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const setModePersist = (m) => {
    setMode(m);
    localStorage.setItem('ai_mode', m);
  };

  const runAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const r = await fetch(`${API}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: data ?? {} }),
      });
      const d = await r.json();
      if (r.ok) {
        setAnalysis(d);
        onAIAnalysis?.(d.key_levels ?? []);
        setTab('analysis');
      } else {
        setMessages(prev => [...prev, { role: 'error', content: d.detail || 'Analysis failed.' }]);
        setTab('chat');
      }
    } catch {
      setMessages(prev => [...prev, { role: 'error', content: 'Could not reach the backend.' }]);
      setTab('chat');
    }
    setAnalyzing(false);
  };

  const send = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const r = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: data ?? {} }),
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

  const acct       = data?.account;
  const isHighMode = mode === 'semi' || mode === 'auto';
  const biasColor  = analysis?.bias === 'bullish' ? 'var(--green)'
                   : analysis?.bias === 'bearish'  ? 'var(--red)'
                   : 'var(--muted)';

  return (
    <div className="ai-panel">
      {/* ── Header ── */}
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <div className="ai-badge">AI</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>SMC Companion</div>
            <div style={{ fontSize: 10, color: 'var(--text2)', letterSpacing: '.5px' }}>CLAUDE · SMART MONEY CONCEPTS</div>
          </div>
        </div>
        <button className="ai-close-btn" onClick={onClose} title="Close">✕</button>
      </div>

      {/* ── Automation mode selector ── */}
      <div className="ai-mode-bar">
        {MODES.map(m => (
          <button
            key={m.id}
            className={`ai-mode-btn${mode === m.id ? ' active' : ''}`}
            onClick={() => setModePersist(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Context bar ── */}
      {acct && (
        <div className="ai-context-bar">
          <span>{data?.symbol ?? '—'}</span>
          <span style={{ color: 'var(--muted)' }}>·</span>
          <span style={{ color: 'var(--text2)' }}>
            {acct.currency} {Number(acct.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span style={{ color: 'var(--muted)' }}>·</span>
          <span style={{ color: acct.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {acct.profit >= 0 ? '+' : ''}{Number(acct.profit).toFixed(2)}
          </span>
        </div>
      )}

      {/* ── Coming soon for high-automation modes ── */}
      {isHighMode ? (
        <div className="ai-coming-soon">
          <div className="ai-coming-badge">Coming Soon</div>
          <p><strong>{mode === 'semi' ? 'Semi-Auto' : 'Full Auto'}</strong> mode is under development.</p>
          <p style={{ color: 'var(--text2)', fontSize: 11, lineHeight: 1.7 }}>
            {mode === 'semi'
              ? 'In Semi-Auto mode the AI will prepare trade orders for your one-click confirmation.'
              : 'In Full Auto mode the AI will execute trades independently when SMC confluences align.'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>
            Switch to <strong style={{ color: 'var(--text)' }}>Assisted</strong> mode to use AI analysis now.
          </p>
        </div>
      ) : (
        <>
          {/* ── Tab bar + Analyze button ── */}
          <div className="ai-tab-bar">
            <button className={`ai-tab-btn${tab === 'analysis' ? ' active' : ''}`} onClick={() => setTab('analysis')}>
              Analysis
            </button>
            <button className={`ai-tab-btn${tab === 'chat' ? ' active' : ''}`} onClick={() => setTab('chat')}>
              Chat
            </button>
            <button
              className="ai-analyze-btn"
              onClick={runAnalysis}
              disabled={analyzing || mode === 'manual'}
              title={mode === 'manual' ? 'Switch to Assisted mode to use AI analysis' : 'Run AI market analysis'}
            >
              {analyzing ? '⏳ Analyzing…' : '▶ Analyze'}
            </button>
          </div>

          {/* ── Analysis tab ── */}
          {tab === 'analysis' && (
            <div className="ai-analysis-body">
              {!analysis ? (
                <div className="ai-analysis-empty">
                  <div className="ai-analysis-empty-icon">◈</div>
                  <p>Click <strong>▶ Analyze</strong> to run a full SMC market analysis.</p>
                  <p>The AI will examine order blocks, FVGs, and market structure — then display its findings here and mark key levels directly on the chart.</p>
                </div>
              ) : (
                <>
                  {/* Bias card */}
                  <div className="ai-bias-card">
                    <div className="ai-bias-top">
                      <span className="ai-bias-badge" style={{
                        background: biasColor + '22',
                        color: biasColor,
                        borderColor: biasColor + '55',
                      }}>
                        {analysis.bias?.toUpperCase() ?? 'NEUTRAL'}
                      </span>
                      <span className="ai-confidence-label">{analysis.confidence ?? 0}% confidence</span>
                    </div>
                    <div className="ai-confidence-bar-track">
                      <div className="ai-confidence-bar-fill" style={{ width: `${analysis.confidence ?? 0}%`, background: biasColor }} />
                    </div>
                    {analysis.reason && <p className="ai-bias-reason">{analysis.reason}</p>}
                  </div>

                  {/* Setup card */}
                  {analysis.setup?.active && (
                    <div className="ai-setup-card">
                      <div className="ai-setup-header">
                        <span className={`ai-setup-dir ${analysis.setup.direction?.toLowerCase()}`}>
                          {analysis.setup.direction}
                        </span>
                        <span className="ai-setup-title">Suggested Setup</span>
                        {analysis.setup.rr != null && (
                          <span className="ai-setup-rr">R:R {Number(analysis.setup.rr).toFixed(1)}</span>
                        )}
                      </div>
                      <div className="ai-setup-grid">
                        {analysis.setup.entry != null && (
                          <div><span>Entry</span><strong>{analysis.setup.entry}</strong></div>
                        )}
                        {analysis.setup.sl != null && (
                          <div><span>Stop Loss</span><strong style={{ color: 'var(--red)' }}>{analysis.setup.sl}</strong></div>
                        )}
                        {analysis.setup.tp != null && (
                          <div><span>Take Profit</span><strong style={{ color: 'var(--green)' }}>{analysis.setup.tp}</strong></div>
                        )}
                      </div>
                      {analysis.setup.rationale && (
                        <p className="ai-setup-rationale">{analysis.setup.rationale}</p>
                      )}
                    </div>
                  )}

                  {/* Key levels */}
                  {analysis.key_levels?.length > 0 && (
                    <div className="ai-levels-section">
                      <div className="ai-levels-title">
                        Key Levels
                        <span className="ai-levels-chart-note">· marked on chart</span>
                      </div>
                      {analysis.key_levels.map((lvl, i) => (
                        <div key={i} className="ai-level-item">
                          <span className={`ai-level-dot ${lvl.type}`} />
                          <span className="ai-level-label">{lvl.label}</span>
                          <span className="ai-level-price">{lvl.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  {analysis.summary && (
                    <div className="ai-summary">
                      <div className="ai-levels-title">Full Analysis</div>
                      <p>{analysis.summary}</p>
                    </div>
                  )}

                  <div className="ai-refresh-note">
                    Click <strong>▶ Analyze</strong> again to refresh
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Chat tab ── */}
          {tab === 'chat' && (
            <>
              <div className="ai-messages">
                {messages.map((m, i) => (
                  <div key={i} className={`ai-msg ai-msg-${m.role}`}>
                    {m.role === 'assistant' && <div className="ai-avatar">S</div>}
                    <div className={`ai-bubble ai-bubble-${m.role}`}>
                      {m.content.split('\n').map((line, j, arr) => (
                        <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="ai-msg ai-msg-assistant">
                    <div className="ai-avatar">S</div>
                    <div className="ai-bubble ai-bubble-assistant ai-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {messages.length === 1 && (
                <div className="ai-suggestions">
                  {SUGGESTIONS.map(s => (
                    <button key={s} className="ai-suggestion" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              )}

              <div className="ai-input-bar">
                <textarea
                  ref={inputRef}
                  className="ai-input"
                  rows={1}
                  placeholder="Ask about market structure, your trades..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  disabled={loading}
                />
                <button className="ai-send-btn" onClick={() => send()} disabled={!input.trim() || loading}>
                  <SendIcon />
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
