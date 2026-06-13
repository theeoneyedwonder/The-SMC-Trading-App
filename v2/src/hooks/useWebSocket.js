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
        try { setData(JSON.parse(raw)); } catch {}
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
