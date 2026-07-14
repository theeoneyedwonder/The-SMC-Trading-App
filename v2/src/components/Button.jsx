// Shared brutalist button language (see settings_interface_preferences.html
// RESET DEFAULTS / APPLY SETTINGS / CANCEL): 2px black border, hard offset
// shadow, hover lifts + grows the shadow, active presses flat.
const VARIANTS = {
  primary: 'bg-primary-fixed text-on-primary-fixed border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_0px_#000] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none',
  danger:  'bg-error text-on-error border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_0px_#000] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none',
  secondary: 'bg-secondary text-on-secondary border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_0px_#000] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none',
  neutral: 'bg-surface-container-high text-primary border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:-translate-y-[2px] hover:-translate-x-[2px] hover:shadow-[5px_5px_0px_0px_#000] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none',
  ghost:   'bg-surface border-2 border-outline-variant text-on-surface hover:bg-surface-container transition-colors',
};

const SIZES = {
  sm: 'px-sm py-xs text-[11px]',
  md: 'px-md py-sm',
  lg: 'px-lg py-sm',
};

export default function Button({ variant = 'neutral', size = 'md', className = '', disabled, children, ...props }) {
  return (
    <button
      disabled={disabled}
      className={
        'inline-flex items-center justify-center gap-xs font-label-caps text-label-caps uppercase tracking-wide transition-all ' +
        SIZES[size] + ' ' + VARIANTS[variant] +
        (disabled ? ' opacity-40 pointer-events-none' : '') +
        (className ? ' ' + className : '')
      }
      {...props}
    >
      {children}
    </button>
  );
}
