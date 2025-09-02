import type { ConnectRouter, HandlerContext } from "@connectrpc/connect";
import { PriceService } from "../../gen/connectrpc/price/v1/price_pb";
import type { SubscribeTickerRequest } from "../../gen/connectrpc/price/v1/price_pb";
import { streamTickerRaw } from "./playwatch.js";

export default (router: ConnectRouter) => {
  // registers connectrpc.price.v1.PriceService
  console.log("[Router] Registering PriceService...");
  router.service(PriceService, {
    // implements rpc GetPrice
    async *subscribeTicker(req: SubscribeTickerRequest, ctx: HandlerContext) {
      console.log("[PriceService] subscribeTicker called with:", req);
      const ticker = (req.ticker ?? "").toUpperCase().trim();
      for await (const u of streamTickerRaw(ticker)) {
        if (ctx.signal.aborted) break;
        // yield SubscribeTickerResponse.create({
        //   ticker,
        //   value: u.raw,               // ← raw text as-is (no parsing yet)
        //   ts: BigInt(u.ts),           // int64 → bigint
        // });
        yield { ticker, value: String(u.price), ts: BigInt(Date.now()) };
      }
    },
  });
};