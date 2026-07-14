import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

function TerminalIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>; }
function AnalyticsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>; }
function SageIcon() { return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z"/></svg>; }
function HistoryIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>; }
function AccountIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function PerfIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>; }
function SettingsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>; }
function SunIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function MoonIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>; }
function LogoutIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }

const ITEMS = [
  { id: 'home',        label: 'Terminal',    Icon: TerminalIcon },
  { id: 'performance', label: 'Analytics',   Icon: AnalyticsIcon },
  { id: 'trades',      label: 'Positions',   Icon: AccountIcon },
  { id: 'history',     label: 'History',     Icon: HistoryIcon },
  { id: 'account',     label: 'Account',     Icon: PerfIcon },
];

export default function SideRail({ page, setPage, account, connected, onSettingsClick, onLogout }) {
  const { mode, toggleMode } = useTheme();

  const initials = account?.name
    ? account.name.slice(0, 2).toUpperCase()
    : account?.login ? String(account.login).slice(-2) : 'MT';

  return (
    <aside className="rail">
      {/* Brand */}
      <div className="rail-brand">
        <div className="rail-logo"><SageIcon /></div>
        <div>
          <div className="rail-name">SMC&nbsp;TERMINAL</div>
          <div className="rail-ver">v0.2 // SYSTEM ACTIVE</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="rail-nav">
        {ITEMS.map(({ id, label, Icon }) => (
          <motion.button
            key={id}
            className={`rail-item${page === id ? ' active' : ''}`}
            onClick={() => setPage(id)}
            whileTap={{ scale: 0.98 }}
          >
            {page === id && (
              <motion.span className="rail-active-bar" layoutId="rail-active-bar"
                transition={{ type: 'spring', damping: 26, stiffness: 320 }} />
            )}
            <span className="rail-item-icon"><Icon /></span>
            <span className="rail-item-label">{label}</span>
          </motion.button>
        ))}
      </nav>

      {/* Footer */}
      <div className="rail-footer">
        <div className="rail-conn">
          <span className={`status-dot ${connected ? 'live' : 'offline'}`} />
          <span className="rail-conn-label">{connected ? 'CONNECTED' : 'OFFLINE'}</span>
        </div>

        {account && (
          <div className="rail-user">
            <div className="rail-avatar">{initials}</div>
            <div className="rail-user-info">
              <span className="rail-user-name">{account.name || `#${account.login}`}</span>
              <span className="rail-user-sub">{account.server || account.company || 'MT5'}</span>
            </div>
          </div>
        )}

        <div className="rail-actions">
          <button className="rail-action" onClick={onSettingsClick}>
            <span className="rail-action-icon"><SettingsIcon /></span>Settings
          </button>
          <button className="rail-action" onClick={toggleMode}>
            <span className="rail-action-icon">{mode === 'dark' ? <SunIcon /> : <MoonIcon />}</span>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button className="rail-action danger" onClick={onLogout}>
            <span className="rail-action-icon"><LogoutIcon /></span>Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
