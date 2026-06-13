import { useState, useEffect } from 'react';
import { PRESETS, DARK_PRESETS, LIGHT_PRESETS, EDITABLE_COLORS, useTheme } from '../contexts/ThemeContext';

const API = 'http://127.0.0.1:8000';

export default function Settings({ onClose }) {
  const [tab, setTab] = useState('theme');
  const { preset, vars, overrides, changePreset, changeColor, resetOverrides } = useTheme();

  const [apiKey, setApiKey]   = useState('');
  const [hasKey, setHasKey]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetch(`${API}/settings/ai-key`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setHasKey(d.configured); })
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

  return (
    <div className="settings-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-tabs">
          {[['theme','Theme'],['drawings','Drawing Style'],['ai','AI Companion']].map(([id, label]) => (
            <button key={id} className={`settings-tab${tab===id?' active':''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="settings-content">
          {tab === 'theme' && (
            <ThemeTab
              preset={preset} vars={vars} overrides={overrides}
              changePreset={changePreset} changeColor={changeColor} resetOverrides={resetOverrides}
            />
          )}
          {tab === 'drawings' && <DrawingsTab />}
          {tab === 'ai' && (
            <AITab
              apiKey={apiKey} setApiKey={setApiKey} hasKey={hasKey}
              showKey={showKey} setShowKey={setShowKey}
              saving={saving} saved={saved} saveKey={saveKey}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PresetCard({ name, p, active, onSelect }) {
  return (
    <button className={`preset-card${active ? ' active' : ''}`} onClick={() => onSelect(name)}>
      <div className="preset-preview">
        <div style={{ background: p['--bg'], flex: 1, borderRadius: '4px 4px 0 0' }} />
        <div style={{ background: p['--surface'], height: 10 }} />
        <div style={{ background: p['--indigo'], height: 4 }} />
      </div>
      <div className="preset-name">{name.replace(/^(Dark |Light )/, '')}</div>
    </button>
  );
}

function ThemeTab({ preset, vars, overrides, changePreset, changeColor, resetOverrides }) {
  return (
    <div className="settings-section">
      <div className="settings-group-label">Dark Themes</div>
      <div className="preset-grid">
        {DARK_PRESETS.map(name => (
          <PresetCard key={name} name={name} p={PRESETS[name]} active={preset === name} onSelect={changePreset} />
        ))}
      </div>

      <div className="settings-group-label" style={{ marginTop: 20 }}>Light Themes</div>
      <div className="preset-grid">
        {LIGHT_PRESETS.map(name => (
          <PresetCard key={name} name={name} p={PRESETS[name]} active={preset === name} onSelect={changePreset} />
        ))}
      </div>

      <div className="settings-group-label" style={{ marginTop: 24 }}>
        Custom Colours
        {Object.keys(overrides).length > 0 && (
          <button className="reset-btn" onClick={resetOverrides}>Reset to preset</button>
        )}
      </div>
      <div className="color-grid">
        {EDITABLE_COLORS.map(({ key, label }) => (
          <label key={key} className="color-row">
            <span className="color-row-label">{label}</span>
            <div className="color-row-right">
              <div className="color-swatch" style={{ background: vars[key] ?? '#000' }} />
              <input
                type="color"
                value={vars[key] ?? '#000000'}
                onChange={e => changeColor(key, e.target.value)}
                className="color-picker"
              />
              <span className="color-hex">{(vars[key] ?? '').toUpperCase()}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function DrawingsTab() {
  const [color, setColor] = useState(() => localStorage.getItem('draw_color') || '#818cf8');
  const [width, setWidth] = useState(() => Number(localStorage.getItem('draw_width') || 2));
  const [opacity, setOpacity] = useState(() => Number(localStorage.getItem('draw_fill_opacity') || 15));

  const setAndStore = (setter, storageKey) => val => {
    setter(val);
    localStorage.setItem(storageKey, val);
  };

  return (
    <div className="settings-section">
      <div className="settings-group-label">Default Line Style</div>

      <label className="color-row">
        <span className="color-row-label">Line Colour</span>
        <div className="color-row-right">
          <div className="color-swatch" style={{ background: color }} />
          <input type="color" value={color} onChange={e => setAndStore(setColor,'draw_color')(e.target.value)} className="color-picker" />
          <span className="color-hex">{color.toUpperCase()}</span>
        </div>
      </label>

      <label className="color-row">
        <span className="color-row-label">Line Width</span>
        <div className="color-row-right" style={{ gap: 10 }}>
          <input type="range" min={1} max={6} value={width}
            onChange={e => setAndStore(setWidth,'draw_width')(+e.target.value)}
            style={{ width: 120, accentColor: 'var(--indigo)' }}
          />
          <span className="color-hex">{width}px</span>
        </div>
      </label>

      <label className="color-row">
        <span className="color-row-label">Fill Opacity (Rect)</span>
        <div className="color-row-right" style={{ gap: 10 }}>
          <input type="range" min={0} max={50} value={opacity}
            onChange={e => setAndStore(setOpacity,'draw_fill_opacity')(+e.target.value)}
            style={{ width: 120, accentColor: 'var(--indigo)' }}
          />
          <span className="color-hex">{opacity}%</span>
        </div>
      </label>

      <div className="settings-group-label" style={{ marginTop: 20 }}>Preview</div>
      <div className="draw-preview">
        <svg width="100%" height="60" style={{ overflow: 'visible' }}>
          <line x1="20" y1="30" x2="200" y2="30" stroke={color} strokeWidth={width} />
          <line x1="20" y1="50" x2="180" y2="20" stroke={color} strokeWidth={width} />
          <rect x="220" y="15" width="80" height="30"
            fill={color + Math.round(opacity * 2.55).toString(16).padStart(2,'0')}
            stroke={color} strokeWidth={width} />
        </svg>
      </div>
    </div>
  );
}

function AITab({ apiKey, setApiKey, hasKey, showKey, setShowKey, saving, saved, saveKey }) {
  return (
    <div className="settings-section">
      <div className="settings-group-label">Anthropic API Key</div>
      <p className="settings-desc">
        The AI companion uses Claude to analyse your chart and answer questions about market structure,
        order blocks, and your positions. Your key is stored locally on this machine only.
      </p>

      {hasKey && (
        <div className="ai-key-status">
          <span className="ai-key-dot" />
          API key configured
          <button className="reset-btn" onClick={() => setShowKey(true)}>Replace</button>
        </div>
      )}

      {(!hasKey || showKey) && (
        <div className="ai-key-row">
          <input
            type="password"
            className="setup-input"
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
            autoComplete="off"
            style={{ flex: 1 }}
          />
          <button className="setup-btn primary" onClick={saveKey} disabled={!apiKey.trim() || saving}
            style={{ padding: '10px 20px', whiteSpace: 'nowrap' }}>
            {saved ? 'Saved!' : saving ? '...' : 'Save Key'}
          </button>
        </div>
      )}

      <p className="settings-micro" style={{ marginTop: 12 }}>
        Get your API key at <strong style={{ color: 'var(--text2)' }}>console.anthropic.com</strong>
      </p>
    </div>
  );
}
