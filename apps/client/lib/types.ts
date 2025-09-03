export interface Ticker {
  symbol: string;          // "BTC"
  price?: string;          // comes as string in your proto; keep as-is
  isLoading: boolean;      // shows "Loading…" until first push arrives
  lastTs?: bigint | number; // optional monotonic guard if you add it later
}