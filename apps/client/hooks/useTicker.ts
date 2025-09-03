import { useCallback, useEffect, useMemo, useState } from "react";
import type { Ticker } from "@/lib/types";
import { startTicker, stopTicker, stopAll } from "@/lib/tickerStreams";
import type { SubscribeTickerResponse } from "../../../gen/connectrpc/price/v1/price_pb";


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
    console.log("update add 123");
    startTicker(symbol, (u) => {
      console.log("update", u.ticker, u.value, u.ts);
      setTickersMap(prev => {
        // if user removed it meanwhile, ignore
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