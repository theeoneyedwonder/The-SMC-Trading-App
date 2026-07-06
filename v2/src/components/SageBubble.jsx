import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AIPanel, { SageMark } from './AIPanel';

export default function SageBubble({ data, nudge, onAIAnalysis }) {
  const [open, setOpen]         = useState(false);
  const [hasUnread, setUnread]  = useState(false);
  const lastNudgeId             = useRef(null);

  // A nudge arriving while Sage is closed just lights up the FAB — the
  // message itself is already persisted server-side, so opening the panel
  // will show it via the normal history load.
  useEffect(() => {
    if (!nudge || nudge.id === lastNudgeId.current) return;
    lastNudgeId.current = nudge.id;
    if (!open) setUnread(true);
  }, [nudge, open]);

  const toggle = () => setOpen(o => {
    const next = !o;
    if (next) setUnread(false);
    return next;
  });

  return (
    <>
      {/* ── Full-height right panel (pins to half the screen) ── */}
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

      {/* ── FAB ── */}
      <motion.button
        className={`sage-fab${open ? ' open' : ''}`}
        onClick={toggle}
        title="Sage — AI Companion"
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.88, transition: { type: 'spring', stiffness: 600, damping: 10 } }}
      >
        {hasUnread && !open && <span className="sage-fab-badge" />}
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="x"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ fontSize: 18, lineHeight: 1 }}
            >
              ✕
            </motion.span>
          ) : (
            <motion.span
              key="logo"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <SageMark size={24} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
