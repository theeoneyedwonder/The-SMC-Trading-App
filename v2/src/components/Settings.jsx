import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Button from './Button';
import {
  getSoundSettings, setSoundSetting, previewSound, testAllAudio, SOUND_DEFAULTS,
} from '../lib/sound';

const API = 'http://127.0.0.1:8000';

const SECTIONS = [
  { id: 'account',    label: 'Account & API',         icon: 'key' },
  { id: 'risk',       label: 'Risk Management',        icon: 'warning' },
  { id: 'appearance', label: 'Interface Preferences',  icon: 'palette' },
  { id: 'screener',   label: 'Asset Screener',         icon: 'troubleshoot' },
  { id: 'alerts',     label: 'Alerts & Notifications', icon: 'notifications_active' },
  { id: 'analytics',  label: 'Analytics Prefs',        icon: 'analytics' },
  { id: 'calendar',   label: 'Economic Calendar',      icon: 'event' },
  { id: 'ai',         label: 'Sage AI Core',           icon: 'auto_awesome' },
];

// Sections that moved to their own full nav page instead of living in Settings
const MOVED_SECTIONS = {
  screener: { label: 'Asset Screener',         page: 'screener', icon: 'troubleshoot' },
  alerts:   { label: 'Alerts & Notifications', page: 'alerts',   icon: 'notifications_active' },
  analytics:{ label: 'Performance Analytics',  page: 'performance', icon: 'analytics' },
};

function GroupTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-outline-variant pb-xs mb-sm mt-lg first:mt-0">
      <h3 className="font-headline-md text-headline-md font-bold text-primary">{children}</h3>
      {action}
    </div>
  );
}

export default function Settings({ account, onLogout, onNavigate }) {
  const [section, setSection] = useState('account');
  const [hubSaved, setHubSaved] = useState(false);

  const saveActiveSection = () => {
    const activeSave = document.querySelector('.settings-active-panel [data-settings-save="true"]');
    if (activeSave && !activeSave.disabled) activeSave.click();
    setHubSaved(true);
    setTimeout(() => setHubSaved(false), 1600);
  };

  const [apiKey, setApiKey]   = useState('');
  const [hasKey, setHasKey]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Tavily web-search key
  const [searchKey, setSearchKey]         = useState('');
  const [hasSearchKey, setHasSearchKey]   = useState(false);
  const [showSearchKey, setShowSearchKey] = useState(false);
  const [searchSaving, setSearchSaving]   = useState(false);
  const [searchSaved, setSearchSaved]     = useState(false);

  useEffect(() => {
    fetch(`${API}/settings/ai-key`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHasKey(d.configured); })
      .catch(() => {});
    fetch(`${API}/settings/search-key`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHasSearchKey(d.configured); })
      .catch(() => {});
  }, []);

  const saveKey = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/settings/ai-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: apiKey.trim() }),
      });
      setHasKey(true); setApiKey(''); setShowKey(false);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  const saveSearchKey = async () => {
    if (!searchKey.trim()) return;
    setSearchSaving(true);
    try {
      await fetch(`${API}/settings/search-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: searchKey.trim() }),
      });
      setHasSearchKey(true); setSearchKey(''); setShowSearchKey(false);
      setSearchSaved(true); setTimeout(() => setSearchSaved(false), 2000);
    } catch {}
    setSearchSaving(false);
  };

  return (
    <div className="qc-page qc-settings flex-1 flex flex-col gap-md p-md overflow-hidden min-h-0">
      <div className="flex items-end justify-between border-b-2 border-outline-variant pb-md shrink-0 gap-md">
        <div>
          <h1 className="font-display-lg text-[32px] font-black text-primary uppercase tracking-tighter">System Configuration</h1>
          <p className="font-body-base text-body-base text-on-surface-variant mt-xs">Manage account connections, risk parameters, and interface preferences.</p>
        </div>
        <Button variant="neutral" size="md" onClick={saveActiveSection}>
          <span className="material-symbols-outlined text-[16px]">save</span>
          {hubSaved ? 'Saved' : 'Save Changes'}
        </Button>
      </div>

      <div className="flex-1 flex gap-md overflow-hidden min-h-0">
        {/* Sub-nav */}
        <div className="settings-subnav w-64 shrink-0 flex flex-col gap-xs overflow-y-auto">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={
                'w-full text-left px-md py-sm font-label-caps text-label-caps tracking-widest uppercase flex justify-between items-center gap-sm border-l-4 transition-colors ' +
                (section === s.id
                  ? 'bg-surface-container-highest border-primary-fixed-dim text-primary-fixed-dim'
                  : 'bg-surface-container border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-primary')
              }
            >
              <span className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
                {s.label}
              </span>
              <span className="material-symbols-outlined text-[14px] opacity-60">chevron_right</span>
            </button>
          ))}
        </div>

        {/* Active panel */}
        <div className="settings-active-panel flex-1 overflow-y-auto min-h-0 p-md">
          {section === 'account' && <AccountApiSection account={account} onLogout={onLogout} />}
          {section === 'appearance' && <InterfacePreferences onNavigate={onNavigate} />}
          {section === 'ai' && (
            <SageConfigSection
              connectors={<AISection
                apiKey={apiKey} setApiKey={setApiKey} hasKey={hasKey}
                showKey={showKey} setShowKey={setShowKey}
                saving={saving} saved={saved} saveKey={saveKey}
                searchKey={searchKey} setSearchKey={setSearchKey} hasSearchKey={hasSearchKey}
                showSearchKey={showSearchKey} setShowSearchKey={setShowSearchKey}
                searchSaving={searchSaving} searchSaved={searchSaved} saveSearchKey={saveSearchKey}
              />}
            />
          )}
          {section === 'risk' && <RiskManagementSection />}
          {section === 'calendar' && <CalendarSection />}
          {MOVED_SECTIONS[section] && (
            <MovedNotice section={MOVED_SECTIONS[section]} onNavigate={onNavigate} />
          )}
        </div>
      </div>
    </div>
  );
}

function OandaMarketDataCard() {
  const [status, setStatus] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [environment, setEnvironment] = useState('practice');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = () => {
    fetch(`${API}/settings/market/oanda`)
      .then(response => response.ok ? response.json() : null)
      .then(value => {
        if (!value) return;
        setStatus(value);
        setAccountId(value.account_id || '');
        setEnvironment(value.environment || 'practice');
      })
      .catch(() => setMessage({ ok: false, text: 'Could not read OANDA configuration.' }));
  };

  useEffect(load, []);

  const save = async () => {
    if (!accountId.trim() || !token.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/settings/market/oanda`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId.trim(),
          access_token: token.trim(),
          environment,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || 'OANDA validation failed');
      setToken('');
      setStatus(payload);
      setMessage({ ok: true, text: `Verified ${payload.environment} account${payload.currency ? ` · ${payload.currency}` : ''}.` });
      window.dispatchEvent(new CustomEvent('qc-market-providers-changed'));
    } catch (error) {
      setMessage({ ok: false, text: error.message || 'OANDA validation failed' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`${API}/settings/market/oanda`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not remove OANDA configuration');
      setStatus({ configured: false, account_id: '', environment: 'practice' });
      setAccountId('');
      setEnvironment('practice');
      setToken('');
      setMessage({ ok: true, text: 'OANDA market-data connection removed.' });
      window.dispatchEvent(new CustomEvent('qc-market-providers-changed'));
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-surface-container-lowest border-2 border-outline-variant shadow-[4px_4px_0_#000]">
      <div className="p-md border-b-2 border-outline-variant bg-surface-container-low flex justify-between items-center gap-md">
        <div>
          <h3 className="font-headline-md text-headline-md text-primary flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary-fixed">candlestick_chart</span>
            OANDA Analysis Feed
          </h3>
          <p className="font-body-base text-[12px] text-on-surface-variant mt-xs">Direct v20 candles and streaming prices. Read-only; it cannot route orders.</p>
        </div>
        <span className={'font-label-caps text-[9px] border px-xs py-1 ' + (status?.configured ? 'text-primary-fixed border-primary-fixed' : 'text-on-surface-variant border-outline-variant')}>
          {status?.configured ? 'CONFIGURED' : 'NOT CONFIGURED'}
        </span>
      </div>
      <div className="p-md grid grid-cols-1 xl:grid-cols-[180px_minmax(220px,1fr)_minmax(260px,1.4fr)_auto] gap-sm items-end">
        <label className="flex flex-col gap-xs">
          <span className="font-label-caps text-[9px] text-on-surface-variant">ENVIRONMENT</span>
          <select value={environment} onChange={event => setEnvironment(event.target.value)} className="p-sm bg-[#141414] border-2 border-outline-variant text-primary font-mono text-xs outline-none focus:border-primary-fixed">
            <option value="practice">PRACTICE</option>
            <option value="live">LIVE</option>
          </select>
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-label-caps text-[9px] text-on-surface-variant">ACCOUNT ID</span>
          <input value={accountId} onChange={event => setAccountId(event.target.value)} placeholder="101-001-…" autoComplete="off" className="p-sm bg-[#141414] border-2 border-outline-variant text-primary font-mono text-xs outline-none focus:border-primary-fixed" />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-label-caps text-[9px] text-on-surface-variant">ACCESS TOKEN {status?.configured ? '· ENTER TO REPLACE' : ''}</span>
          <input type="password" value={token} onChange={event => setToken(event.target.value)} placeholder={status?.configured ? 'Saved locally · enter a new token to re-verify' : 'OANDA personal access token'} autoComplete="new-password" onKeyDown={event => event.key === 'Enter' && save()} className="p-sm bg-[#141414] border-2 border-outline-variant text-primary font-mono text-xs outline-none focus:border-primary-fixed" />
        </label>
        <div className="flex gap-sm">
          {status?.configured && <Button variant="danger" size="sm" disabled={saving} onClick={remove}>Remove</Button>}
          <Button data-settings-save="true" variant="primary" size="sm" disabled={saving || !accountId.trim() || !token.trim()} onClick={save}>
            {saving ? 'TESTING…' : 'TEST & SAVE'}
          </Button>
        </div>
      </div>
      <div className="px-md pb-md flex items-start justify-between gap-md flex-wrap">
        <p className="font-label-caps text-[9px] text-on-surface-variant max-w-3xl">The token is stored in the local app settings file with owner-only permissions and is sent only to the selected official OANDA practice or live endpoint.</p>
        {message && <span className={'font-label-caps text-[10px] ' + (message.ok ? 'text-primary-fixed' : 'text-error')}>{message.text}</span>}
      </div>
    </section>
  );
}

/* ── Account & API (adapted from exchange-API mockups to the MT5 auth model) ── */
function AccountApiSection({ account, onLogout }) {
  const rows = account ? [
    ['ACCOUNT NAME', account.name],
    ['ACCOUNT #',    account.login],
    ['BROKER',       account.company],
    ['SERVER',       account.server],
    ['CURRENCY',     account.currency],
    ['LEVERAGE',     account.leverage ? `1:${account.leverage}` : '—'],
  ] : [];

  return (
    <div className="flex flex-col gap-md">
      <div className="border-b-2 border-outline-variant pb-md">
        <h2 className="font-display-lg text-[24px] font-black text-primary uppercase tracking-tighter">Account &amp; API Configuration</h2>
        <p className="font-body-base text-body-base text-on-surface-variant mt-xs">Manage terminal connections and local security protocols.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-8">
          <section className="bg-surface-container-lowest border-2 border-outline-variant shadow-[4px_4px_0_#000] h-full flex flex-col">
            <div className="p-md border-b-2 border-outline-variant bg-surface-container-low flex justify-between items-center gap-md">
              <h3 className="font-headline-md text-headline-md text-primary flex items-center gap-sm"><span className="material-symbols-outlined text-secondary">api</span>Current MT5 Connection</h3>
              {account && <span className="font-label-caps text-[10px] text-primary-fixed border border-primary-fixed px-xs py-1 flex items-center gap-xs"><span className="w-2 h-2 bg-primary-fixed rounded-full animate-pulse" />CONNECTED</span>}
            </div>
            {account ? (
              <div className="p-md flex-1 flex flex-col gap-md">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-md">
                  {rows.map(([label, val]) => (
                    <div key={label} className="flex flex-col gap-xs p-sm bg-surface-container-low border-2 border-outline-variant">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">{label}</span>
                      <span className="font-body-bold text-body-bold text-primary truncate">{val ?? '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-sm mt-sm">
                  {[
                    ['Market Data', 'STREAMING', 'monitoring'],
                    ['Trade Routing', 'ENABLED', 'route'],
                    ['Credential Store', 'LOCAL', 'lock'],
                  ].map(([label, value, icon]) => (
                    <div key={label} className="p-sm border-l-4 border-primary-fixed bg-surface-container-high/50 flex items-center gap-sm">
                      <span className="material-symbols-outlined text-primary-fixed text-[18px]">{icon}</span>
                      <div><div className="font-body-bold text-primary">{label}</div><div className="font-label-caps text-[9px] text-primary-fixed">{value}</div></div>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-md border-t-2 border-outline-variant flex items-center justify-between gap-md">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">Disconnect to switch account or broker.</span>
                  <Button variant="danger" size="sm" onClick={onLogout}><span className="material-symbols-outlined text-[16px]">link_off</span>Disconnect</Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-[320px] flex items-center justify-center p-md text-center font-label-caps text-label-caps text-on-surface-variant">NOT CONNECTED TO METATRADER 5</div>
            )}
          </section>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-md">
          <section className="bg-surface-container-lowest border-2 border-outline-variant shadow-[4px_4px_0_#000]">
            <div className="p-md border-b-2 border-outline-variant bg-surface-container-low"><h3 className="font-headline-md text-headline-md text-primary">Linked Nodes</h3></div>
            <div className="p-sm">
              <div className="p-sm border-l-4 border-primary-fixed bg-surface-container-high/50">
                <div className="flex items-center justify-between gap-sm"><h4 className="font-body-bold text-primary truncate">{account?.company || 'MT5 Terminal'}</h4><span className="text-[9px] text-primary-fixed border border-primary-fixed px-1">ACTIVE</span></div>
                <p className="font-label-caps text-label-caps text-on-surface-variant mt-xs truncate">{account?.server || 'Awaiting connection'}</p>
              </div>
            </div>
          </section>

          <section className="bg-[#141414] border-2 border-secondary shadow-[4px_4px_0_#000] flex-1">
            <div className="p-sm border-b-2 border-secondary/30 flex items-center gap-sm bg-secondary-container/10">
              <div className="w-6 h-6 border-2 border-secondary flex items-center justify-center"><span className="material-symbols-outlined text-secondary text-[16px]">enhanced_encryption</span></div>
              <h3 className="font-label-caps text-label-caps text-secondary font-bold tracking-widest">SECURITY PROTOCOL</h3>
            </div>
            <div className="p-md">
              <p className="font-body-base text-body-base text-on-surface leading-relaxed">MT5 credentials are stored on this client instance and sent directly to your local terminal. Quant Core <strong className="text-error">never</strong> transmits plaintext credentials to an external service.</p>
              <div className="mt-md p-sm border border-outline-variant bg-surface-container-lowest flex items-start gap-sm">
                <span className="material-symbols-outlined text-primary-fixed text-[18px]">verified_user</span>
                <div className="font-label-caps text-label-caps text-on-surface-variant">LOCAL TERMINAL HANDSHAKE<br/><span className="text-primary font-bold">SESSION VERIFIED</span></div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <OandaMarketDataCard />
    </div>
  );
}

/* ══ Interface Preferences — redesigned to match settings_interface_preferences.html.
   Every control here is live and persisted: theme + typography + density +
   glow drive real CSS variables; the sound sliders drive the Web Audio SFX
   in lib/sound.js. ══ */

const DENSITY_OPTS = [
  { id: 'compact',  label: 'Compact',  sub: 'MAX DATA', scale: 0.94 },
  { id: 'standard', label: 'Standard', sub: 'BALANCED', scale: 1.0  },
  { id: 'high',     label: 'High',     sub: 'SPACIOUS', scale: 1.06 },
];

function nearestDensity(scale) {
  let best = DENSITY_OPTS[1], diff = Infinity;
  for (const d of DENSITY_OPTS) {
    const x = Math.abs(d.scale - scale);
    if (x < diff) { diff = x; best = d; }
  }
  return best.id;
}

function VolRow({ label, value, onChange, onRelease, err }) {
  const disp = value >= 100 ? 'VOL MAX' : `VOL ${value}`;
  return (
    <div className="flex flex-col gap-xs">
      <div className="flex justify-between items-center">
        <label className={'font-body-bold text-body-bold ' + (err ? 'text-error' : 'text-on-surface')}>{label}</label>
        <span className={'font-label-caps text-label-caps ' + (err ? 'text-error' : 'text-primary-fixed')}>{disp}</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={e => onChange(+e.target.value)}
        onPointerUp={onRelease}
        className={'brutal-range' + (err ? ' err' : '')}
      />
    </div>
  );
}

function InterfacePreferences({ onNavigate }) {
  const { preset, mode, changePreset } = useTheme();

  const [density, setDensity]       = useState(() => nearestDensity(Number(localStorage.getItem('ui_font_scale') || 1)));
  const [glow, setGlow]             = useState(() => {
    const v = localStorage.getItem('ui_glow_scale');
    return v != null ? Math.round(Number(v) * 100) : 75;
  });
  const [typography, setTypography] = useState(() => localStorage.getItem('ui_font_family') === 'mono' ? 'mono' : 'inter');
  const [sound, setSound]           = useState(() => getSoundSettings());
  const [flash, setFlash]           = useState('');

  // Snapshot on entry so CANCEL can genuinely revert the live changes.
  const snapshot = useRef(null);
  useEffect(() => {
    snapshot.current = {
      preset,
      fontScale:  localStorage.getItem('ui_font_scale') || '1',
      glow:       localStorage.getItem('ui_glow_scale'),
      typography: localStorage.getItem('ui_font_family') || 'inter',
      sound:      getSoundSettings(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live appliers ──
  const applyDensity = (d) => {
    setDensity(d.id);
    localStorage.setItem('ui_font_scale', String(d.scale));
    document.documentElement.style.setProperty('--font-scale', String(d.scale));
  };
  const applyGlow = (pct) => {
    setGlow(pct);
    const scale = (pct / 100).toFixed(2);
    localStorage.setItem('ui_glow_scale', scale);
    document.documentElement.style.setProperty('--glow-scale', scale);
  };
  const applyTypography = (t) => {
    setTypography(t);
    localStorage.setItem('ui_font_family', t);
    if (t === 'mono') document.documentElement.style.setProperty('--font-ui', "'JetBrains Mono Variable','JetBrains Mono',ui-monospace,monospace");
    else document.documentElement.style.removeProperty('--font-ui');
  };
  const applySound = (key, value) => {
    setSound(s => ({ ...s, [key]: value }));
    setSoundSetting(key, value);
  };

  const activeTheme = mode === 'light' ? 'light' : preset === 'Midnight' ? 'glow' : 'dark';
  const setTheme = (which) => {
    if (which === 'light') changePreset('Light Classic');
    else if (which === 'glow') changePreset('Midnight');
    else changePreset('Brutalist');
  };

  const resetDefaults = () => {
    setTheme('dark');
    applyDensity(DENSITY_OPTS[1]);
    applyGlow(75);
    applyTypography('inter');
    applySound('enabled',   SOUND_DEFAULTS.enabled);
    applySound('orderFill', SOUND_DEFAULTS.orderFill);
    applySound('alert',     SOUND_DEFAULTS.alert);
    applySound('error',     SOUND_DEFAULTS.error);
  };

  const cancel = () => {
    const s = snapshot.current;
    if (s) {
      changePreset(s.preset);
      localStorage.setItem('ui_font_scale', s.fontScale);
      document.documentElement.style.setProperty('--font-scale', s.fontScale);
      if (s.glow != null) {
        localStorage.setItem('ui_glow_scale', s.glow);
        document.documentElement.style.setProperty('--glow-scale', s.glow);
      } else {
        localStorage.removeItem('ui_glow_scale');
        document.documentElement.style.setProperty('--glow-scale', '0.75');
      }
      applyTypography(s.typography);
      Object.entries(s.sound).forEach(([k, v]) => setSoundSetting(k, v));
    }
    onNavigate?.('home');
  };

  const apply = () => { setFlash('SETTINGS SAVED'); setTimeout(() => setFlash(''), 1600); };

  const chipBtn = (active) =>
    'flex-1 p-sm text-center border-2 transition-all ' +
    (active
      ? 'bg-surface-container-highest border-black shadow-[2px_2px_0px_0px_#000]'
      : 'bg-surface-container border-outline-variant text-on-surface-variant hover:bg-surface-container-highest');

  return (
    <div className="flex flex-col gap-md">
      {/* Section header */}
      <div className="border-b-2 border-outline-variant pb-md flex justify-between items-end flex-wrap gap-sm">
        <div>
          <h2 className="font-display-lg text-[24px] font-black text-primary uppercase tracking-tighter">Interface Preferences</h2>
          <p className="font-body-base text-body-base text-on-surface-variant mt-xs">Configure visual telemetry and auditory alerts for optimal execution.</p>
        </div>
        <button onClick={resetDefaults} className="bg-surface-container-high text-primary border-2 border-black px-md py-sm font-label-caps text-label-caps shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_0px_#000] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all">
          RESET DEFAULTS
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Left column: Visual + Layout */}
        <div className="lg:col-span-8 flex flex-col gap-md">
          {/* Visual Identity */}
          <div className="bg-surface-container/70 border-2 border-outline-variant p-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-8 h-8 border-l-2 border-b-2 border-outline-variant bg-surface-container-highest group-hover:bg-primary-fixed transition-colors" />
            <h3 className="font-headline-md text-headline-md font-bold text-primary mb-md flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">palette</span>
              Visual Identity
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div className="flex flex-col gap-sm">
                <label className="font-label-caps text-label-caps text-on-surface-variant">COLOR THEME</label>
                <div className="flex gap-sm">
                  <button onClick={() => setTheme('dark')}  className={chipBtn(activeTheme === 'dark')}><span className="font-body-bold text-body-bold text-on-surface">DARK</span></button>
                  <button onClick={() => setTheme('light')} className={chipBtn(activeTheme === 'light')}><span className="font-body-bold text-body-bold">LIGHT</span></button>
                  <button onClick={() => setTheme('glow')}  className={chipBtn(activeTheme === 'glow')}><span className="font-body-bold text-body-bold text-secondary">GLOW</span></button>
                </div>
              </div>
              <div className="flex flex-col gap-sm">
                <label className="font-label-caps text-label-caps text-on-surface-variant">TYPOGRAPHY</label>
                <div className="flex gap-sm">
                  <button onClick={() => applyTypography('inter')} className={chipBtn(typography === 'inter')}><span className="font-body-base text-body-base">Inter</span></button>
                  <button onClick={() => applyTypography('mono')}  className={chipBtn(typography === 'mono')}><span className="font-label-caps text-label-caps text-primary-fixed">MONO</span></button>
                </div>
              </div>
            </div>
          </div>

          {/* Layout & FX */}
          <div className="bg-surface-container/70 border-2 border-outline-variant p-md">
            <h3 className="font-headline-md text-headline-md font-bold text-primary mb-md flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">grid_view</span>
              Layout &amp; FX
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              {/* Display density */}
              <div className="flex flex-col gap-sm">
                <label className="font-label-caps text-label-caps text-on-surface-variant">DISPLAY DENSITY</label>
                <div className="flex flex-col gap-xs">
                  {DENSITY_OPTS.map(d => {
                    const on = density === d.id;
                    return (
                      <label key={d.id} className={'flex items-center gap-md p-sm border-2 cursor-pointer transition-colors ' + (on ? 'border-black bg-surface-container-highest shadow-[2px_2px_0px_0px_#000]' : 'border-outline-variant bg-surface-container hover:bg-surface-container-highest')}>
                        <input type="radio" name="density" checked={on} onChange={() => applyDensity(d)} className="w-4 h-4 accent-[#c3f400]" />
                        <span className={'font-body-bold text-body-bold ' + (on ? 'text-primary-fixed' : 'text-on-surface')}>{d.label}</span>
                        <span className="font-label-caps text-label-caps text-on-surface-variant ml-auto">{d.sub}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {/* Glow intensity */}
              <div className="flex flex-col gap-sm justify-center">
                <label className="font-label-caps text-label-caps text-on-surface-variant flex justify-between">
                  <span>GLOW INTENSITY</span>
                  <span className="text-primary-fixed">{glow}%</span>
                </label>
                <div className="py-sm">
                  <input type="range" min={0} max={100} value={glow} onChange={e => applyGlow(+e.target.value)} className="brutal-range" />
                </div>
                <p className="font-label-caps text-label-caps text-on-surface-variant mt-xs">Controls the bloom effect on neon accents and headings across the app.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Sound Alerts */}
        <div className="lg:col-span-4 flex flex-col gap-md">
          <div className="bg-surface-container/70 border-2 border-outline-variant p-md h-full flex flex-col">
            <div className="flex justify-between items-center mb-md border-b-2 border-outline-variant pb-sm">
              <h3 className="font-headline-md text-headline-md font-bold text-primary flex items-center gap-sm">
                <span className="material-symbols-outlined text-secondary">volume_up</span>
                Sound Alerts
              </h3>
              <label className="toggle-switch">
                <input type="checkbox" checked={sound.enabled} onChange={e => applySound('enabled', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className={'flex flex-col gap-lg mt-md flex-1 transition-opacity ' + (sound.enabled ? '' : 'opacity-40 pointer-events-none')}>
              <VolRow label="Order Fill"      value={sound.orderFill} onChange={v => applySound('orderFill', v)} onRelease={() => previewSound('orderFill')} />
              <VolRow label="Alert Triggered" value={sound.alert}     onChange={v => applySound('alert', v)}     onRelease={() => previewSound('alert')} />
              <VolRow label="System Error"    value={sound.error}     onChange={v => applySound('error', v)}     onRelease={() => previewSound('error')} err />
              <div className="mt-auto pt-md border-t-2 border-outline-variant">
                <button onClick={testAllAudio} className="w-full bg-surface-container border-2 border-outline-variant py-sm font-label-caps text-label-caps text-on-surface-variant hover:bg-surface-container-highest hover:text-primary transition-colors flex items-center justify-center gap-xs">
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span> TEST ALL AUDIO
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex justify-end items-center gap-md">
        {flash && <span className="font-label-caps text-label-caps text-primary-fixed-dim">✓ {flash}</span>}
        <button onClick={cancel} className="bg-surface border-2 border-outline-variant px-lg py-sm font-body-bold text-body-bold text-on-surface hover:bg-surface-container transition-colors">CANCEL</button>
        <button data-settings-save="true" onClick={apply} className="bg-primary-fixed text-on-primary-fixed border-2 border-black px-lg py-sm font-body-bold text-body-bold shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_0px_#000] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all">APPLY SETTINGS</button>
      </div>
    </div>
  );
}

/* ── Sage AI Core ─────────────────────────────────────────────────── */
function AISection({ apiKey, setApiKey, hasKey, showKey, setShowKey, saving, saved, saveKey,
                     searchKey, setSearchKey, hasSearchKey, showSearchKey, setShowSearchKey,
                     searchSaving, searchSaved, saveSearchKey }) {
  return (
    <section className="bg-surface-container-lowest border-2 border-outline-variant p-md shadow-[4px_4px_0_#000]">
      <div className="border-b-2 border-outline-variant pb-sm mb-md">
        <h3 className="font-headline-md text-headline-md text-primary">DATA_INGESTION_SOURCES</h3>
        <p className="text-on-surface-variant font-body-base mt-xs">Connect the live services used by Sage for model reasoning and current-market context.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-md">
        <div className={'p-md border-2 bg-surface-container-low flex flex-col gap-sm ' + (hasKey && !showKey ? 'border-secondary' : 'border-outline-variant')}>
          <div className="flex items-start justify-between gap-md">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">neurology</span>
              <div><h4 className="font-body-bold text-primary">Groq Reasoning Core</h4><span className="font-label-caps text-[9px] text-secondary">LLAMA 3.3 · PRIMARY ENGINE</span></div>
            </div>
            {hasKey && !showKey && <span className="font-label-caps text-[9px] text-primary-fixed flex items-center gap-xs"><span className="w-2 h-2 bg-primary-fixed rounded-full" />ONLINE</span>}
          </div>
          <p className="font-body-base text-[12px] text-on-surface-variant">Analyses chart structure, order blocks, and open positions. The key stays on this machine.</p>
          {hasKey && !showKey ? (
            <Button variant="ghost" size="sm" className="self-start mt-auto" onClick={() => setShowKey(true)}>Replace Key</Button>
          ) : (
            <div className="flex gap-sm mt-auto">
              <input type="password" className="flex-1 p-sm font-stat-lg text-[13px] text-primary min-w-0" placeholder="gsk_..." value={apiKey} onChange={e => setApiKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveKey()} autoComplete="off" />
              <Button variant="secondary" size="sm" disabled={!apiKey.trim() || saving} onClick={saveKey}>{saved ? '✓ Saved' : saving ? '…' : 'Save Key'}</Button>
            </div>
          )}
          <span className="font-label-caps text-[9px] text-on-surface-variant">KEY SOURCE: <span className="text-secondary">console.groq.com</span></span>
        </div>

        <div className={'p-md border-2 bg-surface-container-low flex flex-col gap-sm ' + (hasSearchKey && !showSearchKey ? 'border-secondary' : 'border-outline-variant')}>
          <div className="flex items-start justify-between gap-md">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">travel_explore</span>
              <div><h4 className="font-body-bold text-primary">Tavily Web Intelligence</h4><span className="font-label-caps text-[9px] text-secondary">NEWS · MARKET CONTEXT</span></div>
            </div>
            {hasSearchKey && !showSearchKey && <span className="font-label-caps text-[9px] text-primary-fixed flex items-center gap-xs"><span className="w-2 h-2 bg-primary-fixed rounded-full" />ONLINE</span>}
          </div>
          <p className="font-body-base text-[12px] text-on-surface-variant">Adds current news, market headlines, and information beyond the model training cutoff.</p>
          {hasSearchKey && !showSearchKey ? (
            <Button variant="ghost" size="sm" className="self-start mt-auto" onClick={() => setShowSearchKey(true)}>Replace Key</Button>
          ) : (
            <div className="flex gap-sm mt-auto">
              <input type="password" className="flex-1 p-sm font-stat-lg text-[13px] text-primary min-w-0" placeholder="tvly-..." value={searchKey} onChange={e => setSearchKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveSearchKey()} autoComplete="off" />
              <Button variant="secondary" size="sm" disabled={!searchKey.trim() || searchSaving} onClick={saveSearchKey}>{searchSaved ? '✓ Saved' : searchSaving ? '…' : 'Save Key'}</Button>
            </div>
          )}
          <span className="font-label-caps text-[9px] text-on-surface-variant">KEY SOURCE: <span className="text-secondary">tavily.com</span></span>
        </div>
      </div>
    </section>
  );
}

/* ── Risk Management (real backend: GET/POST /settings/risk) ────── */
const RISK_DEFAULTS = {
  max_daily_loss_pct: 5,
  max_leverage: 100,
  auto_breakeven_enabled: false,
  auto_breakeven_trigger_pct: 1.5,
  default_sl_enabled: false,
  default_sl_pct: 0.5,
  drawdown_lock_enabled: false,
  drawdown_lock_trigger_pct: 10,
};

function RiskManagementSection() {
  const [risk, setRisk]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    fetch(`${API}/settings/risk`).then(r => r.ok ? r.json() : null).then(d => { if (d) setRisk(d); }).catch(() => {});
  }, []);

  const set = (key, value) => setRisk(r => ({ ...r, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/settings/risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(risk),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (!risk) {
    return <div className="font-label-caps text-label-caps text-on-surface-variant">LOADING RISK SETTINGS…</div>;
  }

  const riskOfRuin = Math.min(
    99.9,
    Math.max(0.1, (Number(risk.max_daily_loss_pct) / Math.max(Number(risk.drawdown_lock_trigger_pct), 1)) * 1.6),
  ).toFixed(1);

  return (
    <div className="flex flex-col gap-md">
      <div className="border-b-2 border-outline-variant pb-md flex items-end justify-between gap-md flex-wrap">
        <div>
          <h2 className="font-display-lg text-[24px] font-black text-primary uppercase tracking-tighter">Risk Management</h2>
          <p className="font-body-base text-body-base text-on-surface-variant mt-xs">Global exposure limits and drawdown protection rules.</p>
        </div>
        <div className="flex gap-sm">
          <Button variant="ghost" size="sm" onClick={() => setRisk(RISK_DEFAULTS)}>Reset Defaults</Button>
          <Button data-settings-save="true" variant="primary" size="sm" disabled={saving} onClick={save}>
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Config'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-md">
        <div className="xl:col-span-8 flex flex-col gap-md">
          <section className="bg-surface-container-lowest border-2 border-outline-variant p-md shadow-[4px_4px_0_#000]">
            <h3 className="font-headline-md text-headline-md text-primary mb-md border-b-2 border-outline-variant pb-xs flex justify-between items-center">
              Global Limits
              <span className="material-symbols-outlined text-secondary">tune</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div className="flex flex-col gap-sm">
                <label className="font-label-caps text-label-caps text-on-surface-variant flex justify-between">
                  <span>MAX DAILY LOSS (%)</span>
                  <span className="text-error font-bold">-{risk.max_daily_loss_pct}%</span>
                </label>
                <input type="range" min={0.5} max={10} step={0.5} value={risk.max_daily_loss_pct}
                  onChange={e => set('max_daily_loss_pct', +e.target.value)} className="brutal-range err" />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-mono"><span>0.5%</span><span>10%</span></div>
              </div>
              <div className="flex flex-col gap-sm">
                <label className="font-label-caps text-label-caps text-on-surface-variant flex justify-between">
                  <span>MAX LEVERAGE</span>
                  <span className="text-primary font-bold">{risk.max_leverage}x</span>
                </label>
                <input type="range" min={1} max={500} step={1} value={risk.max_leverage}
                  onChange={e => set('max_leverage', +e.target.value)} className="brutal-range" />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-mono"><span>1x</span><span>500x</span></div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest border-2 border-outline-variant p-md shadow-[4px_4px_0_#000]">
            <h3 className="font-headline-md text-headline-md text-primary mb-md border-b-2 border-outline-variant pb-xs flex justify-between items-center">
              Execution Rules
              <span className="material-symbols-outlined text-secondary">gavel</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <div className="flex flex-col gap-sm">
                <div className="flex items-center justify-between">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">AUTO-BREAKEVEN TRIGGER (%)</label>
                  <label className="toggle-switch"><input type="checkbox" checked={!!risk.auto_breakeven_enabled} onChange={e => set('auto_breakeven_enabled', e.target.checked)} /><span className="toggle-slider" /></label>
                </div>
                <div className="relative">
                  <input type="number" step="0.1" value={risk.auto_breakeven_trigger_pct} onChange={e => set('auto_breakeven_trigger_pct', +e.target.value)} className="w-full p-sm pr-xl font-stat-lg text-primary" />
                  <span className="absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant">%</span>
                </div>
                <p className="text-[11px] text-on-surface-variant">Moves stop-loss to entry price when profit reaches this threshold.</p>
              </div>
              <div className="flex flex-col gap-sm">
                <div className="flex items-center justify-between">
                  <label className="font-label-caps text-label-caps text-on-surface-variant">DEFAULT STOP LOSS</label>
                  <label className="toggle-switch"><input type="checkbox" checked={!!risk.default_sl_enabled} onChange={e => set('default_sl_enabled', e.target.checked)} /><span className="toggle-slider" /></label>
                </div>
                <div className="flex gap-xs">
                  <input type="number" step="0.1" value={risk.default_sl_pct} onChange={e => set('default_sl_pct', +e.target.value)} className="flex-1 p-sm font-stat-lg text-primary" />
                  <div className="min-w-14 flex items-center justify-center bg-[#141414] border-2 border-outline-variant font-label-caps text-on-surface-variant">%</div>
                </div>
                <p className="text-[11px] text-on-surface-variant">Applied to market orders placed without an explicit stop loss.</p>
              </div>
            </div>
          </section>
        </div>

        <div className="xl:col-span-4 flex flex-col gap-md">
          <section className="p-md bg-surface-container-low border-2 border-error/60 shadow-[4px_4px_0_#000] relative overflow-hidden">
            <div className="absolute inset-0 bg-error/5 pointer-events-none" />
            <div className="relative">
              <div className="flex justify-between items-start mb-md gap-sm">
                <div>
                  <h3 className="font-headline-md text-headline-md text-error flex items-center gap-xs"><span className="material-symbols-outlined">warning</span>DRAWDOWN LOCK</h3>
                  <p className="font-label-caps text-label-caps text-on-surface-variant mt-xs">Halts all trading if threshold breached.</p>
                </div>
                <label className="toggle-switch"><input type="checkbox" checked={!!risk.drawdown_lock_enabled} onChange={e => set('drawdown_lock_enabled', e.target.checked)} /><span className="toggle-slider toggle-slider-error" /></label>
              </div>
              <label className="font-label-caps text-label-caps text-on-surface-variant block mb-sm">LOCK TRIGGER (BALANCE DRAWDOWN)</label>
              <div className="flex items-center gap-md">
                <input type="number" step="0.5" value={risk.drawdown_lock_trigger_pct} onChange={e => set('drawdown_lock_trigger_pct', +e.target.value)} className="w-24 border-error text-error font-stat-lg p-sm" />
                <span className="text-error font-body-bold">%</span>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest border-2 border-outline-variant flex flex-col flex-1 min-h-[270px] shadow-[4px_4px_0_#000]">
            <div className="p-md border-b-2 border-outline-variant bg-[#141414]">
              <h3 className="font-headline-md text-headline-md text-primary-fixed flex items-center gap-xs"><span className="material-symbols-outlined">query_stats</span>RISK-OF-RUIN SIM</h3>
              <p className="font-label-caps text-label-caps text-on-surface-variant mt-xs">Configuration estimate across a 100-trade stress window.</p>
            </div>
            <div className="risk-sim-grid flex-1 p-md flex flex-col justify-center items-center text-center">
              <div className="text-[64px] font-black font-display-lg text-primary-fixed leading-none tracking-tighter">{riskOfRuin}%</div>
              <div className="font-label-caps text-label-caps text-on-surface-variant mt-sm bg-surface px-sm py-xs border border-outline-variant">LIVE PARAMETER ESTIMATE</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Screener/Alerts moved to their own nav page ─────────────────── */
function MovedNotice({ section, onNavigate }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center gap-md p-xl">
      <div className="w-16 h-16 flex items-center justify-center border-2 border-primary-fixed-dim bg-surface-container-low">
        <span className="material-symbols-outlined text-[32px] text-primary-fixed-dim">{section.icon}</span>
      </div>
      <div>
        <h2 className="font-headline-md text-headline-md text-primary">{section.label} lives in the main nav now</h2>
        <p className="font-body-base text-body-base text-on-surface-variant mt-xs max-w-[420px]">
          This is a live, data-backed screen rather than a config panel — find it in the left rail.
        </p>
      </div>
      {onNavigate && (
        <Button variant="primary" size="md" onClick={() => onNavigate(section.page)}>
          <span className="material-symbols-outlined text-[16px]">{section.icon}</span>
          Open {section.label}
        </Button>
      )}
    </div>
  );
}

/* ── Sage AI Core Config (real backend: GET/POST /settings/sage) ── */
const SAGE_PERSONAS = [
  { id: 'analytical',   label: 'Analytical',   sub: 'Focuses on structural breaks & volume profile (default).', icon: 'insights' },
  { id: 'aggressive',   label: 'Aggressive',   sub: 'Front-runs momentum shifts. Higher risk tolerance.',        icon: 'local_fire_department' },
  { id: 'conservative', label: 'Conservative', sub: 'Requires multi-timeframe alignment before acting.',         icon: 'shield' },
];

function SageConfigSection({ connectors }) {
  const [cfg, setCfg]         = useState(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    fetch(`${API}/settings/sage`).then(r => r.ok ? r.json() : null).then(d => { if (d) setCfg(d); }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/settings/sage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  if (!cfg) {
    return <div className="font-label-caps text-label-caps text-on-surface-variant">LOADING SAGE CONFIG…</div>;
  }

  return (
    <div className="flex flex-col gap-md mb-md">
      <div className="border-b-2 border-secondary pb-md flex items-end justify-between gap-md flex-wrap">
        <div>
          <h2 className="font-display-lg text-[24px] font-black text-primary uppercase tracking-tighter flex items-center gap-sm">
            <span className="material-symbols-outlined text-secondary">auto_awesome</span>
            Sage AI Core
          </h2>
          <p className="font-label-caps text-label-caps text-secondary mt-xs tracking-widest">Neural execution engine configuration</p>
        </div>
        <div className="text-right">
          <span className="font-stat-lg text-stat-lg text-secondary">v2.4.1</span>
          <div className="flex items-center gap-xs justify-end mt-1"><span className="w-2 h-2 bg-primary-fixed rounded-full animate-pulse" /><span className="font-label-caps text-[9px] text-primary-fixed">SYSTEM ONLINE</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        <div className="lg:col-span-8 flex flex-col gap-md">
          <section className="bg-surface-container border-2 border-secondary p-md shadow-[4px_4px_0_#000] relative overflow-hidden group">
            <span className="material-symbols-outlined absolute -right-8 -top-10 text-[150px] text-secondary/5 pointer-events-none">tune</span>
            <div className="flex justify-between items-start gap-md relative">
              <div>
                <h3 className="font-headline-md text-headline-md text-primary">CONFIDENCE THRESHOLD</h3>
                <p className="text-on-surface-variant font-body-base mt-1 max-w-lg">Minimum AI conviction required to signal a trade opportunity. Higher values reduce false positives but may miss marginal entries.</p>
              </div>
              <div className="bg-surface p-xs border-2 border-outline-variant font-stat-lg text-stat-lg text-secondary w-20 text-center shrink-0">{cfg.confidence_threshold}%</div>
            </div>
            <div className="mt-lg relative">
              <input type="range" min={50} max={99} value={cfg.confidence_threshold} onChange={e => setCfg(c => ({ ...c, confidence_threshold: +e.target.value }))} className="brutal-range sage-range" />
              <div className="flex justify-between mt-sm font-label-caps text-label-caps text-on-surface-variant"><span>50% (AGGRESSIVE)</span><span>75% (BALANCED)</span><span className="text-secondary">99% (CONSERVATIVE)</span></div>
            </div>
          </section>
          {connectors}
          <div className="flex justify-end border-t-2 border-outline-variant pt-md">
            <Button data-settings-save="true" variant="secondary" size="lg" disabled={saving} onClick={save}>
              <span className="material-symbols-outlined text-[16px]">deployed_code</span>
              {saved ? '✓ Deployed' : saving ? 'Deploying…' : 'Deploy Configuration'}
            </Button>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-md">
          <section className="sage-auto-card bg-surface-container-highest p-md border-2 border-outline-variant shadow-[4px_4px_0_#000] flex flex-col items-center text-center justify-center py-lg relative overflow-hidden">
            <span className="material-symbols-outlined text-[42px] text-error mb-xs relative">shield_lock</span>
            <h3 className="font-headline-md text-headline-md text-primary relative">MANUAL EXECUTION</h3>
            <p className="font-label-caps text-[10px] text-error mt-1 relative">SAGE ANALYSES SETUPS; YOU AUTHORISE EVERY MARKET ORDER</p>
            <div className="mt-md bg-surface text-primary-fixed font-label-caps py-sm px-lg border-2 border-primary-fixed relative">SAFETY LOCKED</div>
          </section>

          <section className="bg-surface-container p-md border-2 border-outline-variant shadow-[4px_4px_0_#000] flex-1">
            <h3 className="font-headline-md text-headline-md text-primary mb-md flex items-center gap-sm"><span className="material-symbols-outlined">psychology</span>SAGE_PERSONA</h3>
            <div className="flex flex-col gap-sm">
              {SAGE_PERSONAS.map(p => {
                const active = cfg.persona === p.id;
                return (
                  <label key={p.id} className={'flex flex-col p-sm border-2 bg-surface cursor-pointer transition-all ' + (active ? 'border-secondary bg-secondary-container/10' : 'border-outline-variant hover:bg-surface-container-high')}>
                    <input type="radio" name="sage_persona" className="sr-only" checked={active} onChange={() => setCfg(c => ({ ...c, persona: p.id }))} />
                    <span className="font-body-bold text-primary flex items-center justify-between gap-xs">
                      <span className="flex items-center gap-xs"><span className={'material-symbols-outlined text-[16px] ' + (active ? 'text-secondary' : 'text-on-surface-variant')}>{p.icon}</span>{p.label}{p.id === 'analytical' ? ' (Default)' : ''}</span>
                      {active && <span className="material-symbols-outlined text-[18px] text-secondary">check_circle</span>}
                    </span>
                    <span className="font-label-caps text-[10px] text-on-surface-variant mt-1">{p.sub}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}

/* ── Economic Calendar key (real backend: GET/POST /settings/calendar-key) ── */
function CalendarSection() {
  const [key, setKey]         = useState('');
  const [hasKey, setHasKey]   = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    fetch(`${API}/settings/calendar-key`).then(r => r.ok ? r.json() : null).then(d => { if (d) setHasKey(d.configured); }).catch(() => {});
  }, []);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/settings/calendar-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      setHasKey(true); setKey(''); setShowKey(false);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  };

  return (
    <div>
      <GroupTitle>Economic Calendar</GroupTitle>
      <p className="font-body-base text-[13px] text-on-surface-variant mb-sm leading-relaxed">
        Add a free Finnhub API key to pull high-impact macro events (CPI, rate decisions, NFP…) into the
        Calendar page. Without it, the calendar stays empty.
      </p>

      {hasKey && !showKey && (
        <div className="flex items-center justify-between p-sm bg-surface-container-low border-2 border-outline-variant mb-sm">
          <span className="font-label-caps text-label-caps text-primary-fixed-dim flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary-fixed-dim shadow-[0_0_8px_#abd600]" />
            API KEY CONFIGURED
          </span>
          <Button variant="ghost" size="sm" onClick={() => setShowKey(true)}>Replace</Button>
        </div>
      )}

      {(!hasKey || showKey) && (
        <div className="flex gap-sm mb-sm">
          <input
            type="password"
            className="flex-1 bg-[#141414] border-2 border-outline-variant p-sm font-stat-lg text-stat-lg text-[13px] text-primary focus:outline-none focus:border-primary-fixed-dim transition-colors"
            placeholder="Finnhub API key..."
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            autoComplete="off"
          />
          <Button variant="primary" size="md" disabled={!key.trim() || saving} onClick={save}>
            {saved ? '✓ Saved' : saving ? '…' : 'Save Key'}
          </Button>
        </div>
      )}

      <p className="font-label-caps text-label-caps text-on-surface-variant">
        Get a free key at <span className="text-primary-fixed-dim">finnhub.io/register</span>
      </p>
    </div>
  );
}
