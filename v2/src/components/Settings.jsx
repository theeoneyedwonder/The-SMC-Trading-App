import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PRESETS, DARK_PRESETS, LIGHT_PRESETS, EDITABLE_COLORS, useTheme } from '../contexts/ThemeContext';

const API = 'http://127.0.0.1:8000';

const SECTIONS = [
  { id: 'appearance', label: 'Appearance',   icon: '◑' },
  { id: 'chart',      label: 'Chart Style',  icon: '◻' },
  { id: 'ai',         label: 'AI Companion', icon: '◈' },
  { id: 'account',    label: 'Account',      icon: '◎' },
];

const FONT_OPTS = [
  { label: 'Small',  value: 0.88 },
  { label: 'Medium', value: 1.0  },
  { label: 'Large',  value: 1.15 },
  { label: 'XL',     value: 1.3  },
];

export default function Settings({ onClose, account }) {
  const [section, setSection] = useState('appearance');
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
  const [searchKey, setSearchKey]       = useState('');
  const [hasSearchKey, setHasSearchKey] = useState(false);
  const [showSearchKey, setShowSearchKey] = useState(false);
  const [searchSaving, setSearchSaving] = useState(false);
  const [searchSaved, setSearchSaved]   = useState(false);

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
      setHasKey(true); setApiKey('');
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
    <motion.div
      className="settings-fs-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="settings-fs-panel"
        initial={{ opacity: 0, scale: 0.96, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        {/* Header */}
        <div className="settings-fs-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo-mark" style={{ width: 26, height: 26, fontSize: 12 }}>S</div>
            <span className="settings-fs-title">Settings</span>
          </div>
          <button className="drawer-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-fs-body">
          {/* Left nav */}
          <nav className="settings-fs-nav">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`settings-fs-nav-item${section === s.id ? ' active' : ''}`}
                onClick={() => setSection(s.id)}
              >
                {section === s.id && (
                  <motion.span
                    className="settings-fs-nav-bg"
                    layoutId="settings-nav-bg"
                    transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                  />
                )}
                <span className="settings-fs-nav-icon">{s.icon}</span>
                <span style={{ position: 'relative', zIndex: 1 }}>{s.label}</span>
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="settings-fs-content">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={section}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.14 }}
              >
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
                {section === 'account' && <AccountSection account={account} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Appearance ──────────────────────────────────────────────── */
function AppearanceSection({ preset, vars, overrides, changePreset, changeColor, resetOverrides, fontScale, applyFontScale }) {
  return (
    <div>
      <div className="sfs-group-title">Interface Text Size</div>
      <div className="sfs-font-opts">
        {FONT_OPTS.map(opt => (
          <motion.button
            key={opt.value}
            className={`sfs-font-btn${fontScale === opt.value ? ' active' : ''}`}
            onClick={() => applyFontScale(opt.value)}
            whileTap={{ scale: 0.95 }}
          >
            <span style={{ fontSize: `${Math.round(14 * opt.value)}px`, fontWeight: 700, lineHeight: 1 }}>Aa</span>
            <span className="sfs-font-label">{opt.label}</span>
          </motion.button>
        ))}
      </div>

      <div className="sfs-divider" />

      <div className="sfs-group-title">Dark Themes</div>
      <div className="sfs-preset-grid">
        {DARK_PRESETS.map(name => (
          <SfsPresetCard key={name} name={name} p={PRESETS[name]} active={preset === name} onSelect={changePreset} />
        ))}
      </div>

      <div className="sfs-group-title" style={{ marginTop: 20 }}>Light Themes</div>
      <div className="sfs-preset-grid">
        {LIGHT_PRESETS.map(name => (
          <SfsPresetCard key={name} name={name} p={PRESETS[name]} active={preset === name} onSelect={changePreset} />
        ))}
      </div>

      <div className="sfs-divider" />

      <div className="sfs-group-title">
        Custom Colours
        {Object.keys(overrides).length > 0 && (
          <button className="sfs-reset-btn" onClick={resetOverrides}>Reset to preset</button>
        )}
      </div>
      <div className="sfs-color-list">
        {EDITABLE_COLORS.map(({ key, label }) => (
          <label key={key} className="sfs-color-row">
            <span className="sfs-color-label">{label}</span>
            <div className="sfs-color-right">
              <div className="sfs-color-swatch" style={{ background: vars[key] ?? '#000' }} />
              <input
                type="color"
                className="sfs-color-input"
                value={vars[key] ?? '#000000'}
                onChange={e => changeColor(key, e.target.value)}
              />
              <span className="sfs-hex">{(vars[key] ?? '').toUpperCase()}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function SfsPresetCard({ name, p, active, onSelect }) {
  return (
    <motion.button
      className={`sfs-preset-card${active ? ' active' : ''}`}
      onClick={() => onSelect(name)}
      whileTap={{ scale: 0.96 }}
    >
      <div className="sfs-preset-preview">
        <div style={{ background: p['--bg'], flex: 1, borderRadius: '6px 6px 0 0' }} />
        <div style={{ background: p['--surface'], height: 10 }} />
        <div style={{ background: p['--indigo'], height: 4 }} />
      </div>
      <div className="sfs-preset-name">{name.replace(/^(Dark |Light )/, '')}</div>
      {active && (
        <motion.div
          className="sfs-preset-check"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 14, stiffness: 400 }}
        >✓</motion.div>
      )}
    </motion.button>
  );
}

/* ── Chart Style ─────────────────────────────────────────────── */
function ChartSection() {
  const [color,   setColor]   = useState(() => localStorage.getItem('draw_color')        || '#818cf8');
  const [width,   setWidth]   = useState(() => Number(localStorage.getItem('draw_width') || 2));
  const [opacity, setOpacity] = useState(() => Number(localStorage.getItem('draw_fill_opacity') || 15));

  const save = (setter, key) => val => { setter(val); localStorage.setItem(key, val); };

  return (
    <div>
      <div className="sfs-group-title">Drawing Style</div>

      <label className="sfs-color-row" style={{ cursor: 'pointer' }}>
        <span className="sfs-color-label">Line Colour</span>
        <div className="sfs-color-right">
          <div className="sfs-color-swatch" style={{ background: color }} />
          <input type="color" className="sfs-color-input" value={color} onChange={e => save(setColor, 'draw_color')(e.target.value)} />
          <span className="sfs-hex">{color.toUpperCase()}</span>
        </div>
      </label>

      <div className="sfs-range-row">
        <span className="sfs-color-label">Line Width</span>
        <input type="range" min={1} max={6} value={width} onChange={e => save(setWidth,'draw_width')(+e.target.value)} style={{ flex:1, accentColor:'var(--indigo)' }} />
        <span className="sfs-range-val">{width}px</span>
      </div>

      <div className="sfs-range-row">
        <span className="sfs-color-label">Fill Opacity</span>
        <input type="range" min={0} max={50} value={opacity} onChange={e => save(setOpacity,'draw_fill_opacity')(+e.target.value)} style={{ flex:1, accentColor:'var(--indigo)' }} />
        <span className="sfs-range-val">{opacity}%</span>
      </div>

      <div className="sfs-group-title" style={{ marginTop: 24 }}>Preview</div>
      <div className="sfs-draw-preview">
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

/* ── AI Companion ────────────────────────────────────────────── */
function AISection({ apiKey, setApiKey, hasKey, showKey, setShowKey, saving, saved, saveKey,
                     searchKey, setSearchKey, hasSearchKey, showSearchKey, setShowSearchKey,
                     searchSaving, searchSaved, saveSearchKey }) {
  return (
    <div>
      <div className="sfs-group-title">Groq API Key</div>
      <p className="sfs-desc">
        Sage uses Groq (Llama 3.3) to analyse your chart and answer questions about market
        structure, order blocks, and your open positions. Groq is free to use — your key is stored locally
        on this machine only.
      </p>

      {hasKey && (
        <div className="sfs-key-status">
          <span className="sfs-key-dot" />
          API key configured
          <button className="sfs-reset-btn" onClick={() => setShowKey(true)}>Replace</button>
        </div>
      )}

      {(!hasKey || showKey) && (
        <div className="sfs-key-row">
          <input
            type="password"
            className="sfs-input"
            placeholder="gsk_..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
            autoComplete="off"
          />
          <motion.button
            className="sfs-save-btn"
            onClick={saveKey}
            disabled={!apiKey.trim() || saving}
            whileTap={{ scale: 0.96 }}
          >
            {saved ? '✓ Saved' : saving ? '…' : 'Save Key'}
          </motion.button>
        </div>
      )}

      <p className="sfs-micro">
        Get your free key at <strong style={{ color: 'var(--text2)' }}>console.groq.com</strong>
      </p>

      <div className="sfs-group-title" style={{ marginTop: 26 }}>Web Search (optional)</div>
      <p className="sfs-desc">
        Add a Tavily key to give Sage live web search — news, market headlines, and anything
        past its training cutoff. Without it, Sage still works from its own knowledge.
      </p>

      {hasSearchKey && (
        <div className="sfs-key-status">
          <span className="sfs-key-dot" />
          Web search enabled
          <button className="sfs-reset-btn" onClick={() => setShowSearchKey(true)}>Replace</button>
        </div>
      )}

      {(!hasSearchKey || showSearchKey) && (
        <div className="sfs-key-row">
          <input
            type="password"
            className="sfs-input"
            placeholder="tvly-..."
            value={searchKey}
            onChange={e => setSearchKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveSearchKey()}
            autoComplete="off"
          />
          <motion.button
            className="sfs-save-btn"
            onClick={saveSearchKey}
            disabled={!searchKey.trim() || searchSaving}
            whileTap={{ scale: 0.96 }}
          >
            {searchSaved ? '✓ Saved' : searchSaving ? '…' : 'Save Key'}
          </motion.button>
        </div>
      )}

      <p className="sfs-micro">
        Get a free key at <strong style={{ color: 'var(--text2)' }}>tavily.com</strong>
      </p>
    </div>
  );
}

/* ── Account ─────────────────────────────────────────────────── */
function AccountSection({ account }) {
  const rows = account ? [
    ['Account',  `#${account.login}`],
    ['Name',     account.name],
    ['Balance',  `${account.currency} ${Number(account.balance).toFixed(2)}`, 'green'],
    ['Equity',   `${account.currency} ${Number(account.equity ?? account.balance).toFixed(2)}`],
    ['Broker',   account.company],
    ['Server',   account.server],
    ['Leverage', account.leverage ? `1:${account.leverage}` : '—'],
  ] : [];

  return (
    <div>
      <div className="sfs-group-title">Connected Account</div>
      {account ? (
        <div className="sfs-account-card">
          <div className="sfs-acct-avatar">
            {account.name ? account.name.slice(0, 2).toUpperCase() : '??'}
          </div>
          <div className="sfs-acct-rows">
            {rows.map(([label, val, cls]) => (
              <div key={label} className="sfs-acct-row">
                <span className="sfs-acct-label">{label}</span>
                <span className={`sfs-acct-val${cls ? ' ' + cls : ''}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="sfs-no-account">Not connected to MetaTrader 5</div>
      )}
    </div>
  );
}
