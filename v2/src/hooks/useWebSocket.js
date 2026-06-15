import { useState, useEffect, useRef } from 'react';

const WS_URL = 'ws://127.0.0.1:8000/ws';

export function useWebSocket() {
  const [data, setData]           = useState(null);
  const [connected, setConnected] = useState(false);
  const mountedRef                = useRef(true);
  const wsRef                     = useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen  = () => { if (mountedRef.current) setConnected(true); };
      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = ({ data: raw }) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(raw);
          // Two message types arrive on different cadences:
          //   { type:'live',     symbol, account, trades }      ~300ms
          //   { type:'patterns', symbol, indicators, patterns } ~30s
          // Merge per-field so a fast 'live' update never wipes the
          // pattern overlay, and a slow 'patterns' update never wipes
          // the live account/trades/P&L.
          setData(prev => {
            const next = prev ? { ...prev } : {};
            if (msg.symbol     != null) next.symbol     = msg.symbol;
            if (msg.account    != null) next.account    = msg.account;
            if (msg.trades     != null) next.trades     = msg.trades;
            if (msg.patterns   != null) next.patterns   = msg.patterns;
            if (msg.indicators != null) next.indicators = msg.indicators;
            return next;
          });
        } catch {}
      };
    }

    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, []);

  return { data, connected };
}
