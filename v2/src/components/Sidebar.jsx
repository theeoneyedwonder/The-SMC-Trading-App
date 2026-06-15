import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

function HomeIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H15v-6H9v6H4a1 1 0 01-1-1V9.5z"/></svg>; }
function TradesIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v18M17 3v18M3 9h4M17 9h4M3 15h4M17 15h4"/></svg>; }
function HistoryIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>; }
function AccountIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function PerfIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>; }
function SettingsIcon(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>; }
function SunIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function MoonIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>; }
function LogoutIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }

const ITEMS = [
  { id: 'home',        label: 'Home',    Icon: HomeIcon },
  { id: 'trades',      label: 'Trades',  Icon: TradesIcon },
  { id: 'history',     label: 'History', Icon: HistoryIcon },
  { id: 'account',     label: 'Account', Icon: AccountIcon },
  { id: 'performance', label: 'P & L',   Icon: PerfIcon },
];

export default function Sidebar({ open, onClose, page, setPage, account, connected, onSettingsClick, onLogout }) {
  const { mode, toggleMode } = useTheme();

  const initials = account?.name
    ? account.name.slice(0, 2).toUpperCase()
    : account?.login
    ? String(account.login).slice(-2)
    : 'MT';

  const navigate = (id) => { setPage(id); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            className="drawer-panel"
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260, mass: 0.8 }}
          >
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="logo-mark" style={{ width: 26, height: 26, fontSize: 12 }}>S</div>
                <span className="drawer-brand">SMC Trading</span>
              </div>
              <button className="drawer-close-btn" onClick={onClose}>✕</button>
            </div>

            <nav className="drawer-nav">
              {ITEMS.map(({ id, label, Icon }) => (
                <motion.button
                  key={id}
                  className={`drawer-item${page === id ? ' active' : ''}`}
                  onClick={() => navigate(id)}
                  whileTap={{ scale: 0.97 }}
                >
                  {page === id && (
                    <motion.span
                      className="drawer-active-bar"
                      layoutId="drawer-active-bar"
                      transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                    />
                  )}
                  {page === id && (
                    <motion.span
                      className="drawer-item-bg"
                      layoutId="drawer-item-bg"
                      transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                    />
                  )}
                  <span className="drawer-item-icon"><Icon /></span>
                  <span className="drawer-item-label">{label}</span>
                </motion.button>
              ))}
            </nav>

            <div className="drawer-footer">
              <div className="drawer-conn-status">
                <span className={`status-dot ${connected ? 'live' : 'offline'}`} />
                <span className="drawer-conn-label">
                  {connected ? 'Connected to MT5' : 'Offline'}
                </span>
              </div>

              {account && (
                <div className="drawer-user-card">
                  <div className="drawer-avatar">{initials}</div>
                  <div className="drawer-user-info">
                    <span className="drawer-user-name">{account.name || `#${account.login}`}</span>
                    <span className="drawer-user-sub">{account.server || account.company || 'MT5'}</span>
                  </div>
                </div>
              )}
              <div className="drawer-footer-actions">
                <button className="drawer-footer-btn" onClick={() => { onSettingsClick(); onClose(); }}>
                  <span className="drawer-footer-btn-icon"><SettingsIcon /></span>
                  Settings
                </button>
                <button className="drawer-footer-btn" onClick={toggleMode}>
                  <span className="drawer-footer-btn-icon">{mode === 'dark' ? <SunIcon /> : <MoonIcon />}</span>
                  {mode === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                <button className="drawer-footer-btn drawer-logout-btn" onClick={() => { onClose(); onLogout?.(); }}>
                  <span className="drawer-footer-btn-icon"><LogoutIcon /></span>
                  Logout / Switch account
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
