---
name: Brutalist Terminal
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c9ac'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9379'
  outline-variant: '#444933'
  surface-tint: '#abd600'
  primary: '#ffffff'
  on-primary: '#283500'
  primary-container: '#c3f400'
  on-primary-container: '#556d00'
  inverse-primary: '#506600'
  secondary: '#dcb8ff'
  on-secondary: '#480081'
  secondary-container: '#7701d0'
  on-secondary-container: '#dcb7ff'
  tertiary: '#ffffff'
  on-tertiary: '#680008'
  tertiary-container: '#ffdad6'
  on-tertiary-container: '#c90e1e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c3f400'
  primary-fixed-dim: '#abd600'
  on-primary-fixed: '#161e00'
  on-primary-fixed-variant: '#3c4d00'
  secondary-fixed: '#efdbff'
  secondary-fixed-dim: '#dcb8ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6700b5'
  tertiary-fixed: '#ffdad6'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410003'
  on-tertiary-fixed-variant: '#930010'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: '0'
  stat-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 30px
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 24px
---

## Brand & Style

This design system is a high-octane, **Brutalist** trading environment engineered for professional algorithmic execution and financial analysis. It rejects the "softness" of consumer fintech in favor of a technical aesthetic that prioritizes structural dominance and data density.

The brand personality is authoritative, uncompromising, and immediate. It evokes the feeling of a sophisticated command center where every pixel serves a functional purpose. The visual style is characterized by:
- **Raw Structure:** Heavy 2px solid borders that act as structural girders between data modules.
- **Hard Depth:** Deep, offset block shadows (no blur) that create a physical, layered stack.
- **Neon Utility:** A high-contrast "electric" palette used strictly for functional signaling (Bullish/Bearish/AI).
- **Hybrid Brutalism:** While maintaining a sharp architectural feel, the system incorporates subtle 2px rounding to provide just enough visual definition for complex technical interfaces.

## Colors

The palette is optimized for high-stakes monitoring, using absolute blacks to reduce eye strain and ultra-bright neons for rapid signal recognition.

- **Primary (Neon Green):** The "Bullish" life force. Used for buy actions, positive P&L, and active system states (`#CCFF00`).
- **Secondary (Deep Violet):** The "Sage AI" signature. Designates machine-learning insights, automated suggestions, and "Sage" brand touchpoints (`#8A2BE2`).
- **Tertiary (Bearish Red):** Used for sell actions, stop-loss zones, and negative P&L (`#FF3E3E`).
- **Neutral (Brutalist Black/Coal):** The foundation. `#0D0D0D` serves as the infinite void (background), providing the high-contrast base for the neon elements.
- **Framing Charcoal:** `#333333` for thick, assertive outlines.

## Typography

The typography system is unified under **Inter** to ensure maximum readability and a modern, streamlined technical appearance. By moving away from monospaced fonts for headlines, the system achieves a more cohesive and professional "software" feel while retaining its brutalist roots through weight and layout.

- **Unified Legibility:** Inter is used across all layers—headlines, body text, and technical labels—leveraging variable weights to create hierarchy.
- **Tight Leading:** Line heights are kept compact to maximize information density.
- **Upper Case Labels:** Metadata and grid headers are always set in uppercase to reinforce the "system terminal" aesthetic.

## Layout & Spacing

This design system uses a **fixed-grid** app shell model, locking the viewport to `100vh` to prevent scrolling of the primary dashboard.

- **Spacing Rhythm:** Based on a strict 4px baseline. Components are packed tightly to present a "single-pane-of-glass" view.
- **Panel Boundaries:** Layout divisions are marked by 2px solid charcoal lines rather than empty space. 
- **Grid:** A 12-column grid is used for desktop layouts, but panels often rely on contextual "docking" (e.g., 280px fixed sidebar, fluid center chart, 320px AI terminal).
- **Mobile Reflow:** Panels stack vertically or hide behind a bottom-sheet/drawer mechanism to maintain the 2px border aesthetic on smaller screens.

## Elevation & Depth

Depth is achieved through **Hard Offsets** and **Technical Layering** rather than traditional soft shadows or glassmorphism.

- **Hard Shadows:** Interactive elements (buttons, cards) use a `3px` to `5px` solid offset shadow in `#000000` or a high-contrast accent color (`#CCFF00`).
- **Technical Framing:** Secondary overlays are framed with a solid 2px border and deep black backgrounds to maintain structural integrity.
- **Tonal Layering:** The background is the lowest level (`#0D0D0D`), panels are mid-tier, and active items/inputs are the highest tier.

## Shapes

The shape language is **Soft-Brutalist**. While the system maintains an architectural feel, a subtle radius is applied to elements to differentiate nested components and improve focus.

- **Corners:** 2px radius is the default for buttons, cards, and inputs.
- **Consistency:** All containers, even outer-shell panels, adopt this consistent 2px rounding to harmonize with the updated typography.

## Components

### Buttons
- **Style:** Solid color block with a 2px black outline and 2px rounded corners.
- **Action:** On `:hover`, translate the button `-2px, -2px` and increase the hard shadow. On `:active`, translate `1px, 1px` and remove the shadow to simulate a physical press.
- **Buy/Sell:** `Buy` is Neon Green with Black text; `Sell` is Red with White text.

### AI 'Sage' Insight Cards
- **Style:** Background `#141414`, framed in a 2px `Deep Violet` border with 2px corner radius.
- **Sage Mark:** A 4-pointed sparkle icon in a square 2px box.
- **Metrics:** Use a 3-column technical grid for Entry, SL, and TP. Confidence bars are flat blocks of Neon Green with 2px rounding.

### Sidebars & Navigation
- **Navigation:** 48px height top-bar with a 2px bottom border.
- **Sidebar:** 280px width. Active items get a `3px` solid Neon Green or Violet vertical bar on the leading edge.

### Input Fields
- **Style:** Solid dark fill, 2px charcoal border, 2px rounded corners.
- **Focus:** The border immediately switches to a 2px solid Neon Green or Deep Violet band.

### Trading Tables & Watchlists
- **Style:** High-density rows with alternating backgrounds. Numerical data is right-aligned.
- **State:** Active rows use a high-contrast left-border highlight.