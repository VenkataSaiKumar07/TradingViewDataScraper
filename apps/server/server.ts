import http from "http";
import express from "express";
import routes from "./connect";
import { expressConnectMiddleware } from "@connectrpc/connect-express";

const app = express();

app.use((req, _res, next) => {
  console.log(
    `[req] ${req.method} ${req.url} content-type=${req.headers["content-type"]} connect-protocol=${req.headers["connect-protocol-version"]}`
  );
  next();
});

// 🩺 Simple health endpoint to confirm server is alive
app.get("/healthz", (_req, res) => res.send("ok"));


app.use(expressConnectMiddleware({
 routes,
}));

const PORT = 8080;
http.createServer(app).listen(PORT, () => {
  console.log(`[server] ConnectRPC listening at http://localhost:${PORT}`);
  console.log(`[server] Example RPC: POST http://localhost:${PORT}/price.v1.PriceService/SubscribeTicker`);
});




// curl -N \
//   -H 'Content-Type: application/json' \
//   -H 'Connect-Protocol-Version: 1' \
//   --data '{"ticker":"ETHUSD"}' \
//   http://localhost:8080/price.v1.PriceService/SubscribeTicker