// apps/client/client.ts
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { PriceService } from "../../gen/connectrpc/price/v1/price_pb.js";
import { ConnectError, Code } from "@connectrpc/connect";


async function main() {
  const transport = createConnectTransport({
   baseUrl: "http://localhost:8080",
   httpVersion: "1.1"
})

  const client = createClient(PriceService, transport);

  // Pick a few tickers to test
  const tickers = ["BTCUSD", "ETHUSD", "DOGEUSD"];

  const ac = new AbortController();

  // Auto-abort after 15s so we can verify clean shutdown
  setTimeout(() => {
    console.log(">> aborting stream");
    ac.abort();
  }, 25000);

  try {
    console.log(">> starting SubscribeMany:", tickers.join(", "));
    for await (const msg of client.subscribeMany({ tickers }, { signal: ac.signal })) {
      // Expect: one message per event (not the whole list)
      // On start: you may get one initial per ticker if hub has last values
      console.log(`[${msg.ticker}] ${msg.value} @ ${msg.ts.toString()}`);
    }
    console.log(">> stream ended (complete)");
  } catch (e: any) {
    if (e?.name === "AbortError") {
      console.log(">> stream aborted");
    } else {
      console.error("!! stream error:", e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


// const transport = createConnectTransport({
//   baseUrl: "http://localhost:8080",
//   httpVersion: "1.1"
// });
// const client = createClient(PriceService, transport);

// const TICKERS = ["ETHUSDT", "BTCUSDT", "SOLUSD"];

// type Sub = { ac: AbortController; task: Promise<void> };
// const subs = new Map<string, Sub>();

// function subscribe(ticker: string) {
//   const ac = new AbortController();
//   const task = (async () => {
//     try {
//       for await (const u of client.subscribeTicker({ ticker }, { signal: ac.signal })) {
//         console.log(`[${ticker}] ${u}`);
//       }
//     } catch (e: any) {
//       // Normalize both cases: AbortController or ConnectError(Code.Canceled)
//       if (e?.name === "AbortError") {
//         console.log(`[${ticker}] aborted by client`);
//       } else if (e instanceof ConnectError && e.code === Code.Canceled) {
//         console.log(`[${ticker}] canceled (normal)`);
//       } else {
//         console.error(`[${ticker}] unexpected error:`, e);
//       }
//     }
//   })();
//   subs.set(ticker, { ac, task });
//   console.log(`[client] subscribed ${ticker}`);
// }

// function unsubscribe(ticker: string) {
//   const s = subs.get(ticker);
//   if (!s) return console.log(`[client] ${ticker} not subscribed`);
//   s.ac.abort();
//   subs.delete(ticker);
//   console.log(`[client] unsubscribed ${ticker}`);
// }

// async function main() {
//   // add several tickers
//   for (const t of TICKERS) subscribe(t);

//   // demo: remove one after 10s
//   setTimeout(() => unsubscribe("SOLUSD"), 10_000);

//   // setTimeout(() => subscribe("DOGEUSD"), 12_000);

//   // setTimeout(() => unsubscribe("ETHUSD"), 12_000);
// }
// main();