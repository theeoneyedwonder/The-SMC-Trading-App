import AIPanel from './components/AIPanel';
import { useWebSocket } from './hooks/useWebSocket';

// Same-origin, cross-window channel — lets the popped-out Sage window still
// mark key levels on the chart in the main dashboard window without any
// Electron IPC plumbing (both windows load the same origin/session).
const analysisChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('sage-analysis')
  : null;

export default function SageWindow() {
  // Independent WebSocket connection straight to the backend — the backend
  // already broadcasts live/patterns/nudges to every connected client, so
  // this window gets the same real-time data as the main dashboard for free.
  const { data, nudge } = useWebSocket();

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <AIPanel
        data={data}
        nudge={nudge}
        onClose={() => window.close()}
        onAIAnalysis={levels => analysisChannel?.postMessage({ type: 'levels', levels })}
      />
    </div>
  );
}
