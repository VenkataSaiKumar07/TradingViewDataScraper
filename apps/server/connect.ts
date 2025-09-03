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
      console.log("[PriceService] subscribeTicker called with:", req);
      const r = req as unknown as SubscribeTickerRequest;
      const ticker = (r.ticker ?? "").toUpperCase().trim();
      
      let resolve: ((v: IteratorResult<any>) => void) | null = null;

      const unsubscribe = await hub.subscribe(ticker, (u) => {
        if (!resolve) return;
        const r = resolve; resolve = null;
        r({
          value: {
            ticker,
            value: String(u.price),
            ts: BigInt(u.ts),
          },
          done: false,
        });
      });

      try {
        const last = hub.getLast(ticker);
        console.log(`[PriceService] ticker sending the price ${last?.price} for ${ticker}`);
        if (last) {
          yield create(SubscribeTickerResponseSchema, {
            ticker,
            value: last.price.toString(),
            ts: BigInt(last.ts),
          });
        }

        while (!ctx.signal.aborted) {
          const next = await new Promise<IteratorResult<any>>((res) => (resolve = res));
          if (next.done) break;
          yield next.value!;
        }
      } finally {
        await unsubscribe();
      }
    },
  });