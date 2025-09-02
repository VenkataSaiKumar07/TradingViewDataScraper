import type { ConnectRouter, HandlerContext } from "@connectrpc/connect";
import { PriceService } from "../../gen/connectrpc/price/v1/price_pb";
import type { SubscribeTickerRequest } from "../../gen/connectrpc/price/v1/price_pb";
import { TickerHub } from "./ticker_hub";

const hub = new TickerHub();


export default (router: ConnectRouter) =>
  router.service(PriceService, {
    async *subscribeTicker(req: SubscribeTickerRequest, ctx) {
      const ticker = (req.ticker ?? "").toUpperCase().trim();

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
        if (last) {
          yield {
            ticker,
            value: last.price.toString(),
            ts: BigInt(last.ts),
          };
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










//   // registers connectrpc.price.v1.PriceService
//   console.log("[Router] Registering PriceService...");
//   router.service(PriceService, {
//     // implements rpc GetPrice
//     async *subscribeTicker(req: SubscribeTickerRequest, ctx: HandlerContext) {
//       console.log("[PriceService] subscribeTicker called with:", req);
//       const ticker = (req.ticker ?? "").toUpperCase().trim();
//       for await (const u of streamTickerPrice(ticker)) {
//         if (ctx.signal.aborted) break;
//         // yield SubscribeTickerResponse.create({
//         //   ticker,
//         //   value: u.raw,               // ← raw text as-is (no parsing yet)
//         //   ts: BigInt(u.ts),           // int64 → bigint
//         // });
//         yield { ticker, value: String(u.price), ts: BigInt(Date.now()) };
//       }
//     },
//   });
// };
