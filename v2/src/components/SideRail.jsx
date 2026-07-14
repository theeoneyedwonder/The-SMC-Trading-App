import { useTheme } from '../contexts/ThemeContext';

// Material Symbols glyph
function Icon({ name, className = '', fill = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

const ITEMS = [
  { id: 'home',        label: 'Terminal',  icon: 'terminal' },
  { id: 'performance', label: 'Analytics', icon: 'analytics' },
  { id: 'trades',      label: 'Positions', icon: 'format_list_bulleted' },
  { id: 'account',     label: 'Account',   icon: 'account_circle' },
];

export default function SideRail({ page, setPage, account, connected, onSettingsClick, onLogout }) {
  const { mode, toggleMode } = useTheme();

  const initials = account?.name
    ? account.name.slice(0, 2).toUpperCase()
    : account?.login ? String(account.login).slice(-2) : 'MT';

  return (
    <aside className="w-[280px] shrink-0 flex flex-col bg-surface-container-lowest border-r-2 border-outline-variant shadow-[4px_0px_0px_0px_rgba(0,0,0,1)] relative z-50">
      {/* Header */}
      <div className="p-lg border-b-2 border-outline-variant flex items-center gap-md">
        <div className="w-10 h-10 bg-primary-fixed glow-primary flex items-center justify-center shrink-0 text-on-primary-fixed">
          <Icon name="query_stats" fill />
        </div>
        <div>
          <h1 className="font-display-lg text-[20px] font-black text-primary-fixed glow-text-primary tracking-tighter leading-none">SMC_CORE</h1>
          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-widest mt-1">v0.2 // ACTIVE</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-md overflow-y-auto flex flex-col gap-xs">
        {ITEMS.map(({ id, label, icon }) => {
          const active = page === id;
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={
                'flex items-center gap-md px-md py-sm font-label-caps text-label-caps transition-all active:scale-95 duration-75 text-left ' +
                (active
                  ? 'border-l-4 border-primary-fixed-dim bg-surface-container-highest text-primary-fixed-dim'
                  : 'border-l-4 border-transparent text-on-surface-variant hover:bg-surface-container-highest hover:text-primary')
              }
            >
              <Icon name={icon} className={active ? 'drop-shadow-[0_0_10px_rgba(195,244,0,0.7)]' : ''} fill={active} />
              {label}
            </button>
          );
        })}

        {/* Sage AI — violet accent (opens the companion) */}
        <button
          onClick={() => setPage('sage')}
          className={
            'flex items-center gap-md px-md py-sm font-label-caps text-label-caps transition-all active:scale-95 duration-75 text-left ' +
            (page === 'sage'
              ? 'border-l-4 border-secondary bg-secondary-container/15 text-secondary'
              : 'border-l-4 border-transparent text-on-surface-variant hover:bg-surface-container-highest hover:text-secondary')
          }
        >
          <Icon name="auto_awesome" className="text-secondary drop-shadow-[0_0_10px_rgba(220,184,255,0.7)]" fill />
          Sage AI
        </button>
      </nav>

      {/* Footer */}
      <div className="border-t-2 border-outline-variant flex flex-col">
        {/* Connection status */}
        <div className="flex items-center gap-sm px-md py-sm">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-primary-fixed-dim shadow-[0_0_8px_#abd600]' : 'bg-error'}`} />
          <span className="font-label-caps text-label-caps text-on-surface-variant tracking-widest">
            {connected ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>

        {/* User card */}
        {account && (
          <div className="mx-md mb-sm p-sm flex items-center gap-sm bg-surface-container border-2 border-outline-variant">
            <div className="w-8 h-8 bg-primary-fixed glow-primary text-on-primary-fixed flex items-center justify-center shrink-0 font-stat-lg text-[12px] font-bold">
              {initials}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-body-bold text-body-bold text-primary truncate">{account.name || `#${account.login}`}</span>
              <span className="font-label-caps text-label-caps text-on-surface-variant truncate">{account.server || account.company || 'MT5'}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col">
          <button onClick={onSettingsClick} className="flex items-center gap-md px-md py-sm font-label-caps text-label-caps text-on-surface-variant hover:bg-surface-container-highest hover:text-primary transition-all">
            <Icon name="settings" />Settings
          </button>
          <button onClick={toggleMode} className="flex items-center gap-md px-md py-sm font-label-caps text-label-caps text-on-surface-variant hover:bg-surface-container-highest hover:text-primary transition-all">
            <Icon name={mode === 'dark' ? 'light_mode' : 'dark_mode'} />{mode === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button onClick={onLogout} className="flex items-center gap-md px-md py-sm font-label-caps text-label-caps text-on-surface-variant hover:bg-surface-container-highest hover:text-error transition-all">
            <Icon name="logout" />Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
