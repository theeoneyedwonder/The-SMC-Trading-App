// QUANT_CORE logo candidates — flat, single-color, brutalist marks that
// inherit currentColor (so they sit on the lime badge in dark, or flip to
// lime-on-black anywhere). All drawn on a 24×24 grid, sharp corners.

// 1 — CORE: concentric squares. Reads literally as "core"; matches the 2px
//     panel/border grammar exactly. Calm, centered, scales to a favicon.
export function LogoCore({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter">
      <rect x="4" y="4" width="16" height="16" />
      <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// 2 — PROMPT: a command-prompt ">_" . Leans into the quant/terminal identity
//     and the underscore already in the wordmark. Minimal, distinct silhouette.
export function LogoPrompt({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}
         fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter">
      <polyline points="7,8 11.5,12 7,16" />
      <line x1="13.5" y1="16" x2="18.5" y2="16" />
    </svg>
  );
}

// 3 — ZONE: a square split at the midline with the lower half filled — an SMC
//     equilibrium / order-block "zone". Ties the mark to what the app does.
export function LogoZone({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}
         fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter">
      <rect x="4" y="12" width="16" height="8" fill="currentColor" stroke="none" />
      <rect x="4" y="4" width="16" height="16" />
    </svg>
  );
}

export const LOGO_CANDIDATES = [
  { id: 'core',   label: 'CORE',   Mark: LogoCore },
  { id: 'prompt', label: 'PROMPT', Mark: LogoPrompt },
  { id: 'zone',   label: 'ZONE',   Mark: LogoZone },
];
