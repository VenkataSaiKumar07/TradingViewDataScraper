import { useCallback, useEffect, useMemo, useState } from "react";
import type { Ticker } from "@/lib/types";
import { startTicker, stopTicker, stopAll } from "@/lib/tickerStreams";


const normalize = (raw: string) =>
  raw.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 12);

export function useTickers() {
  const [tickersMap, setTickersMap] = useState<Record<string, Ticker>>({});

  const addTicker = useCallback((raw: string) => {
    const symbol = normalize(raw);
    if (!symbol) return false;
    // ignore duplicates
    if (tickersMap[symbol]) return true;

    // show row immediately as "Loading…"
    setTickersMap(prev => ({ ...prev, [symbol]: { symbol, isLoading: true } }));

    // open backend stream; update row on each push
    console.log(`[client] Adding the Ticker: ${symbol} to Price List`);
    startTicker(symbol, (u) => {
      setTickersMap(prev => {
        if (!prev[u.ticker]) return prev;
        return {
          ...prev,
          [u.ticker]: {
            ...prev[u.ticker],
            price: u.value,
            isLoading: false,
            lastTs: u.ts,
          },
        };
      });
    });

    return true;
  }, [tickersMap]);

  const removeTicker = useCallback((symbol: string) => {
    stopTicker(symbol); // unsubscribe on backend
    console.log(`[client] Removing the Ticker: ${symbol} from Price List`);
    setTickersMap(prev => {
      const { [symbol]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);

  // if no tickers left, make sure all streams are stopped
  useEffect(() => {
    if (Object.keys(tickersMap).length === 0) stopAll();
  }, [tickersMap]);

  // cleanup on unmount
  useEffect(() => () => stopAll(), []);

  const tickers = useMemo(
    () => Object.values(tickersMap).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [tickersMap]
  );

  return { tickers, addTicker, removeTicker };
}