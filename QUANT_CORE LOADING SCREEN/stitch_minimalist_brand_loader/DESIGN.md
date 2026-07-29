---
name: Kinetic Noir
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
  on-surface-variant: '#c4c9ad'
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
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#ffffff'
  on-tertiary: '#003642'
  tertiary-container: '#b3ebff'
  on-tertiary-container: '#336b7d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c3f400'
  primary-fixed-dim: '#abd600'
  on-primary-fixed: '#161f00'
  on-primary-fixed-variant: '#3c4d00'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#b3ebff'
  tertiary-fixed-dim: '#97cfe2'
  on-tertiary-fixed: '#001f27'
  on-tertiary-fixed-variant: '#094d5e'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
  neon-lime: '#c3f400'
  pure-white: '#ffffff'
  charcoal-surface: '#1a1a1a'
  subtle-gray: '#888888'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 64px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter-desktop: 24px
  margin-desktop: 48px
  margin-mobile: 16px
  container-max-width: 1280px
---

## Brand & Style

This design system is engineered for high-performance technology environments, emphasizing precision, speed, and focus. The brand personality is unapologetically modern—fusing a "dark-room" aesthetic with high-visibility accents to create a premium, developer-centric atmosphere.

The design style is **Minimalist / High-Contrast**, leaning into a digital-first execution. It avoids unnecessary decoration, relying instead on the rhythmic use of vibrant color against deep shadows. The goal is to evoke a sense of advanced engineering and "pro-grade" tooling, where every pixel serves a functional purpose.

## Colors

The palette is anchored by an aggressive dark-mode foundation. **Deep Charcoal (#0d0d0d)** serves as the primary canvas, providing maximum contrast for the **Vibrant Lime Green (#c3f400)**. This lime green is used sparingly but impactfully as a "kinetic" accent for primary actions and critical status indicators.

**Crisp White** is reserved strictly for high-priority typography, while secondary text and UI borders utilize a spectrum of grays to maintain visual hierarchy without competing for attention. Tonal depth is achieved through subtle shifts in black values rather than traditional drop shadows.

## Typography

The system utilizes **Geist** for its clean, geometric, and technical profile. Its humanist touches ensure legibility even at high contrast. For technical metadata and system labels, **JetBrains Mono** is introduced to reinforce the high-tech, developer-centric aesthetic.

Headlines should be set with tight letter-spacing to create a "locked-in" look. Body text maintains a comfortable line height for long-form technical documentation. All uppercase labels should be set in JetBrains Mono with increased tracking for maximum clarity.

## Layout & Spacing

The layout follows a **Fixed Grid** model for desktop to ensure a centered, focused reading experience, transitioning to a fluid model for mobile devices. A strict 4px baseline grid governs all spacing, ensuring rhythmic consistency across components.

- **Desktop:** 12-column grid with 24px gutters.
- **Mobile:** 4-column fluid grid with 16px margins.
- **Rhythm:** Use multiples of 4px for all padding and margins to maintain the mathematical precision expected of a tech-focused product.

## Elevation & Depth

Elevation in this system is conveyed through **Tonal Layers** and **Low-Contrast Outlines** rather than traditional shadows. This keeps the interface feeling "flat" and light, fitting the minimalist aesthetic.

- **Surface 0:** Background (#0d0d0d)
- **Surface 1:** Container Background (#1a1a1a)
- **Surface 2:** Interactive Hover States (#262626)

Borders are used to define boundaries in lieu of shadows. Use 1px solid strokes in a slightly lighter gray than the surface background to create a "carved" or "etched" look.

## Shapes

The shape language is disciplined and professional. **Soft (0.25rem)** roundedness is applied to standard UI elements like buttons and input fields to provide a slight modern touch without losing the sharp, technical edge. Larger containers and cards use a slightly increased radius (0.5rem) to differentiate them from smaller interactive controls.

## Components

- **Buttons:** Primary buttons use the Vibrant Lime Green background with black text. There are no shadows; hover states are indicated by a subtle brightness shift. Secondary buttons are outlined in white or light gray.
- **Input Fields:** Dark backgrounds (#1a1a1a) with a 1px border. On focus, the border transitions to the brand lime green.
- **Chips/Tags:** Monospaced typography inside a small, low-contrast container with a subtle 1px border.
- **Cards:** Defined by a change in surface color (#1a1a1a) and a hairline border. No drop shadows.
- **Status Indicators:** Use the brand lime for "Success/Active" and a high-contrast magenta or orange for errors, ensuring they pop against the dark canvas.
- **Data Visualizations:** Use the lime green as the primary data point color, supported by neutral grays for axes and grids to keep the focus on the data itself.