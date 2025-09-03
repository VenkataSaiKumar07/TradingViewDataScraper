import http from "http";
import express from "express";
import routes from "./connect";
import cors from "cors";
import { expressConnectMiddleware } from "@connectrpc/connect-express";

const app = express();


const ALLOW_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

app.use(
  cors({
    // Use a function so we can allow 'null' (file://) cleanly
    origin(origin, callback) {
      // Non-browser clients or same-origin (no Origin header)
      if (!origin) return callback(null, true);

      // file:// requests show up as the literal string "null"
      if (origin === "null") return callback(null, true);

      if (ALLOW_ORIGINS.includes(origin)) return callback(null, true);

      // Block everything else
      return callback(null, false);
    },
    methods: ["POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Connect-Protocol-Version",
      "Connect-Content-Encoding",
      "Connect-Accept-Encoding",
      "X-User-Agent",
    ],
    // credentials: false, // default; keep it off unless you need cookies
  })
);

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