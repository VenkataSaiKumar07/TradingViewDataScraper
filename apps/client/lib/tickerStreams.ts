"use client";

import { priceClient } from "./rpc";
import { create } from "@bufbuild/protobuf";
import { ConnectError, Code } from "@connectrpc/connect";
import { SubscribeTickerRequestSchema } from "../../../gen/connectrpc/price/v1/price_pb";

type Update = { ticker: string; value: string; ts: bigint | number };
type OnUpdate = (u: Update) => void;

const USE_MANY = process.env.NEXT_PUBLIC_USE_SUBSCRIBE_MANY === "1";

const norm = (s: string) =>
  s.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 12);

function isStreamCancel(err: unknown, signal?: AbortSignal): boolean {

  if (err instanceof ConnectError && err.code === Code.Canceled) return true;

  const any = err as any;
  if (any?.name === "AbortError") return true;

  if (signal?.aborted) return true;

  return false;
}

const ctrls = new Map<string, AbortController>();

function startTickerSingle(symbol: string, onUpdate: OnUpdate): () => void {
  if (ctrls.has(symbol)) return () => {};
  const ac = new AbortController();
  ctrls.set(symbol, ac);
  (async () => {
    try {
      const req = create(SubscribeTickerRequestSchema, { ticker: symbol });
      for await (const u of priceClient.subscribeTicker(req, { signal: ac.signal })) {
        onUpdate(u as Update);
      }
    } catch (e: any) {
      if (!isStreamCancel(e, ac.signal)) {
        console.error("[client] subscribeTicker error", symbol, e);
      }
    } finally {
      ctrls.delete(symbol);
    }
  })();
  return () => stopTickerSingle(symbol);
}

function stopTickerSingle(symbol: string) {
  const ac = ctrls.get(symbol);
  if (ac) {
    ac.abort();
    ctrls.delete(symbol);
  }
}

let manyAc: AbortController | null = null;

const cbs = new Map<string, OnUpdate>();

function refreshManyStream() {

  if (manyAc) {
    manyAc.abort();
    manyAc = null;
  }
  const tickers = Array.from(cbs.keys());
  if (tickers.length === 0) return;

  const ac = new AbortController();
  manyAc = ac;

  (async () => {
    try {
      for await (const u of priceClient.subscribeMany({ tickers }, { signal: ac.signal })) {
        const msg = u as Update;
        const cb = cbs.get(msg.ticker);
        if (cb) cb(msg);
      }
    } catch (e: any) {
      if (!isStreamCancel(e, ac.signal)) {
        console.error("[client] subscribeTicker error", e);
      }
    } finally {
      if (manyAc === ac) manyAc = null;
    }
  })();
}

function startTickerMany(symbol: string, onUpdate: OnUpdate): () => void {
  cbs.set(symbol, onUpdate);
  refreshManyStream();
  return () => stopTickerMany(symbol);
}

function stopTickerMany(symbol: string) {
  if (!cbs.has(symbol)) return;
  cbs.delete(symbol);
  if (cbs.size === 0) {
    if (manyAc) { manyAc.abort(); manyAc = null; }
    return;
  }
  refreshManyStream();
}

export function startTicker(rawSymbol: string, onUpdate: OnUpdate): () => void {
  const symbol = norm(rawSymbol);
  if (!symbol) return () => {}; // ignore empty
  if (USE_MANY) return startTickerMany(symbol, onUpdate);
  return startTickerSingle(symbol, onUpdate);
}

export function stopTicker(rawSymbol: string) {
  const symbol = norm(rawSymbol);
  if (!symbol) return;
  if (USE_MANY) stopTickerMany(symbol);
  else stopTickerSingle(symbol);
}

export function stopAll() {
  if (USE_MANY) {
    cbs.clear();
    if (manyAc) { manyAc.abort(); manyAc = null; }
    return;
  }
  for (const [, ac] of ctrls) ac.abort();
  ctrls.clear();
}

export function activeCount() {
  return USE_MANY ? cbs.size : ctrls.size;
}
