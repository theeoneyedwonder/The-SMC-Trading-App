import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AIPanel, { SageMark } from './AIPanel';

// In the packaged/dev Electron app, Sage opens as its own top-level window
// (see electron/main.js createSageWindow) so window managers — Hyprland,
// i3, even plain Windows snap — can tile or move it independently instead
// of it being an overlay stuck on top of the chart. In a plain browser
// (e.g. `npm run dev` for quick UI iteration) there's no Electron shell to
// open a second window in, so it falls back to the in-page slide-over.
const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.openSageWindow;

export default function SageBubble({ data, nudge, hidden, onAIAnalysis }) {
  const [open, setOpen]         = useState(false);
  const [hasUnread, setUnread]  = useState(false);
  const lastNudgeId             = useRef(null);

  // Cross-window bridge: the popped-out Sage window can't reach into this
  // window's React state directly, so it posts marked-up levels here over a
  // same-origin BroadcastChannel instead of needing new Electron IPC.
  useEffect(() => {
    if (!isElectron || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('sage-analysis');
    channel.onmessage = (e) => {
      if (e.data?.type === 'levels') onAIAnalysis?.(e.data.levels ?? []);
    };
    return () => channel.close();
  }, [onAIAnalysis]);

  // A nudge arriving lights up the FAB. In-page mode: only while the panel
  // is closed (it's already visible otherwise). Electron mode: always, since
  // this window has no idea whether the separate Sage window is focused.
  useEffect(() => {
    if (!nudge || nudge.id === lastNudgeId.current) return;
    lastNudgeId.current = nudge.id;
    if (isElectron || !open) setUnread(true);
  }, [nudge, open]);

  const toggle = () => {
    if (isElectron) {
      window.electronAPI.openSageWindow();
      setUnread(false);
      return;
    }
    setOpen(o => {
      const next = !o;
      if (next) setUnread(false);
      return next;
    });
  };

  return (
    <>
      {/* ── In-page fallback panel (non-Electron / dev browser only) ── */}
      {!isElectron && (
        <AnimatePresence>
          {open && (
            <motion.div
              className="sage-side-panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <AIPanel
                data={data}
                nudge={nudge}
                onClose={() => setOpen(false)}
                onAIAnalysis={onAIAnalysis}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── FAB — hidden while the in-page panel is open (it has its own
          close button, and the FAB's fixed viewport position would
          otherwise land on top of the panel's send button). Also hidden
          while the watchlist panel is open, since that docks to the same
          bottom-right corner. Always shown in Electron mode otherwise,
          where it just opens/focuses the Sage window. ── */}
      <AnimatePresence>
        {!open && !hidden && (
          <motion.button
            className="sage-fab"
            onClick={toggle}
            title="Sage — AI Companion"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.88, transition: { type: 'spring', stiffness: 600, damping: 10 } }}
          >
            {hasUnread && <span className="sage-fab-badge" />}
            <SageMark size={24} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
