import { createContext, useContext, useState, useEffect } from 'react';

const API = 'http://127.0.0.1:8000';

export const DARK_PRESETS  = ['Dark Indigo', 'Dark Navy', 'Forest', 'Midnight', 'Charcoal'];
export const LIGHT_PRESETS = ['Light Classic', 'Light Warm'];

export const PRESETS = {
  'Dark Indigo': {
    '--bg': '#060611', '--surface': '#0c0c1e', '--surf2': '#101022',
    '--surf3': '#141430', '--surf4': '#18183a',
    '--border': '#1a1a30', '--border2': '#22223c',
    '--text': '#e8ecf8', '--text2': '#a0a8c8', '--muted': '#6b7299',
    '--indigo': '#818cf8', '--indigo2': '#6366f1',
    '--green': '#34d399', '--red': '#fb7185', '--gold': '#fbbf24',
    '--blue': '#60a5fa', '--purple': '#a78bfa', '--orange': '#fb923c',
    '--candle-up': '#34d399', '--candle-down': '#fb7185',
    '--chart-bg': '#08081a',
  },
  'Dark Navy': {
    '--bg': '#04070f', '--surface': '#080e1c', '--surf2': '#0c1424',
    '--surf3': '#101a2c', '--surf4': '#142030',
    '--border': '#141e30', '--border2': '#1c2a40',
    '--text': '#e0e8f8', '--text2': '#8898b8', '--muted': '#4a5a80',
    '--indigo': '#3b82f6', '--indigo2': '#2563eb',
    '--green': '#10b981', '--red': '#ef4444', '--gold': '#f59e0b',
    '--blue': '#60a5fa', '--purple': '#8b5cf6', '--orange': '#f97316',
    '--candle-up': '#10b981', '--candle-down': '#ef4444',
    '--chart-bg': '#030608',
  },
  'Forest': {
    '--bg': '#060b0a', '--surface': '#0c1210', '--surf2': '#101816',
    '--surf3': '#141f1c', '--surf4': '#182520',
    '--border': '#182520', '--border2': '#203028',
    '--text': '#e0f0ec', '--text2': '#80a898', '--muted': '#486858',
    '--indigo': '#34d399', '--indigo2': '#10b981',
    '--green': '#4ade80', '--red': '#f87171', '--gold': '#fcd34d',
    '--blue': '#22d3ee', '--purple': '#c084fc', '--orange': '#fb923c',
    '--candle-up': '#4ade80', '--candle-down': '#f87171',
    '--chart-bg': '#040908',
  },
  'Midnight': {
    '--bg': '#070510', '--surface': '#100c1e', '--surf2': '#141226',
    '--surf3': '#18162e', '--surf4': '#1c1a38',
    '--border': '#1c1a36', '--border2': '#24224a',
    '--text': '#eae8f8', '--text2': '#9a96c8', '--muted': '#5e58a0',
    '--indigo': '#a78bfa', '--indigo2': '#7c3aed',
    '--green': '#34d399', '--red': '#fb7185', '--gold': '#fbbf24',
    '--blue': '#60a5fa', '--purple': '#e879f9', '--orange': '#fb923c',
    '--candle-up': '#34d399', '--candle-down': '#fb7185',
    '--chart-bg': '#050310',
  },
  'Charcoal': {
    '--bg': '#0f0f0f', '--surface': '#1a1a1a', '--surf2': '#222222',
    '--surf3': '#2a2a2a', '--surf4': '#323232',
    '--border': '#303030', '--border2': '#3a3a3a',
    '--text': '#e8e8e8', '--text2': '#a0a0a0', '--muted': '#606060',
    '--indigo': '#818cf8', '--indigo2': '#6366f1',
    '--green': '#22c55e', '--red': '#ef4444', '--gold': '#eab308',
    '--blue': '#3b82f6', '--purple': '#a855f7', '--orange': '#f97316',
    '--candle-up': '#22c55e', '--candle-down': '#ef4444',
    '--chart-bg': '#111111',
  },

  // ── Light presets ─────────────────────────────────────────────
  'Light Classic': {
    '--bg': '#eef0f7', '--surface': '#ffffff', '--surf2': '#e6e9f4',
    '--surf3': '#dde1ef', '--surf4': '#d4d9ea',
    '--border': '#c8cedf', '--border2': '#b8bfd2',
    '--text': '#0d1117', '--text2': '#2e3554', '--muted': '#5c6480',
    '--indigo': '#4f46e5', '--indigo2': '#4338ca',
    '--green': '#059669', '--red': '#dc2626', '--gold': '#d97706',
    '--blue': '#2563eb', '--purple': '#7c3aed', '--orange': '#ea580c',
    '--candle-up': '#059669', '--candle-down': '#dc2626',
    '--chart-bg': '#f8faff',
    '--shadow-sm': '0 2px 8px rgba(0,0,0,.08)',
    '--shadow-md': '0 8px 32px rgba(0,0,0,.12)',
    '--shadow-lg': '0 24px 64px rgba(0,0,0,.18)',
  },
  'Light Warm': {
    '--bg': '#f5f2ec', '--surface': '#fefcf8', '--surf2': '#ede9e0',
    '--surf3': '#e4dfd5', '--surf4': '#dad4c8',
    '--border': '#c8c2b4', '--border2': '#b8b1a2',
    '--text': '#1a1408', '--text2': '#3d3220', '--muted': '#7a6e58',
    '--indigo': '#4f46e5', '--indigo2': '#4338ca',
    '--green': '#047857', '--red': '#dc2626', '--gold': '#b45309',
    '--blue': '#1d4ed8', '--purple': '#6d28d9', '--orange': '#c2410c',
    '--candle-up': '#047857', '--candle-down': '#dc2626',
    '--chart-bg': '#faf8f2',
    '--shadow-sm': '0 2px 8px rgba(0,0,0,.07)',
    '--shadow-md': '0 8px 32px rgba(0,0,0,.10)',
    '--shadow-lg': '0 24px 64px rgba(0,0,0,.15)',
  },
};

export const EDITABLE_COLORS = [
  { key: '--bg',           label: 'App Background' },
  { key: '--surface',      label: 'Panel Surface' },
  { key: '--text',         label: 'Primary Text' },
  { key: '--text2',        label: 'Secondary Text' },
  { key: '--muted',        label: 'Muted Text / Labels' },
  { key: '--indigo',       label: 'Accent Colour' },
  { key: '--green',        label: 'Positive / Buy' },
  { key: '--red',          label: 'Negative / Sell' },
  { key: '--gold',         label: 'Highlight' },
  { key: '--candle-up',    label: 'Bullish Candle' },
  { key: '--candle-down',  label: 'Bearish Candle' },
  { key: '--chart-bg',     label: 'Chart Background' },
];

function applyTheme(vars) {
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [preset, setPreset]  = useState('Dark Indigo');
  const [overrides, setOver] = useState({});

  const vars = { ...(PRESETS[preset] ?? PRESETS['Dark Indigo']), ...overrides };

  useEffect(() => { applyTheme(vars); });

  useEffect(() => {
    fetch(`${API}/settings/theme`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.preset && PRESETS[d.preset]) setPreset(d.preset);
        if (d.overrides && typeof d.overrides === 'object') setOver(d.overrides);
      })
      .catch(() => {});
  }, []);

  const persist = (p, ov) => {
    fetch(`${API}/settings/theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: p, overrides: ov }),
    }).catch(() => {});
  };

  const mode = LIGHT_PRESETS.includes(preset) ? 'light' : 'dark';

  const changePreset = (name) => {
    setPreset(name); setOver({});
    persist(name, {});
  };

  const toggleMode = () => changePreset(mode === 'dark' ? 'Light Classic' : 'Dark Indigo');

  const changeColor = (key, value) => {
    setOver(prev => {
      const next = { ...prev, [key]: value };
      persist(preset, next);
      return next;
    });
  };

  const resetOverrides = () => { setOver({}); persist(preset, {}); };

  return (
    <ThemeCtx.Provider value={{ preset, vars, overrides, mode, changePreset, toggleMode, changeColor, resetOverrides }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
