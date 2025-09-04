export interface Ticker {
  symbol: string;
  price?: string;
  isLoading: boolean;
  lastTs?: bigint | number;
}