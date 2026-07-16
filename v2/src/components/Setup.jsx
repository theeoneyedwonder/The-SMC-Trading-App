import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';
import { LogoZone } from './Logo';

const API = 'http://127.0.0.1:8000';
const S = { WAIT:'wait', WELCOME:'welcome', NO_MT5:'no_mt5', FORM:'form', CONNECTING:'connecting', SUCCESS:'success', ERROR:'error' };
const SERVERS_KEY = 'smc_past_servers';

const FEATURES = [
  'Real-time candlestick charts with OB / FVG / BOS',
  'Live open positions & P&L tracking',
  'Full trade history & performance analytics',
  'Multi-timeframe market structure panel',
];

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

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-xs">
      <label className="font-label-caps text-label-caps text-primary flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-sm">
        {label}
        {hint && <span className="font-label-caps text-[9px] text-on-surface-variant normal-case tracking-normal">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function StepDot({ icon, label, state }) {
  const box = state === 'active'
    ? 'bg-primary-fixed border-primary-fixed text-on-primary-fixed glow-primary'
    : state === 'done'
    ? 'bg-surface-container-high border-primary-fixed-dim text-primary-fixed-dim'
    : 'bg-[#141414] border-outline-variant text-on-surface-variant';
  return (
    <div className="flex flex-col items-center gap-sm">
      <div className={`w-8 h-8 flex items-center justify-center border-2 transition-all ${box}`}>
        <span className="material-symbols-outlined text-[16px]">{state === 'done' ? 'check' : icon}</span>
      </div>
      <span className={`font-label-caps text-label-caps ${state === 'active' ? 'text-primary-fixed' : 'text-on-surface-variant'}`}>{label}</span>
    </div>
  );
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
          <div className="w-16 h-16 bg-primary-fixed glow-primary flex items-center justify-center text-on-primary-fixed mx-auto mb-lg">
            <LogoZone size={34} />
          </div>
          <p className="splash-label">Smart Money Concepts</p>
          <h1 className="splash-title">QUANT_CORE</h1>
          <p className="splash-by">by TheEoneYedWonder</p>
          <div className="splash-dots"><span/><span/><span/></div>
        </div>
      </div>
    );
  }

  const welcomeState  = step === S.WELCOME ? 'active' : 'done';
  const connectState  = [S.WELCOME].includes(step) ? 'upcoming' : [S.SUCCESS].includes(step) ? 'done' : 'active';
  const readyState    = step === S.SUCCESS ? 'active' : 'upcoming';

  return (
    <div className="min-h-screen w-full flex flex-col font-body-base">
      {/* Progress header */}
      <header className="fixed top-0 left-0 w-full h-20 glass-panel z-50 flex items-center justify-between px-lg md:px-xl shrink-0">
        <div className="flex items-center gap-md">
          <div className="w-10 h-10 bg-primary-fixed glow-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-on-primary-fixed">terminal</span>
          </div>
          <div>
            <h1 className="font-display-lg text-[20px] font-black text-primary tracking-tighter glow-text-primary leading-none">QUANT_CORE</h1>
            <p className="font-label-caps text-label-caps text-on-surface-variant mt-1">INITIALIZATION SEQUENCE</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-lg">
          <StepDot icon="waving_hand" label="WELCOME" state={welcomeState} />
          <div className="w-12 h-[2px] bg-outline-variant" />
          <StepDot icon="key" label="CONNECT" state={connectState} />
          <div className="w-12 h-[2px] bg-outline-variant" />
          <StepDot icon="rocket_launch" label="READY" state={readyState} />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center pt-20 p-md md:p-xl w-full">
        <div className="w-full max-w-2xl glass-panel p-xl flex flex-col gap-lg">

          {step === S.WELCOME && (
            <div className="flex flex-col gap-lg items-center text-center">
              <div className="w-16 h-16 bg-primary-fixed glow-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[32px] text-on-primary-fixed">candlestick_chart</span>
              </div>
              <div>
                <h2 className="font-headline-md text-[24px] font-black text-primary mb-sm leading-tight">
                  Smart Money Concepts<br/>Trading Dashboard
                </h2>
                <p className="font-body-base text-body-base text-on-surface-variant max-w-md mx-auto leading-relaxed">
                  Visualise Order Blocks, Fair Value Gaps and Market Structure Shifts across every timeframe — live, connected to your MT5 account.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm w-full text-left">
                {FEATURES.map(f => (
                  <div key={f} className="flex items-center gap-sm p-sm bg-surface-container-low border-2 border-outline-variant">
                    <span className="material-symbols-outlined text-primary-fixed text-[16px] shrink-0">check_circle</span>
                    <span className="font-body-base text-[13px] text-on-surface">{f}</span>
                  </div>
                ))}
              </div>
              <Button variant="primary" size="lg" className="w-full max-w-xs" onClick={handleGetStarted}>
                Get Started <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Button>
            </div>
          )}

          {step === S.NO_MT5 && (
            <div className="flex flex-col gap-lg items-center text-center">
              <div className="w-16 h-16 border-2 border-secondary bg-surface-container-low flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[32px] text-secondary">warning</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-primary">MetaTrader 5 Not Found</h2>
              <p className="font-body-base text-body-base text-on-surface-variant">This app requires MetaTrader 5 to be installed on your computer.</p>
              <div className="flex flex-col gap-xs w-full text-left bg-surface-container-low border-2 border-outline-variant p-md">
                <span className="font-body-base text-[13px] text-on-surface">1. Download MT5 from your broker's website</span>
                <span className="font-body-base text-[13px] text-on-surface">2. Install and open MetaTrader 5</span>
                <span className="font-body-base text-[13px] text-on-surface">3. Log in with your trading account</span>
                <span className="font-body-base text-[13px] text-on-surface">4. Return here and click <strong className="text-primary">I've installed it</strong></span>
              </div>
              <div className="flex gap-md w-full max-w-md">
                <Button variant="ghost" size="lg" className="flex-1" onClick={openMT5Download}>Download MT5</Button>
                <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep(S.FORM)}>I've installed it →</Button>
              </div>
              <p className="font-label-caps text-[10px] text-on-surface-variant">Tip: download MT5 from your broker's website — it comes pre-configured with their servers.</p>
            </div>
          )}

          {step === S.FORM && (
            <div className="flex flex-col gap-lg">
              <div className="border-b-2 border-outline-variant pb-md flex justify-between items-end flex-wrap gap-sm">
                <div>
                  <h2 className="font-headline-md text-headline-md text-primary mb-xs">Connect MetaTrader 5</h2>
                  <p className="font-body-base text-body-base text-on-surface-variant">Enter your MT5 account credentials to link your terminal.</p>
                </div>
                <div className="bg-[#141414] border-2 border-outline-variant px-md py-sm flex items-center gap-sm shrink-0">
                  <span className="material-symbols-outlined text-primary-fixed text-[18px]">lock</span>
                  <span className="font-label-caps text-label-caps text-primary-fixed">STORED LOCALLY</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
                <div className="flex flex-col gap-lg">
                  <Field label="ACCOUNT NUMBER">
                    <input
                      type="number"
                      className="w-full bg-[#141414] border-2 border-outline-variant p-md font-stat-lg text-stat-lg text-[16px] text-primary placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-fixed transition-colors"
                      placeholder="e.g. 12345678"
                      value={form.login}
                      onChange={set('login')}
                      autoFocus
                    />
                  </Field>
                  <Field label="PASSWORD">
                    <input
                      type="password"
                      className="w-full bg-[#141414] border-2 border-outline-variant p-md font-stat-lg text-stat-lg text-[16px] text-primary placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-fixed transition-colors"
                      placeholder="Your MT5 password"
                      value={form.password}
                      onChange={set('password')}
                    />
                  </Field>
                  <Field label="SERVER" hint="MT5 → File → Open Account → server name">
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full bg-[#141414] border-2 border-outline-variant p-md font-stat-lg text-stat-lg text-[16px] text-primary placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary-fixed transition-colors pr-12"
                        placeholder="e.g. ICMarkets-Demo01"
                        value={form.server}
                        onChange={e => { set('server')(e); setServerOpen(false); }}
                        onKeyDown={e => e.key === 'Enter' && canSubmit && handleConnect()}
                        autoComplete="off"
                      />
                      {savedServers.length > 0 && (
                        <button
                          type="button"
                          className="absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary-fixed transition-colors"
                          onClick={() => setServerOpen(o => !o)}
                          tabIndex={-1}
                          title="Past servers"
                        >
                          <span className="material-symbols-outlined text-[18px]">{serverOpen ? 'expand_less' : 'expand_more'}</span>
                        </button>
                      )}
                      <AnimatePresence>
                        {serverOpen && savedServers.length > 0 && (
                          <motion.div
                            className="absolute left-0 right-0 mt-xs bg-[#141414] border-2 border-outline-variant shadow-[4px_4px_0px_#000000] z-20 max-h-[200px] overflow-y-auto"
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.13 }}
                          >
                            <div className="font-label-caps text-label-caps text-on-surface-variant px-sm py-xs border-b-2 border-outline-variant">Recent servers</div>
                            {savedServers.map(srv => (
                              <button
                                key={srv}
                                type="button"
                                className="w-full text-left px-sm py-sm font-body-base text-[13px] text-on-surface hover:bg-surface-container-high transition-colors"
                                onClick={() => selectServer(srv)}
                              >
                                {srv}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </Field>
                </div>

                <div className="flex flex-col justify-between gap-md">
                  <div className="bg-[#141414] border-2 border-outline-variant p-md flex flex-col gap-md">
                    <div className="flex items-center gap-sm">
                      <span className="material-symbols-outlined text-secondary text-[18px]">info</span>
                      <span className="font-label-caps text-label-caps text-secondary">SECURITY PROTOCOL</span>
                    </div>
                    <ul className="font-body-base text-[13px] text-on-surface-variant space-y-sm list-disc pl-md leading-relaxed">
                      <li>Credentials are sent directly to your local MT5 terminal — never to our servers.</li>
                      <li>The connection uses MetaTrader 5's own encrypted session.</li>
                      <li>Only your server name is remembered locally for next time.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-md border-t-2 border-outline-variant">
                <button
                  onClick={() => setStep(S.WELCOME)}
                  className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-colors flex items-center gap-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span> BACK
                </button>
                <Button variant="primary" size="lg" disabled={!canSubmit} onClick={handleConnect}>
                  Connect <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Button>
              </div>
            </div>
          )}

          {step === S.CONNECTING && (
            <div className="flex flex-col items-center gap-md text-center py-xl">
              <span className="material-symbols-outlined text-[40px] text-primary-fixed animate-spin">progress_activity</span>
              <p className="font-headline-md text-headline-md text-primary">Connecting to MetaTrader 5…</p>
              <p className="font-label-caps text-label-caps text-on-surface-variant">THIS MAY TAKE UP TO 30 SECONDS</p>
            </div>
          )}

          {step === S.SUCCESS && account && (
            <div className="flex flex-col items-center gap-lg text-center">
              <div className="w-16 h-16 bg-primary-fixed glow-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[32px] text-on-primary-fixed">check</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-primary">Connected!</h2>
              <div className="grid grid-cols-2 gap-md w-full max-w-md">
                {[
                  ['ACCOUNT', `#${account.login}`],
                  ['NAME', account.name],
                  ['BALANCE', `${account.currency} ${Number(account.balance).toFixed(2)}`, true],
                  ['BROKER', account.company],
                  ['SERVER', account.server],
                ].map(([label, val, green]) => (
                  <div key={label} className="flex flex-col gap-xs p-sm bg-surface-container-low border-2 border-outline-variant text-left">
                    <span className="font-label-caps text-label-caps text-on-surface-variant">{label}</span>
                    <span className={`font-body-bold text-body-bold truncate ${green ? 'text-primary-fixed-dim' : 'text-primary'}`}>{val}</span>
                  </div>
                ))}
              </div>
              <Button variant="primary" size="lg" className="w-full max-w-xs" onClick={onComplete}>
                Open Dashboard <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Button>
            </div>
          )}

          {step === S.ERROR && (
            <div className="flex flex-col items-center gap-lg text-center">
              <div className="w-16 h-16 border-2 border-error bg-error/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[32px] text-error">close</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-error">Connection Failed</h2>
              <p className="font-body-base text-body-base text-on-surface-variant">{errMsg}</p>
              <div className="flex gap-md w-full max-w-md">
                <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep(S.FORM)}>← Try Again</Button>
                <Button variant="ghost" size="lg" className="flex-1" onClick={() => setStep(S.NO_MT5)}>Download MT5</Button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
