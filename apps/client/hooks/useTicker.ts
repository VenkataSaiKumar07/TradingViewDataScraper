import { useCallback, useMemo, useState } from "react";
import type { Ticker } from "@/lib/types";

const normalize = (raw: string) =>
  raw.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 12);

export function useTickers() {
  const [tickersMap, setTickersMap] = useState<Record<string, Ticker>>({});

  const addTicker = useCallback((raw: string) => {
    const symbol = normalize(raw);
    if (!symbol) return false;

    setTickersMap(prev => {
      if (prev[symbol]) return prev; // ignore duplicates
      return { ...prev, [symbol]: { symbol, isLoading: true } };
    });
    return true;
  }, []);

  const removeTicker = useCallback((symbol: string) => {
    setTickersMap(prev => {
      const { [symbol]: _omit, ...rest } = prev;
      return rest;
    });
  }, []);

  const tickers = useMemo(
    () => Object.values(tickersMap).sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [tickersMap]
  );

  return { tickers, addTicker, removeTicker };
}
