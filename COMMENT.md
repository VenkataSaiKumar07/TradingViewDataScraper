Hey Team — thanks for the opportunity! A few quick notes to help you review:

What I Built

Reliable streaming: fixed the two common races (missing initial tick + late-unsubscribe) with a tiny queue and immediate abort cleanup.

One-stream mode: added SubscribeMany so the browser uses one RPC for many tickers (avoids the ~6 per-host request cap).

Graceful lifecycle: tabs close promptly when unused; a small idle-close grace prevents close/reopen flapping.

Simple dev UX: run.sh runs codegen and starts both apps.


How to run

pnpm install --recursive

./run.sh

open http://localhost:3000

add/remove tickers to test streaming + cleanup


Scalability & multi-client behavior

Single hub per server: the hub tracks a topic per ticker and shares it across all clients.

Reuse, don’t duplicate: the first subscriber starts the Playwright tab; additional clients reuse the same stream. No extra tabs for the same ticker.

Fan-out is O(1): each incoming price is broadcast to current subs; unsubscribes drop ref-counts, and when the last sub leaves the tab closes after a short grace.

Result: multiple clients can watch overlapping ticker sets with minimal overhead.


Env Var Note

Single-stream mode is enabled by setting the env in client;  per-ticker streams can be toggled via NEXT_PUBLIC_USE_SUBSCRIBE_MANY.