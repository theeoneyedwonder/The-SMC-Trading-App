function HomeIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H15v-6H9v6H4a1 1 0 01-1-1V9.5z"/></svg>; }
function TradesIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v18M17 3v18M3 9h4M17 9h4M3 15h4M17 15h4"/></svg>; }
function HistoryIcon(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>; }
function AccountIcon(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function PerfIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>; }

const ITEMS = [
  { id: 'home',        Icon: HomeIcon,    label: 'Home'    },
  { id: 'trades',      Icon: TradesIcon,  label: 'Trades'  },
  { id: 'history',     Icon: HistoryIcon, label: 'History' },
  { id: 'account',     Icon: AccountIcon, label: 'Account' },
  { id: 'performance', Icon: PerfIcon,    label: 'P & L'   },
];

export default function NavBar({ page, setPage }) {
  return (
    <nav className="navbar">
      {ITEMS.map(({ id, Icon, label }) => (
        <button
          key={id}
          className={`nav-item ${page === id ? 'active' : ''}`}
          onClick={() => setPage(id)}
          title={label}
        >
          <span className="nav-icon"><Icon /></span>
          <span className="nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
