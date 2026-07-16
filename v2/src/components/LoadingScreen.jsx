import { LogoZone } from './Logo';

// The app's genuine startup/loading screen — shown while the backend boots
// and/or connects, not a decorative splash disconnected from real state.
// Same shell used at every boot stage (App.jsx's initial backend check and
// Setup.jsx's health poll) so there's one consistent loading moment, not two
// different ones back to back. `children` is for real diagnostic content
// only (e.g. the antivirus-block warning) — no canned status copy by default.
export default function LoadingScreen({ credit, children }) {
  return (
    <div className="loading-screen">
      <div className="loading-inner">
        <div className="loading-mark">
          <div className="loading-mark-glow" />
          <LogoZone size={84} />
        </div>
        <h1 className="loading-title">QUANT_CORE</h1>
        <p className="loading-tagline">Smart Money Concepts</p>
        {credit && <p className="loading-credit">{credit}</p>}
        {children ?? (
          <div className="loading-dots"><span /><span /><span /></div>
        )}
      </div>
    </div>
  );
}
