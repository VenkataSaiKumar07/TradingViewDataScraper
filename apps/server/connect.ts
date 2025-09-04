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
  });