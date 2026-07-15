import { useState, useEffect } from 'react';
import { PRESETS, DARK_PRESETS, LIGHT_PRESETS, EDITABLE_COLORS, useTheme } from '../contexts/ThemeContext';
import Button from './Button';
import Maintenance from './Maintenance';

const API = 'http://127.0.0.1:8000';

const SECTIONS = [
  { id: 'account',    label: 'Account & API',         icon: 'key' },
  { id: 'appearance', label: 'Interface Preferences',  icon: 'palette' },
  { id: 'chart',      label: 'Chart Style',            icon: 'candlestick_chart' },
  { id: 'ai',         label: 'Sage AI Core',           icon: 'auto_awesome' },
  { id: 'risk',       label: 'Risk Management',        icon: 'warning' },
  { id: 'screener',   label: 'Asset Screener',         icon: 'troubleshoot' },
  { id: 'alerts',     label: 'Alerts & Notifications', icon: 'notifications_active' },
  { id: 'calendar',   label: 'Economic Calendar',      icon: 'event' },
];

// Sections with a real backend behind them vs. maintenance placeholders
const PENDING_SECTIONS = {
  risk:     'RISK MANAGEMENT',
  screener: 'ASSET SCREENER',
  alerts:   'ALERTS & NOTIFICATIONS',
  calendar: 'ECONOMIC CALENDAR',
};

const FONT_OPTS = [
  { label: 'Small',  value: 0.88 },
  { label: 'Medium', value: 1.0  },
  { label: 'Large',  value: 1.15 },
  { label: 'XL',     value: 1.3  },
];

function GroupTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between border-b-2 border-outline-variant pb-xs mb-sm mt-lg first:mt-0">
      <h3 className="font-headline-md text-headline-md font-bold text-primary">{children}</h3>
      {action}
    </div>
  );
}

export default function Settings({ account, onLogout, onNavigateHome }) {
  const [section, setSection] = useState('account');
  const { preset, vars, overrides, changePreset, changeColor, resetOverrides } = useTheme();

  const [fontScale, setFontScale] = useState(
    () => Number(localStorage.getItem('ui_font_scale') || 1)
  );

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

  const applyFontScale = (scale) => {
    setFontScale(scale);
    localStorage.setItem('ui_font_scale', scale);
    document.documentElement.style.setProperty('--font-scale', scale);
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
          {section === 'appearance' && (
            <AppearanceSection
              preset={preset} vars={vars} overrides={overrides}
              changePreset={changePreset} changeColor={changeColor} resetOverrides={resetOverrides}
              fontScale={fontScale} applyFontScale={applyFontScale}
            />
          )}
          {section === 'chart' && <ChartSection />}
          {section === 'ai' && (
            <AISection
              apiKey={apiKey} setApiKey={setApiKey} hasKey={hasKey}
              showKey={showKey} setShowKey={setShowKey}
              saving={saving} saved={saved} saveKey={saveKey}
              searchKey={searchKey} setSearchKey={setSearchKey} hasSearchKey={hasSearchKey}
              showSearchKey={showSearchKey} setShowSearchKey={setShowSearchKey}
              searchSaving={searchSaving} searchSaved={searchSaved} saveSearchKey={saveSearchKey}
            />
          )}
          {PENDING_SECTIONS[section] && (
            <Maintenance label={PENDING_SECTIONS[section]} onReturn={onNavigateHome} />
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

/* ── Interface Preferences ───────────────────────────────────────── */
function AppearanceSection({ preset, vars, overrides, changePreset, changeColor, resetOverrides, fontScale, applyFontScale }) {
  return (
    <div>
      <GroupTitle>Interface Text Size</GroupTitle>
      <div className="grid grid-cols-4 gap-sm">
        {FONT_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => applyFontScale(opt.value)}
            className={
              'flex flex-col items-center gap-xs p-sm border-2 transition-all ' +
              (fontScale === opt.value
                ? 'border-black bg-surface-container-highest shadow-[2px_2px_0px_0px_#000] text-primary-fixed'
                : 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-highest')
            }
          >
            <span style={{ fontSize: `${Math.round(14 * opt.value)}px`, fontWeight: 700, lineHeight: 1 }}>Aa</span>
            <span className="font-label-caps text-label-caps">{opt.label}</span>
          </button>
        ))}
      </div>

      <GroupTitle>Dark Themes</GroupTitle>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-sm">
        {DARK_PRESETS.map(name => (
          <PresetCard key={name} name={name} p={PRESETS[name]} active={preset === name} onSelect={changePreset} />
        ))}
      </div>

      <GroupTitle>Light Themes</GroupTitle>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-sm">
        {LIGHT_PRESETS.map(name => (
          <PresetCard key={name} name={name} p={PRESETS[name]} active={preset === name} onSelect={changePreset} />
        ))}
      </div>

      <GroupTitle
        action={Object.keys(overrides).length > 0 && (
          <Button variant="ghost" size="sm" onClick={resetOverrides}>Reset to preset</Button>
        )}
      >
        Custom Colours
      </GroupTitle>
      <div className="flex flex-col gap-xs">
        {EDITABLE_COLORS.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between p-sm bg-surface-container-low border-2 border-outline-variant cursor-pointer">
            <span className="font-body-base text-body-base text-on-surface">{label}</span>
            <div className="flex items-center gap-sm">
              <div className="w-6 h-6 border-2 border-outline-variant shrink-0" style={{ background: vars[key] ?? '#000' }} />
              <input
                type="color"
                className="w-0 h-0 opacity-0 absolute"
                value={vars[key] ?? '#000000'}
                onChange={e => changeColor(key, e.target.value)}
              />
              <span className="font-stat-lg text-[12px] text-on-surface-variant w-16">{(vars[key] ?? '').toUpperCase()}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function PresetCard({ name, p, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(name)}
      className={
        'flex flex-col gap-xs p-xs border-2 relative transition-all text-left ' +
        (active ? 'border-primary-fixed-dim shadow-[2px_2px_0px_#000]' : 'border-outline-variant bg-surface-container-low hover:border-outline')
      }
    >
      <div className="h-10 flex flex-col overflow-hidden border border-outline-variant">
        <div style={{ background: p['--bg'], flex: 1 }} />
        <div style={{ background: p['--surface'], height: 8 }} />
        <div style={{ background: p['--indigo'], height: 3 }} />
      </div>
      <div className="font-label-caps text-label-caps text-on-surface-variant truncate">{name.replace(/^(Dark |Light )/, '')}</div>
      {active && (
        <div className="absolute top-1 right-1 w-4 h-4 bg-primary-fixed-dim text-on-primary-fixed flex items-center justify-center text-[10px] font-bold">✓</div>
      )}
    </button>
  );
}

/* ── Chart Style ─────────────────────────────────────────────────── */
function ChartSection() {
  const [color,   setColor]   = useState(() => localStorage.getItem('draw_color')        || '#d4ff3f');
  const [width,   setWidth]   = useState(() => Number(localStorage.getItem('draw_width') || 2));
  const [opacity, setOpacity] = useState(() => Number(localStorage.getItem('draw_fill_opacity') || 15));

  const save = (setter, key) => val => { setter(val); localStorage.setItem(key, val); };

  return (
    <div>
      <GroupTitle>Drawing Style</GroupTitle>

      <label className="flex items-center justify-between p-sm bg-surface-container-low border-2 border-outline-variant cursor-pointer mb-sm">
        <span className="font-body-base text-body-base text-on-surface">Line Colour</span>
        <div className="flex items-center gap-sm">
          <div className="w-6 h-6 border-2 border-outline-variant shrink-0" style={{ background: color }} />
          <input type="color" className="w-0 h-0 opacity-0 absolute" value={color} onChange={e => save(setColor, 'draw_color')(e.target.value)} />
          <span className="font-stat-lg text-[12px] text-on-surface-variant w-16">{color.toUpperCase()}</span>
        </div>
      </label>

      <div className="flex items-center gap-md p-sm bg-surface-container-low border-2 border-outline-variant mb-sm">
        <span className="font-body-base text-body-base text-on-surface w-28 shrink-0">Line Width</span>
        <input type="range" min={1} max={6} value={width} onChange={e => save(setWidth, 'draw_width')(+e.target.value)} className="flex-1 accent-[#c3f400]" />
        <span className="font-stat-lg text-[12px] text-primary-fixed-dim w-10 text-right">{width}px</span>
      </div>

      <div className="flex items-center gap-md p-sm bg-surface-container-low border-2 border-outline-variant">
        <span className="font-body-base text-body-base text-on-surface w-28 shrink-0">Fill Opacity</span>
        <input type="range" min={0} max={50} value={opacity} onChange={e => save(setOpacity, 'draw_fill_opacity')(+e.target.value)} className="flex-1 accent-[#c3f400]" />
        <span className="font-stat-lg text-[12px] text-primary-fixed-dim w-10 text-right">{opacity}%</span>
      </div>

      <GroupTitle>Preview</GroupTitle>
      <div className="border-2 border-outline-variant bg-[#0e0e0e] p-sm">
        <svg width="100%" height="70">
          <line x1="20" y1="35" x2="220" y2="35" stroke={color} strokeWidth={width} />
          <line x1="20" y1="58" x2="200" y2="18" stroke={color} strokeWidth={width} />
          <rect x="240" y="15" width="90" height="40"
            fill={color + Math.round(opacity * 2.55).toString(16).padStart(2, '0')}
            stroke={color} strokeWidth={width} />
        </svg>
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
