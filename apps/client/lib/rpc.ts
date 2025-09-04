import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { PriceService } from "../../../gen/connectrpc/price/v1/price_pb";

const transport = createConnectTransport({
  baseUrl: "http://127.0.0.1:8080",
  useBinaryFormat: false,
});

export const priceClient = createClient(PriceService, transport);
