"use client";

import { priceClient } from "./rpc";
import { create } from "@bufbuild/protobuf";
import { SubscribeTickerRequestSchema } from "../../../gen/connectrpc/price/v1/price_pb";

type Update = { ticker: string; value: string; ts: bigint | number };
type OnUpdate = (u: Update) => void;

const ctrls = new Map<string, AbortController>(); // symbol -> controller

const norm = (s: string) =>
  s.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 12);

/** Open a stream for one ticker. Returns a cancel() function. */
export function startTicker(rawSymbol: string, onUpdate: OnUpdate): () => void {
  const symbol = norm(rawSymbol);
  if (!symbol || ctrls.has(symbol)) return () => {}; // ignore empty/duplicate

  const ac = new AbortController();
  ctrls.set(symbol, ac);

  (async () => {
    try {
      const req = create(SubscribeTickerRequestSchema, { ticker: symbol });
      const stream = priceClient.subscribeTicker(req, { signal: ac.signal });
      console.log("[stream] opened for", symbol);
      for await (const msg of stream) {
        console.log("[stream] got msg", msg.ticker, msg.value, msg.ts); // <-- MUST SEE THIS
        onUpdate({
          ticker: msg.ticker,
          value: msg.value,
          ts: typeof msg.ts === "bigint" ? msg.ts : Number(msg.ts),
        });
      }
      console.log("[stream] ended normally for", symbol);
    } catch (e: any) {
      // Abort is expected on remove; log others for visibility
      if (e?.name !== "AbortError") console.warn("stream error", symbol, e);
    } finally {
      // stream ended (abort or server close) -> drop controller
      ctrls.delete(symbol);
    }
  })();

  return () => stopTicker(symbol);
}

/** Abort one ticker’s stream. */
export function stopTicker(rawSymbol: string) {
  const symbol = norm(rawSymbol);
  const ac = ctrls.get(symbol);
  if (ac) {
    ac.abort();
    ctrls.delete(symbol);
  }
}

/** Abort all streams (e.g., when no tickers remain or on unmount). */
export function stopAll() {
  for (const [, ac] of ctrls) ac.abort();
  ctrls.clear();
}

/** Optional: how many active streams are open. */
export function activeCount() {
  return ctrls.size;
}
