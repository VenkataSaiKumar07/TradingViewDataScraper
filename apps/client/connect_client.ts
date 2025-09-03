"use client";

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { PriceService } from "../../gen/connectrpc/price/v1/price_pb";

// Base URL points to our Next rewrite
const transport = createConnectTransport({
  baseUrl: "/rpc", // Next proxies to http://127.0.0.1:8080
});

export const priceClient = createClient(PriceService, transport);
