import { useState, useEffect } from 'react';

const API = 'http://127.0.0.1:8000';

const S = {
  WAIT:        'wait',
  WELCOME:     'welcome',
  NO_MT5:      'no_mt5',
  FORM:        'form',
  CONNECTING:  'connecting',
  SUCCESS:     'success',
  ERROR:       'error',
};

function openMT5Download() {
  const url = 'https://www.metatrader5.com/en/download';
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

export default function Setup({ onComplete }) {
  const [step, setStep]       = useState(S.WAIT);
  const [form, setForm]       = useState({ login: '', password: '', server: '' });
  const [account, setAccount] = useState(null);
  const [errMsg, setErrMsg]   = useState('');

  // Poll /health until backend is ready
  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const r = await fetch(`${API}/health`);
        if (r.ok && live) { setStep(S.WELCOME); return; }
      } catch {}
      if (live) setTimeout(poll, 1000);
    };
    poll();
    return () => { live = false; };
  }, []);

  const set = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }));

  // Check if MT5 is installed before showing the form
  const handleGetStarted = async () => {
    try {
      const r = await fetch(`${API}/setup/check-mt5`);
      const d = await r.json();
      setStep(d.installed ? S.FORM : S.NO_MT5);
    } catch {
      setStep(S.FORM); // can't check — let them try anyway
    }
  };

  const handleConnect = async () => {
    setStep(S.CONNECTING);
    setErrMsg('');
    try {
      const res = await fetch(`${API}/setup`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login:    parseInt(form.login, 10),
          password: form.password,
          server:   form.server.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.detail || 'Connection failed. Check your credentials.');
        setStep(S.ERROR);
        return;
      }
      setAccount(data.account);
      setStep(S.SUCCESS);
    } catch {
      setErrMsg(
        'Could not reach the backend. Make sure MetaTrader 5 terminal is installed and running.'
      );
      setStep(S.ERROR);
    }
  };

  const canSubmit = form.login.trim() && form.password && form.server.trim();

  return (
    <div className="setup-bg">
      <div className="setup-card">

        <div className="setup-logo">
          <span className="setup-logo-mark">◈</span> SMC BOT
        </div>

        {/* ── Waiting for backend ─────────────────────── */}
        {step === S.WAIT && (
          <div className="setup-body setup-centered">
            <div className="setup-dots">
              <span /><span /><span />
            </div>
            <p className="setup-sub">Starting up…</p>
          </div>
        )}

        {/* ── Welcome ─────────────────────────────────── */}
        {step === S.WELCOME && (
          <div className="setup-body">
            <h1 className="setup-heading">Smart Money Concepts<br />Trading Dashboard</h1>
            <p className="setup-desc">
              Visualise Order Blocks, Fair Value Gaps and Market Structure Shifts
              across every timeframe — live, connected to your MetaTrader 5 account.
            </p>
            <div className="setup-features">
              <span>◈ Real-time candlestick charts</span>
              <span>◈ OB / FVG / BOS drawn on price</span>
              <span>◈ Live positions &amp; P&amp;L</span>
              <span>◈ Multi-timeframe structure panel</span>
            </div>
            <button className="setup-btn primary" onClick={handleGetStarted}>
              Get Started →
            </button>
          </div>
        )}

        {/* ── MT5 not installed ────────────────────────── */}
        {step === S.NO_MT5 && (
          <div className="setup-body setup-centered">
            <div className="setup-icon-circle warn">!</div>
            <h2 className="setup-subheading">MetaTrader 5 Not Found</h2>
            <p className="setup-desc">
              SMC Bot requires the MetaTrader 5 terminal to be installed on this computer.
            </p>
            <div className="setup-features" style={{ textAlign: 'left', width: '100%' }}>
              <span>1. Download MT5 from your broker's website</span>
              <span>2. Install and open MetaTrader 5</span>
              <span>3. Log in with your trading account</span>
              <span>4. Come back here and click <strong style={{color:'var(--text)'}}>I've installed it</strong></span>
            </div>
            <div className="setup-mt5-actions">
              <button className="setup-btn primary" onClick={openMT5Download}>
                Download MT5 (Generic)
              </button>
              <button className="setup-btn ghost" onClick={() => setStep(S.FORM)}>
                I've installed it →
              </button>
            </div>
            <p className="setup-micro">
              Tip: for best results, download MT5 from your specific broker's website — it will already have their servers configured.
            </p>
          </div>
        )}

        {/* ── Credentials form ────────────────────────── */}
        {step === S.FORM && (
          <div className="setup-body">
            <h2 className="setup-subheading">Connect MetaTrader 5</h2>

            <div className="setup-field">
              <label htmlFor="s-login">Account Number</label>
              <input
                id="s-login"
                type="number"
                className="setup-input"
                placeholder="e.g. 12345678"
                value={form.login}
                onChange={set('login')}
                autoFocus
              />
            </div>

            <div className="setup-field">
              <label htmlFor="s-pass">Password</label>
              <input
                id="s-pass"
                type="password"
                className="setup-input"
                placeholder="Your MT5 investor or main password"
                value={form.password}
                onChange={set('password')}
              />
            </div>

            <div className="setup-field">
              <label htmlFor="s-srv">
                Server
                <span className="setup-hint">MT5 → File → Open Account → find server name</span>
              </label>
              <input
                id="s-srv"
                type="text"
                className="setup-input"
                placeholder="e.g. ICMarkets-Demo01"
                value={form.server}
                onChange={set('server')}
                onKeyDown={e => e.key === 'Enter' && canSubmit && handleConnect()}
              />
            </div>

            <div className="setup-row-actions">
              <button className="setup-btn ghost" onClick={() => setStep(S.WELCOME)}>
                ← Back
              </button>
              <button
                className="setup-btn primary"
                onClick={handleConnect}
                disabled={!canSubmit}
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {/* ── Connecting spinner ───────────────────────── */}
        {step === S.CONNECTING && (
          <div className="setup-body setup-centered">
            <div className="setup-spinner" />
            <p className="setup-sub">Connecting to MetaTrader 5…</p>
            <p className="setup-micro">This may take up to 30 seconds</p>
          </div>
        )}

        {/* ── Success ─────────────────────────────────── */}
        {step === S.SUCCESS && account && (
          <div className="setup-body setup-centered">
            <div className="setup-icon-circle ok">✓</div>
            <h2 className="setup-subheading">Connected!</h2>
            <div className="setup-account-table">
              <Row label="Account"  value={`#${account.login}`} />
              <Row label="Name"     value={account.name}        />
              <Row label="Balance"
                   value={`${account.currency} ${account.balance?.toFixed(2)}`}
                   highlight />
              <Row label="Broker"   value={account.company}     />
              <Row label="Server"   value={account.server}      />
            </div>
            <button className="setup-btn primary" onClick={onComplete}>
              Open Dashboard →
            </button>
          </div>
        )}

        {/* ── Error ───────────────────────────────────── */}
        {step === S.ERROR && (
          <div className="setup-body setup-centered">
            <div className="setup-icon-circle err">✗</div>
            <h2 className="setup-subheading">Connection Failed</h2>
            <p className="setup-error-text">{errMsg}</p>
            {errMsg.toLowerCase().includes('metatrader') && (
              <p className="setup-micro">
                Download and install MetaTrader 5 from your broker's website, then try again.
              </p>
            )}
            <div className="setup-mt5-actions">
              <button className="setup-btn primary" onClick={() => setStep(S.FORM)}>
                ← Try Again
              </button>
              <button className="setup-btn ghost" onClick={() => setStep(S.NO_MT5)}>
                Download MT5
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="setup-acct-row">
      <span className="setup-acct-label">{label}</span>
      <span className={`setup-acct-value${highlight ? ' green' : ''}`}>{value}</span>
    </div>
  );
}
