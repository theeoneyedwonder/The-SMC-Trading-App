import { useState, useEffect, useRef } from 'react';

const WS_URL = 'ws://127.0.0.1:8000/ws';

export function useWebSocket() {
  const [data, setData]           = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef                     = useRef(null);
  const timerRef                  = useRef(null);
  const mountedRef                = useRef(true);

  const connect = () => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) setConnected(true);
    };

    ws.onmessage = (e) => {
      if (!mountedRef.current) return;
      try { setData(JSON.parse(e.data)); } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      timerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  };

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { data, connected };
}
