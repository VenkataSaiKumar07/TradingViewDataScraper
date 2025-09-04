import type { ConnectRouter, HandlerContext } from "@connectrpc/connect";
import { PriceService } from "../../gen/connectrpc/price/v1/price_pb";
import type { SubscribeTickerRequest } from "../../gen/connectrpc/price/v1/price_pb";
import { TickerHub } from "./ticker_hub";
import { create } from "@bufbuild/protobuf";
import { SubscribeTickerResponseSchema } from "../../gen/connectrpc/price/v1/price_pb";

const hub = new TickerHub();

export default (router: ConnectRouter) =>
  router.service(PriceService, {
    async *subscribeTicker(req, ctx) {
      console.log("[PriceConnect] subscribeTicker called with:", req);
      const r = req as unknown as SubscribeTickerRequest;
      const ticker = (r.ticker ?? "").toUpperCase().trim();
      
      let resolve: ((v: IteratorResult<any>) => void) | null = null;
      let unsubbed = false;

      const unsubscribe = await hub.subscribe(ticker, (u) => {
        if (unsubbed) return;
        if (!resolve) return;
        const r = resolve; resolve = null;
        console.log(`[PriceConnect] Pushing ticker: ${ticker}, price: ${String(u.price)} data to client`);
        r({
          value: {
            ticker,
            value: String(u.price),
            ts: BigInt(u.ts),
          },
          done: false,
        });
      });

      const doUnsub = async () => {
        if (unsubbed) return;
        unsubbed = true;
        console.log(`[PriceConnect] Cancelling streaming for ticker: ${ticker}`);
        try { await unsubscribe(); } catch {}
      };

      const wakeDone = () => {
        if (resolve) { const r = resolve; resolve = null; r({ value: undefined as any, done: true }); }
      };

      try {
        const last = hub.getLast(ticker);
        if (last?.price != null) {
          yield create(SubscribeTickerResponseSchema, {
            ticker,
            value: last.price.toString(),
            ts: BigInt(last.ts),
          });
        }

        if (ctx.signal.aborted) {
          await doUnsub();
          wakeDone();
          return; // exit immediately
        } else {
          ctx.signal.addEventListener("abort", () => {
            // unsubscribe now and wake the pending await so we don't wait for another tick
            (async () => { await doUnsub(); wakeDone(); })().catch(() => {});
          }, { once: true });
        }

        while (!ctx.signal.aborted) {
          const next = await new Promise<IteratorResult<any>>((res) => (resolve = res));
          if (next.done) break;
          yield next.value!;
        }
      } finally {
        console.log(`[PriceConnect] Closed streaming for ticker: ${ticker}`);
        await doUnsub();
      }
    },

    async *subscribeMany(req, ctx) {
      // Normalize input list: uppercase, trim, dedupe, sort (stable restarts)
      const inTickers = ((req as any).tickers ?? []) as string[];
      const tickers = Array.from(
        new Set(inTickers.map(t => (t ?? "").toUpperCase().trim()).filter(Boolean))
      ).sort();

      if (tickers.length === 0) return;

      // tiny queue + resolver so we can push initial values and wake on abort
      const queue: any[] = [];
      let resolve: ((it: IteratorResult<any>) => void) | null = null;
      let active = true;

      const push = (msg: any) => {
        if (!active) return;
        if (resolve) {
          const r = resolve; resolve = null;
          r({ value: msg, done: false });
        } else {
          queue.push(msg);
        }
      };

      // map hub tick -> RPC message
      const toMsg = (ticker: string, u: { price?: number; value?: number | string; ts: number }) => {
        const v = u.price ?? (typeof u.value === "string" ? Number(u.value) : u.value);
        return create(SubscribeTickerResponseSchema, {
          ticker,
          value: String(v),
          ts: BigInt(u.ts),
        });
      };

      // subscribe to all tickers
      const unsubscribes: Array<() => Promise<void>> = [];
      let unsubbed = false;

      const doUnsubAll = async () => {
        if (unsubbed) return;
        unsubbed = true;
        // run all, ignore individual errors
        await Promise.allSettled(unsubscribes.map(fn => fn().catch(() => {})));
      };

      const wakeDone = () => {
        if (resolve) { const r = resolve; resolve = null; r({ value: undefined as any, done: true }); }
      };

      // register subscriptions first so we can safely push initials after
      for (const tkr of tickers) {
        const unsubscribe = await hub.subscribe(tkr, (u) => {
          if (!active || unsubbed) return;           // guard late ticks after abort
          push(toMsg(tkr, u));                       // one message per event
        });
        unsubscribes.push(unsubscribe);
      }

      // send cached initial (one per ticker) if available
      for (const tkr of tickers) {
        const last = hub.getLast(tkr);
        if (last?.price != null) push(toMsg(tkr, last));
      }

      // abort wiring: unsubscribe NOW and wake the loop (don’t wait for next price)
      if (ctx.signal.aborted) {
        await doUnsubAll();
        active = false;
        wakeDone();
        return;
      } else {
        ctx.signal.addEventListener("abort", () => {
          (async () => { await doUnsubAll(); active = false; wakeDone(); })().catch(() => {});
        }, { once: true });
      }

      try {
        while (active) {
          if (queue.length) {
            yield queue.shift()!;
            continue;
          }
          const next = await new Promise<IteratorResult<any>>(res => (resolve = res));
          if (next.done) break;
          yield next.value!;
        }
      } finally {
        await doUnsubAll(); // idempotent cleanup
      }
    },

  });