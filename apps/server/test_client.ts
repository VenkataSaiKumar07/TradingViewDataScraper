// apps/client/client.ts
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { PriceService } from "../../gen/connectrpc/price/v1/price_pb.js";
import { ConnectError, Code } from "@connectrpc/connect";

const transport = createConnectTransport({
  baseUrl: "http://localhost:8080",
  httpVersion: "1.1"
});
const client = createClient(PriceService, transport);

const TICKERS = ["ETHUSDT", "BTCUSDT", "SOLUSD"];

type Sub = { ac: AbortController; task: Promise<void> };
const subs = new Map<string, Sub>();

function subscribe(ticker: string) {
  const ac = new AbortController();
  const task = (async () => {
    try {
      for await (const u of client.subscribeTicker({ ticker }, { signal: ac.signal })) {
        console.log(`[${ticker}] ${u}`);
      }
    } catch (e: any) {
      // Normalize both cases: AbortController or ConnectError(Code.Canceled)
      if (e?.name === "AbortError") {
        console.log(`[${ticker}] aborted by client`);
      } else if (e instanceof ConnectError && e.code === Code.Canceled) {
        console.log(`[${ticker}] canceled (normal)`);
      } else {
        console.error(`[${ticker}] unexpected error:`, e);
      }
    }
  })();
  subs.set(ticker, { ac, task });
  console.log(`[client] subscribed ${ticker}`);
}

function unsubscribe(ticker: string) {
  const s = subs.get(ticker);
  if (!s) return console.log(`[client] ${ticker} not subscribed`);
  s.ac.abort();
  subs.delete(ticker);
  console.log(`[client] unsubscribed ${ticker}`);
}

async function main() {
  // add several tickers
  for (const t of TICKERS) subscribe(t);

  // demo: remove one after 10s
  setTimeout(() => unsubscribe("SOLUSD"), 10_000);

  // setTimeout(() => subscribe("DOGEUSD"), 12_000);

  // setTimeout(() => unsubscribe("ETHUSD"), 12_000);
}
main();