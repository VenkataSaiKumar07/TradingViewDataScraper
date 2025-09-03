import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { PriceService } from "../../../gen/connectrpc/price/v1/price_pb";

const transport = createConnectTransport({
  // Next.js → proxy to your Node backend at http://localhost:8080
  // (add the rewrite in next.config.js below)
  baseUrl: "http://127.0.0.1:8080",
  useBinaryFormat: false,
});

export const priceClient = createClient(PriceService, transport);
