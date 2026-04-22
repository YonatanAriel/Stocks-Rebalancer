'use client';

import React, { useEffect, useRef } from 'react';

export function TradingViewWidget({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current) {
      // Clear container first
      container.current.innerHTML = '';
      
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
      script.type = "text/javascript";
      script.async = true;
      
      // TASE symbols on TradingView usually follow the format TASE:TICKER
      const tvSymbol = /^\d+$/.test(symbol) ? `TASE:${symbol}` : symbol;

      script.innerHTML = JSON.stringify({
        "symbol": tvSymbol,
        "width": "100%",
        "height": 220,
        "locale": "en",
        "dateRange": "12M",
        "colorTheme": "dark",
        "trendLineColor": "rgba(41, 98, 255, 1)",
        "underLineColor": "rgba(41, 98, 255, 0.3)",
        "isTransparent": true,
        "autosize": false,
        "largeChartUrl": ""
      });
      
      container.current.appendChild(script);
    }
  }, [symbol]);

  return (
    <div className="tradingview-widget-container" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
}
