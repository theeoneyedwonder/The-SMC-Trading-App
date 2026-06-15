import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = 'http://127.0.0.1:8000';
const S = { WAIT:'wait', WELCOME:'welcome', NO_MT5:'no_mt5', FORM:'form', CONNECTING:'connecting', SUCCESS:'success', ERROR:'error' };
const SERVERS_KEY = 'smc_past_servers';

function openMT5Download() {
  const url = 'https://www.metatrader5.com/en/download';
  if (window.electronAPI?.openExternal) window.electronAPI.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}

function loadSavedServers() {
  try { return JSON.parse(localStorage.getItem(SERVERS_KEY) || '[]'); } catch { return []; }
}

function saveServer(server) {
  const trimmed = server.trim();
  if (!trimmed) return;
  const prev = loadSavedServers();
  const next = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 12);
  localStorage.setItem(SERVERS_KEY, JSON.stringify(next));
}

export default function Setup({ onComplete }) {
  const [step, setStep]         = useState(S.WAIT);
  const [form, setForm]         = useState({ login:'', password:'', server:'' });
  const [account, setAccount]   = useState(null);
  const [errMsg, setErrMsg]     = useState('');
  const [serverOpen, setServerOpen] = useState(false);
  const [savedServers, setSavedServers] = useState([]);

  useEffect(() => {
    setSavedServers(loadSavedServers());
    let live = true;
    const poll = async () => {
      try { const r = await fetch(`${API}/health`); if (r.ok && live) { setStep(S.WELCOME); return; } } catch {}
      if (live) setTimeout(poll, 1000);
    };
    poll();
    return () => { live = false; };
  }, []);

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }));

  const handleGetStarted = async () => {
    try {
      const r = await fetch(`${API}/setup/check-mt5`);
      const d = await r.json();
      setStep(d.installed ? S.FORM : S.NO_MT5);
    } catch { setStep(S.FORM); }
  };

  const handleConnect = async () => {
    setStep(S.CONNECTING); setErrMsg('');
    try {
      const res  = await fetch(`${API}/setup`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ login:parseInt(form.login,10), password:form.password, server:form.server.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.detail||'Connection failed.'); setStep(S.ERROR); return; }
      saveServer(form.server);
      setSavedServers(loadSavedServers());
      setAccount(data.account); setStep(S.SUCCESS);
    } catch { setErrMsg('Could not reach the backend. Ensure MetaTrader 5 is installed and running.'); setStep(S.ERROR); }
  };

  const selectServer = (srv) => {
    setForm(p => ({ ...p, server: srv }));
    setServerOpen(false);
  };

  const canSubmit = form.login.trim() && form.password && form.server.trim();

  if (step === S.WAIT) {
    return (
      <div className="splash-screen">
        <div className="splash-inner">
          <p className="splash-label">Smart Money Concepts</p>
          <h1 className="splash-title">The SMC<br/>Trading App</h1>
          <p className="splash-by">by TheEoneYedWonder</p>
          <div className="splash-dots"><span/><span/><span/></div>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-bg">
      <div className="setup-card">
        <div className="setup-logo">
          <div className="setup-logo-mark">S</div>
          <div className="setup-logo-text">The SMC Trading App</div>
        </div>

        {step === S.WELCOME && (
          <div className="setup-body">
            <h1 className="setup-heading">Smart Money Concepts<br/>Trading Dashboard</h1>
            <p className="setup-desc">Visualise Order Blocks, Fair Value Gaps and Market Structure Shifts across every timeframe — live, connected to your MT5 account.</p>
            <div className="setup-features">
              <span>◈ Real-time candlestick charts with OB / FVG / BOS</span>
              <span>◈ Live open positions &amp; P&amp;L tracking</span>
              <span>◈ Full trade history &amp; performance analytics</span>
              <span>◈ Multi-timeframe market structure panel</span>
            </div>
            <button className="setup-btn primary" onClick={handleGetStarted}>Get Started →</button>
          </div>
        )}

        {step === S.NO_MT5 && (
          <div className="setup-body setup-centered">
            <div className="setup-icon-circle warn">!</div>
            <h2 className="setup-subheading">MetaTrader 5 Not Found</h2>
            <p className="setup-desc">This app requires MetaTrader 5 to be installed on your computer.</p>
            <div className="setup-features" style={{textAlign:'left',width:'100%'}}>
              <span>1. Download MT5 from your broker's website</span>
              <span>2. Install and open MetaTrader 5</span>
              <span>3. Log in with your trading account</span>
              <span>4. Return here and click <strong style={{color:'var(--text)'}}>I've installed it</strong></span>
            </div>
            <div className="setup-mt5-actions">
              <button className="setup-btn primary" onClick={openMT5Download}>Download MT5</button>
              <button className="setup-btn ghost"   onClick={() => setStep(S.FORM)}>I've installed it →</button>
            </div>
            <p className="setup-micro">Tip: download MT5 from your broker's website — it comes pre-configured with their servers.</p>
          </div>
        )}

        {step === S.FORM && (
          <div className="setup-body">
            <h2 className="setup-subheading">Connect MetaTrader 5</h2>
            <div className="setup-field">
              <label htmlFor="s-login">Account Number</label>
              <input id="s-login" type="number" className="setup-input" placeholder="e.g. 12345678" value={form.login} onChange={set('login')} autoFocus/>
            </div>
            <div className="setup-field">
              <label htmlFor="s-pass">Password</label>
              <input id="s-pass" type="password" className="setup-input" placeholder="Your MT5 password" value={form.password} onChange={set('password')}/>
            </div>

            {/* Server field with history dropdown */}
            <div className="setup-field">
              <label htmlFor="s-srv">
                Server <span className="setup-hint">MT5 → File → Open Account → server name</span>
              </label>
              <div className="setup-server-wrap" style={{ position: 'relative' }}>
                <input
                  id="s-srv"
                  type="text"
                  className="setup-input"
                  placeholder="e.g. ICMarkets-Demo01"
                  value={form.server}
                  onChange={e => { set('server')(e); setServerOpen(false); }}
                  onKeyDown={e => e.key === 'Enter' && canSubmit && handleConnect()}
                  autoComplete="off"
                />
                {savedServers.length > 0 && (
                  <button
                    type="button"
                    className="setup-server-chevron"
                    onClick={() => setServerOpen(o => !o)}
                    tabIndex={-1}
                    title="Past servers"
                  >
                    {serverOpen ? '▲' : '▼'}
                  </button>
                )}
                <AnimatePresence>
                  {serverOpen && savedServers.length > 0 && (
                    <motion.div
                      className="setup-server-dropdown"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.13 }}
                    >
                      <div className="setup-server-dropdown-label">Recent servers</div>
                      {savedServers.map(srv => (
                        <button
                          key={srv}
                          type="button"
                          className="setup-server-opt"
                          onClick={() => selectServer(srv)}
                        >
                          {srv}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="setup-row-actions">
              <button className="setup-btn ghost"   onClick={() => setStep(S.WELCOME)}>← Back</button>
              <button className="setup-btn primary" onClick={handleConnect} disabled={!canSubmit}>Connect</button>
            </div>
          </div>
        )}

        {step === S.CONNECTING && (
          <div className="setup-body setup-centered">
            <div className="setup-spinner"/>
            <p className="setup-sub">Connecting to MetaTrader 5…</p>
            <p className="setup-micro">This may take up to 30 seconds</p>
          </div>
        )}

        {step === S.SUCCESS && account && (
          <div className="setup-body setup-centered">
            <div className="setup-icon-circle ok">✓</div>
            <h2 className="setup-subheading">Connected!</h2>
            <div className="setup-account-table">
              {[['Account',`#${account.login}`],['Name',account.name],['Balance',`${account.currency} ${Number(account.balance).toFixed(2)}`,'green'],['Broker',account.company],['Server',account.server]].map(([l,v,cls])=>(
                <div className="setup-acct-row" key={l}>
                  <span className="setup-acct-label">{l}</span>
                  <span className={`setup-acct-value${cls?' '+cls:''}`}>{v}</span>
                </div>
              ))}
            </div>
            <button className="setup-btn primary" onClick={onComplete}>Open Dashboard →</button>
          </div>
        )}

        {step === S.ERROR && (
          <div className="setup-body setup-centered">
            <div className="setup-icon-circle err">✗</div>
            <h2 className="setup-subheading">Connection Failed</h2>
            <p className="setup-error-text">{errMsg}</p>
            <div className="setup-mt5-actions">
              <button className="setup-btn primary" onClick={() => setStep(S.FORM)}>← Try Again</button>
              <button className="setup-btn ghost"   onClick={() => setStep(S.NO_MT5)}>Download MT5</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
