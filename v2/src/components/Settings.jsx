import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Button from './Button';
import {
  getSoundSettings, setSoundSetting, previewSound, testAllAudio, SOUND_DEFAULTS,
} from '../lib/sound';

const API = 'http://127.0.0.1:8000';

const SECTIONS = [
  { id: 'account',    label: 'Account & API',         icon: 'key' },
  { id: 'appearance', label: 'Interface Preferences',  icon: 'palette' },
  { id: 'ai',         label: 'Sage AI Core',           icon: 'auto_awesome' },
  { id: 'risk',       label: 'Risk Management',        icon: 'warning' },
  { id: 'screener',   label: 'Asset Screener',         icon: 'troubleshoot' },
  { id: 'alerts',     label: 'Alerts & Notifications', icon: 'notifications_active' },
  { id: 'calendar',   label: 'Economic Calendar',      icon: 'event' },
];

// Sections that moved to their own full nav page instead of living in Settings
const MOVED_SECTIONS = {
  screener: { label: 'Asset Screener',         page: 'screener', icon: 'troubleshoot' },
  alerts:   { label: 'Alerts & Notifications', page: 'alerts',   icon: 'notifications_active' },
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
    <div className="flex-1 flex flex-col gap-md p-md overflow-hidden min-h-0">
      <div className="flex items-center justify-between border-b-2 border-outline-variant pb-xs shrink-0">
        <h1 className="font-display-lg text-[32px] font-black text-primary uppercase glow-text-primary tracking-tighter">Settings</h1>
      </div>

      <div className="flex-1 flex gap-md overflow-hidden min-h-0">
        {/* Sub-nav */}
        <div className="w-56 shrink-0 flex flex-col gap-xs overflow-y-auto">
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
        <div className="flex-1 overflow-y-auto min-h-0 glass-panel p-md">
          {section === 'account' && <AccountApiSection account={account} onLogout={onLogout} />}
          {section === 'appearance' && <InterfacePreferences onNavigate={onNavigate} />}
          {section === 'ai' && (
            <>
              <SageConfigSection />
              <AISection
                apiKey={apiKey} setApiKey={setApiKey} hasKey={hasKey}
                showKey={showKey} setShowKey={setShowKey}
                saving={saving} saved={saved} saveKey={saveKey}
                searchKey={searchKey} setSearchKey={setSearchKey} hasSearchKey={hasSearchKey}
                showSearchKey={showSearchKey} setShowSearchKey={setShowSearchKey}
                searchSaving={searchSaving} searchSaved={searchSaved} saveSearchKey={saveSearchKey}
              />
            </>
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
    <div>
      <GroupTitle>MT5 Connection</GroupTitle>
      {account ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-md mb-md">
            {rows.map(([label, val]) => (
              <div key={label} className="flex flex-col gap-xs p-sm bg-surface-container-low border-2 border-outline-variant">
                <span className="font-label-caps text-label-caps text-on-surface-variant">{label}</span>
                <span className="font-body-bold text-body-bold text-primary truncate">{val ?? '—'}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center p-sm bg-surface-container-low border-2 border-outline-variant">
            <div className="flex items-center gap-sm">
              <div className="w-2 h-2 rounded-full bg-primary-fixed-dim shadow-[0_0_8px_#abd600] animate-pulse" />
              <span className="font-stat-lg text-stat-lg text-[16px] text-primary-fixed-dim">CONNECTED</span>
            </div>
            <Button variant="danger" size="sm" onClick={onLogout}>Disconnect</Button>
          </div>
        </>
      ) : (
        <div className="p-md text-center font-label-caps text-label-caps text-on-surface-variant border-2 border-outline-variant bg-surface-container-low">
          NOT CONNECTED TO METATRADER 5
        </div>
      )}

      <p className="font-body-base text-[12px] text-on-surface-variant mt-md leading-relaxed">
        MT5 credentials are entered once during setup and stored locally by the terminal — Quant Core never
        transmits them anywhere. To switch accounts or brokers, disconnect and you'll be returned to the
        connection screen.
      </p>
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
        <button onClick={apply} className="bg-primary-fixed text-on-primary-fixed border-2 border-black px-lg py-sm font-body-bold text-body-bold shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_0px_#000] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all">APPLY SETTINGS</button>
      </div>
    </div>
  );
}

/* ── Sage AI Core ─────────────────────────────────────────────────── */
function AISection({ apiKey, setApiKey, hasKey, showKey, setShowKey, saving, saved, saveKey,
                     searchKey, setSearchKey, hasSearchKey, showSearchKey, setShowSearchKey,
                     searchSaving, searchSaved, saveSearchKey }) {
  return (
    <div>
      <div className="flex items-center gap-sm border-b-2 border-secondary pb-xs mb-sm">
        <div className="w-6 h-6 border-2 border-secondary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[16px] text-secondary">auto_awesome</span>
        </div>
        <h3 className="font-headline-md text-headline-md font-bold text-secondary">Groq API Key</h3>
      </div>
      <p className="font-body-base text-[13px] text-on-surface-variant mb-sm leading-relaxed">
        Sage uses Groq (Llama 3.3) to analyse your chart and answer questions about market structure,
        order blocks, and your open positions. Groq is free to use — your key is stored locally on this
        machine only.
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
            className="flex-1 bg-[#141414] border-2 border-outline-variant p-sm font-stat-lg text-stat-lg text-[13px] text-primary focus:outline-none focus:border-secondary transition-colors"
            placeholder="gsk_..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
            autoComplete="off"
          />
          <Button variant="secondary" size="md" disabled={!apiKey.trim() || saving} onClick={saveKey}>
            {saved ? '✓ Saved' : saving ? '…' : 'Save Key'}
          </Button>
        </div>
      )}

      <p className="font-label-caps text-label-caps text-on-surface-variant mb-lg">
        Get your free key at <span className="text-secondary">console.groq.com</span>
      </p>

      <div className="flex items-center gap-sm border-b-2 border-secondary pb-xs mb-sm">
        <div className="w-6 h-6 border-2 border-secondary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[16px] text-secondary">travel_explore</span>
        </div>
        <h3 className="font-headline-md text-headline-md font-bold text-secondary">Web Search (optional)</h3>
      </div>
      <p className="font-body-base text-[13px] text-on-surface-variant mb-sm leading-relaxed">
        Add a Tavily key to give Sage live web search — news, market headlines, and anything past its
        training cutoff. Without it, Sage still works from its own knowledge.
      </p>

      {hasSearchKey && !showSearchKey && (
        <div className="flex items-center justify-between p-sm bg-surface-container-low border-2 border-outline-variant mb-sm">
          <span className="font-label-caps text-label-caps text-primary-fixed-dim flex items-center gap-xs">
            <span className="w-2 h-2 rounded-full bg-primary-fixed-dim shadow-[0_0_8px_#abd600]" />
            WEB SEARCH ENABLED
          </span>
          <Button variant="ghost" size="sm" onClick={() => setShowSearchKey(true)}>Replace</Button>
        </div>
      )}

      {(!hasSearchKey || showSearchKey) && (
        <div className="flex gap-sm mb-sm">
          <input
            type="password"
            className="flex-1 bg-[#141414] border-2 border-outline-variant p-sm font-stat-lg text-stat-lg text-[13px] text-primary focus:outline-none focus:border-secondary transition-colors"
            placeholder="tvly-..."
            value={searchKey}
            onChange={e => setSearchKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveSearchKey()}
            autoComplete="off"
          />
          <Button variant="secondary" size="md" disabled={!searchKey.trim() || searchSaving} onClick={saveSearchKey}>
            {searchSaved ? '✓ Saved' : searchSaving ? '…' : 'Save Key'}
          </Button>
        </div>
      )}

      <p className="font-label-caps text-label-caps text-on-surface-variant">
        Get a free key at <span className="text-secondary">tavily.com</span>
      </p>
    </div>
  );
}

/* ── Risk Management (real backend: GET/POST /settings/risk) ────── */
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

  return (
    <div>
      <GroupTitle
        action={<Button variant="primary" size="sm" disabled={saving} onClick={save}>{saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Config'}</Button>}
      >
        Global Limits
      </GroupTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md mb-lg">
        <div className="flex flex-col gap-sm p-sm bg-surface-container-low border-2 border-outline-variant">
          <div className="flex justify-between items-center">
            <label className="font-label-caps text-label-caps text-on-surface-variant">MAX DAILY LOSS</label>
            <span className="font-stat-lg text-stat-lg text-error">-{risk.max_daily_loss_pct}%</span>
          </div>
          <input type="range" min={0.5} max={20} step={0.5} value={risk.max_daily_loss_pct}
            onChange={e => set('max_daily_loss_pct', +e.target.value)} className="w-full accent-[#c3f400]" />
          <p className="font-label-caps text-label-caps text-on-surface-variant">New trades are blocked once today's realised loss crosses this threshold.</p>
        </div>
        <div className="flex flex-col gap-sm p-sm bg-surface-container-low border-2 border-outline-variant">
          <div className="flex justify-between items-center">
            <label className="font-label-caps text-label-caps text-on-surface-variant">MAX LEVERAGE</label>
            <span className="font-stat-lg text-stat-lg text-primary">{risk.max_leverage}x</span>
          </div>
          <input type="range" min={1} max={500} step={1} value={risk.max_leverage}
            onChange={e => set('max_leverage', +e.target.value)} className="w-full accent-[#c3f400]" />
          <p className="font-label-caps text-label-caps text-on-surface-variant">Recorded for reference — actual leverage is broker-set on your MT5 account.</p>
        </div>
      </div>

      <GroupTitle>Execution Rules</GroupTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md mb-lg">
        <div className="flex flex-col gap-sm p-sm bg-surface-container-low border-2 border-outline-variant">
          <div className="flex justify-between items-center">
            <label className="font-label-caps text-label-caps text-on-surface-variant">AUTO-BREAKEVEN</label>
            <input type="checkbox" checked={!!risk.auto_breakeven_enabled} onChange={e => set('auto_breakeven_enabled', e.target.checked)}
              className="w-5 h-5 accent-[#c3f400]" />
          </div>
          <div className="flex items-center gap-sm mt-auto">
            <span className="font-body-base text-body-base text-on-surface-variant">Trigger at</span>
            <input type="number" step="0.1" value={risk.auto_breakeven_trigger_pct}
              onChange={e => set('auto_breakeven_trigger_pct', +e.target.value)}
              className="w-20 bg-[#141414] border-2 border-outline-variant text-right font-stat-lg text-primary p-xs focus:outline-none focus:border-primary-fixed-dim" />
            <span className="font-body-base text-body-base text-on-surface-variant">%</span>
          </div>
          <p className="font-label-caps text-label-caps text-on-surface-variant">Moves stop-loss to entry once profit reaches this move.</p>
        </div>
        <div className="flex flex-col gap-sm p-sm bg-surface-container-low border-2 border-outline-variant">
          <div className="flex justify-between items-center">
            <label className="font-label-caps text-label-caps text-on-surface-variant">DEFAULT STOP LOSS</label>
            <input type="checkbox" checked={!!risk.default_sl_enabled} onChange={e => set('default_sl_enabled', e.target.checked)}
              className="w-5 h-5 accent-[#c3f400]" />
          </div>
          <div className="flex items-center gap-sm mt-auto">
            <input type="number" step="0.1" value={risk.default_sl_pct}
              onChange={e => set('default_sl_pct', +e.target.value)}
              className="w-20 bg-[#141414] border-2 border-outline-variant text-right font-stat-lg text-primary p-xs focus:outline-none focus:border-primary-fixed-dim" />
            <span className="font-body-base text-body-base text-on-surface-variant">%</span>
          </div>
          <p className="font-label-caps text-label-caps text-on-surface-variant">Applied automatically to market orders placed without an explicit SL.</p>
        </div>
      </div>

      <GroupTitle>Drawdown Protection</GroupTitle>
      <div className="p-md bg-surface-container-low border-2 border-error/60">
        <div className="flex justify-between items-start mb-sm">
          <div>
            <h3 className="font-headline-md text-headline-md text-error flex items-center gap-xs">
              <span className="material-symbols-outlined">warning</span>
              DRAWDOWN LOCK
            </h3>
            <p className="font-label-caps text-label-caps text-on-surface-variant mt-xs">Halts new trades if balance drawdown breaches the trigger.</p>
          </div>
          <input type="checkbox" checked={!!risk.drawdown_lock_enabled} onChange={e => set('drawdown_lock_enabled', e.target.checked)}
            className="w-5 h-5 accent-[#ffb4ab]" />
        </div>
        <div className="flex items-center gap-md">
          <label className="font-label-caps text-label-caps text-on-surface-variant">LOCK TRIGGER</label>
          <input type="number" step="0.5" value={risk.drawdown_lock_trigger_pct}
            onChange={e => set('drawdown_lock_trigger_pct', +e.target.value)}
            className="w-20 bg-[#141414] border-2 border-error text-error text-right font-stat-lg p-xs focus:outline-none" />
          <span className="text-error font-body-bold">%</span>
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

function SageConfigSection() {
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
    <div>
      <GroupTitle
        action={<Button variant="secondary" size="sm" disabled={saving} onClick={save}>{saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Config'}</Button>}
      >
        Sage AI Core Config
      </GroupTitle>

      <div className="flex flex-col gap-sm p-sm bg-surface-container-low border-2 border-outline-variant mb-lg">
        <div className="flex justify-between items-center">
          <label className="font-label-caps text-label-caps text-on-surface-variant">CONFIDENCE THRESHOLD</label>
          <span className="font-stat-lg text-stat-lg text-secondary">{cfg.confidence_threshold}%</span>
        </div>
        <input
          type="range" min={50} max={99} value={cfg.confidence_threshold}
          onChange={e => setCfg(c => ({ ...c, confidence_threshold: +e.target.value }))}
          className="w-full accent-[#7701d0]"
        />
        <p className="font-body-base text-[12px] text-on-surface-variant">
          A setup Sage finds below this conviction is still explained in the analysis, but won't be marked
          as an actionable trade.
        </p>
      </div>

      <div className="flex flex-col gap-xs mb-sm">
        <label className="font-label-caps text-label-caps text-on-surface-variant mb-xs">SAGE PERSONA</label>
        {SAGE_PERSONAS.map(p => (
          <label
            key={p.id}
            className={
              'flex items-start gap-sm p-sm border-2 cursor-pointer transition-colors ' +
              (cfg.persona === p.id ? 'border-secondary bg-secondary-container/10' : 'border-outline-variant bg-surface-container hover:bg-surface-container-high')
            }
          >
            <input
              type="radio" name="sage_persona" className="mt-1 accent-[#7701d0]"
              checked={cfg.persona === p.id}
              onChange={() => setCfg(c => ({ ...c, persona: p.id }))}
            />
            <div className="flex flex-col">
              <span className="font-body-bold text-body-bold text-primary flex items-center gap-xs">
                <span className="material-symbols-outlined text-[16px] text-secondary">{p.icon}</span>
                {p.label}
              </span>
              <span className="font-label-caps text-label-caps text-on-surface-variant">{p.sub}</span>
            </div>
          </label>
        ))}
      </div>
      <p className="font-body-base text-[12px] text-on-surface-variant">
        The persona shapes how Sage talks about setups in chat and analysis — it doesn't place trades on its own.
      </p>
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
