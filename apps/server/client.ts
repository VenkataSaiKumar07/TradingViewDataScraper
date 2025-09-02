// apps/client/client.ts
import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { PriceService } from "../../gen/connectrpc/price/v1/price_pb.js";

const transport = createConnectTransport({
  baseUrl: "http://localhost:8080",
  httpVersion: "1.1"
});
const client = createClient(PriceService, transport);

const ac = new AbortController();
const call = client.subscribeTicker({ ticker: "ETHUSD" }, { signal: ac.signal });

(async () => {
  try {
    for await (const u of call) console.log("update:", u);
  } catch (e) {
    if ((e as any).name === "AbortError") console.log("stream aborted");
    else console.error(e);
  }
})();

// ac.abort(); 
