import { useEffect, useRef } from 'react';
import MarketSourcePicker from './MarketSourcePicker';

export default function TradingViewResearch({
  symbol,
  providers,
  executionProvider,
  executionSymbol,
  onChangeMarket,
  onOpenSettings,
}) {
  const widgetRef = useRef(null);

  useEffect(() => {
    const host = widgetRef.current;
    if (!host) return undefined;
    host.replaceChildren();

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';
    host.appendChild(widget);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: symbol || 'OANDA:XAUUSD',
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: false,
      save_image: true,
      support_host: 'https://www.tradingview.com',
    });
    host.appendChild(script);

    return () => host.replaceChildren();
  }, [symbol]);

  return (
    <>
      <div className="qc-chart-commandbar qc-research-commandbar">
        <MarketSourcePicker
          provider="tradingview"
          symbol={symbol}
          providers={providers}
          executionProvider={executionProvider}
          onChangeMarket={onChangeMarket}
          onOpenSettings={onOpenSettings}
        />
        <div className="qc-chart-command-spacer" />
        <span className="qc-research-boundary">RESEARCH ONLY</span>
        <span className="qc-research-routing">ORDERS ROUTE TO {executionProvider?.toUpperCase() || 'MT5'}:{executionSymbol}</span>
      </div>
      <div className="qc-tradingview-stage">
        <div ref={widgetRef} className="tradingview-widget-container" />
        <noscript>TradingView Research Mode requires JavaScript and internet access.</noscript>
      </div>
    </>
  );
}
