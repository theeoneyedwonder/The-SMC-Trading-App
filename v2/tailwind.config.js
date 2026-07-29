/** @type {import('tailwindcss').Config} */
// Material-Design token config ported verbatim from the Stitch mockups
// (brutalist_terminal / DESIGN.md). Preflight is disabled so the existing
// hand-written CSS keeps working while screens are migrated to Tailwind
// incrementally.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        'on-tertiary-fixed': '#410003', 'on-secondary': '#480081', 'on-primary': '#283500',
        error: '#ffb4ab', 'on-secondary-container': '#dcb7ff', primary: '#ffffff',
        surface: '#131313', 'on-background': '#e5e2e1', 'surface-tint': '#abd600',
        'surface-container-low': '#1c1b1b', 'error-container': '#93000a', tertiary: '#ffffff',
        'secondary-container': '#7701d0', 'outline-variant': '#444933',
        'on-tertiary-fixed-variant': '#930010', 'on-tertiary-container': '#c90e1e',
        'on-error-container': '#ffdad6', 'tertiary-container': '#ffdad6', 'surface-dim': '#131313',
        'on-secondary-fixed': '#2c0051', 'on-error': '#690005', outline: '#8e9379',
        background: '#131313', 'on-primary-fixed': '#161e00', 'inverse-on-surface': '#313030',
        'tertiary-fixed': '#ffdad6', 'surface-container-high': '#2a2a2a', 'inverse-primary': '#506600',
        secondary: '#dcb8ff', 'primary-fixed': '#c3f400', 'on-secondary-fixed-variant': '#6700b5',
        'primary-fixed-dim': '#abd600', 'inverse-surface': '#e5e2e1', 'primary-container': '#c3f400',
        'surface-container-lowest': '#0e0e0e', 'secondary-fixed-dim': '#dcb8ff',
        'on-surface-variant': '#c4c9ac', 'surface-container-highest': '#353534',
        'secondary-fixed': '#efdbff', 'surface-variant': '#353534', 'tertiary-fixed-dim': '#ffb3ad',
        'on-primary-fixed-variant': '#3c4d00', 'on-primary-container': '#556d00', 'on-tertiary': '#680008',
        'surface-bright': '#3a3939', 'on-surface': '#e5e2e1', 'surface-container': '#201f1f',
      },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', full: '9999px' },
      spacing: {
        'margin-desktop': '24px', lg: '24px', xl: '32px', xs: '4px', gutter: '16px',
        unit: '4px', md: '16px', sm: '8px', 'margin-mobile': '16px',
      },
      fontFamily: {
        'headline-lg-mobile': ['JetBrains Mono Variable', 'JetBrains Mono', 'monospace'],
        'body-bold': ['Inter', 'sans-serif'],
        'stat-lg': ['JetBrains Mono Variable', 'JetBrains Mono', 'monospace'],
        'label-caps': ['JetBrains Mono Variable', 'JetBrains Mono', 'monospace'],
        'body-base': ['Inter', 'sans-serif'],
        'headline-md': ['JetBrains Mono Variable', 'JetBrains Mono', 'monospace'],
        'display-lg': ['JetBrains Mono Variable', 'JetBrains Mono', 'monospace'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'monospace'],
        headline: ['Inter', 'sans-serif'], display: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'], label: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '800' }],
        'body-bold': ['14px', { lineHeight: '20px', fontWeight: '700' }],
        'stat-lg': ['24px', { lineHeight: '30px', fontWeight: '800' }],
        'label-caps': ['11px', { lineHeight: '14px', letterSpacing: '0.05em', fontWeight: '700' }],
        'body-base': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'headline-md': ['20px', { lineHeight: '28px', letterSpacing: '0', fontWeight: '700' }],
        'display-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '800' }],
      },
    },
  },
  plugins: [],
};
