import { BrowserContext } from "playwright";
import { streamTickerPrice } from "./playwatch"; // your existing Playwright streamer
import { getBrowserContext } from "./browser";              // simple singleton browser launcher

type Subscriber = (payload: { ticker: string; price: number; ts: number }) => void;

type Last = { price: number; ts: number };

const IDLE_CLOSE_MS = 1000;

interface Topic {
  subs: Set<Subscriber>;
  stop: () => Promise<void>;
  last?: Last;
  idleTimer?: NodeJS.Timeout | null;
}

export class TickerHub {
  private ctx?: BrowserContext;
  private topics = new Map<string, Topic>();

  private async ensureBrowser(): Promise<BrowserContext> {
    if (!this.ctx) this.ctx = await getBrowserContext();
    return this.ctx;
  }

  async subscribe(ticker: string, push: Subscriber): Promise<() => Promise<void>> {
    ticker = ticker.toUpperCase().trim();

    let topic = this.topics.get(ticker);
    if (!topic) {
      const subs = new Set<Subscriber>();
      const abort = new AbortController();
      const stop = async () => {
        if (!abort.signal.aborted) abort.abort();
      };

      topic = { subs, stop, idleTimer: null };
      this.topics.set(ticker, topic);

      const context = await this.ensureBrowser();

      // Start the Playwright stream for this ticker
      (async () => {
        console.log("[hub] start page for", ticker);
        for await (const u of streamTickerPrice(ticker, context, abort.signal)) {
          if (abort.signal.aborted) break;
          topic!.last = { price: u.price, ts: u.ts };
          for (const s of subs) s(u); // fan-out to subscribers
        }
      })().catch((e) => console.error(`[hub] stream error ${ticker}:`, e));
    }

    if (topic.idleTimer) {
    clearTimeout(topic.idleTimer);
    topic.idleTimer = null;
    }

    topic.subs.add(push);

    // return unsubscribe function
    return async () => {
      const t = this.topics.get(ticker);
      if (!t) return;

      t.subs.delete(push);

      if (t.subs.size === 0) {
        if (!t.idleTimer) {
            t.idleTimer = setTimeout(async () => {
            // Double-check still empty before closing (prevents race)
            const current = this.topics.get(ticker);
            if (!current || current.subs.size > 0) return;

            try {
                console.log("[hub] idle timeout -> stop page for", ticker);
                await current.stop();
            } finally {
                // Clean up the topic entry
                this.topics.delete(ticker);
            }
            }, IDLE_CLOSE_MS);
            console.log(`[hub] scheduled idle close for ${ticker} in ${IDLE_CLOSE_MS}ms`);
        }
        }
    };
  }

  getLast(ticker: string): Last | undefined {
    return this.topics.get(ticker.toUpperCase().trim())?.last;
  }

}
