import { chromium, BrowserContext, type Page } from "playwright";

// --- tiny helpers ---
const tvUrl = (t: string) => `https://www.tradingview.com/symbols/${t.toUpperCase().trim()}/?exchange=BINANCE`;

export function extractPriceSimple(raw: string): number | null {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  let line2 = lines[1]!; // the price line
  // remove commas
  line2 = line2.replace(/,/g, "");
  // drop trailing non-digit/decimal chars
  line2 = line2.replace(/[^0-9.]+$/, "");

  const num = parseFloat(line2);
  return isNaN(num) ? null : num;
}

// Watch a ticker and yield the RAW header text whenever it CHANGES.
// No parsing, no queue, just last-value check + single "next" resolver.
export async function* streamTickerPrice(
  ticker: string,
  context: BrowserContext,
  signal: AbortSignal,
): AsyncGenerator<{ ticker: string; price: number; ts: number }, void, void> {
  let alive = true;

  const page: Page = await context.newPage();
  await page.goto(tvUrl(ticker), { waitUntil: "domcontentloaded" });

  const header = page.locator(".js-symbol-page-header-root:visible").first();
  await header.waitFor({ state: "visible", timeout: 15_000 });

  const box = header.locator(".js-symbol-header-ticker:not(.i-hidden)").first();
  await box.waitFor({ state: "visible", timeout: 15_000 });

  // log page console too (helps while validating content)
  // page.on("console", (msg) => console.log(`[page:${ticker}]`, msg.text()));

  let lastPrice: number | undefined;
  const queue: { ticker: string; price: number; ts: number }[] = [];
  let resolveNext:
    | ((r: IteratorResult<{ ticker: string; price: number; ts: number }>) => void)
    | null = null;

  const push = (msg: { ticker: string; price: number; ts: number }) => {
    if (!alive) return;
    if (resolveNext) {
      const r = resolveNext; resolveNext = null;
      r({ value: msg, done: false });
    } else {
      queue.push(msg);
    }
  };

  const stopNow = async () => {
    if (!alive) return;
    alive = false;
    try {
      await page.evaluate(() => {
        // @ts-ignore
        (window as any).__tvStopped__ = true;
        // @ts-ignore
        const obs = (window as any).__tvObs__ as MutationObserver | undefined;
        if (obs) obs.disconnect();
        // @ts-ignore
        (window as any).emitRawFromPage = () => {};
      });
    } catch {}
    if (resolveNext) { 
      const r = resolveNext; 
      resolveNext = null; 
      r({ value: undefined as any, done: true }); 
    }
  };

  if (signal.aborted) {
    await stopNow(); // handle race: aborted before listener added
    // fall through to finally{}
  } else {
    signal.addEventListener("abort", () => { void stopNow(); }, { once: true });
  }

  // bridge page -> node
  await page.exposeFunction("emitRawFromPage", (rawText: string) => {
    const raw = (rawText ?? "").trim();
    const price = extractPriceSimple(raw)
    if (!price || price === lastPrice) return; // dedupe only
    lastPrice = price;

    const payload = { ticker: ticker.toUpperCase(), price, ts: Date.now() };
    console.log(`[Playwright] Scrapped price for ${ticker}:`, price);

    push({ ticker: ticker.toUpperCase(), price, ts: Date.now() });
  });

  // attach a MutationObserver and also emit initial text once
  await page.evaluate(() => {
    // @ts-ignore
    const emit = (window as any).emitRawFromPage as (t: string) => void;
    const target = document.querySelector(".js-symbol-header-ticker:not(.i-hidden)");
    if (!target) {
      console.log("No ticker element found");
      return;
    }

    // initial emit
    emit((target as HTMLElement).innerText || "");

    const obs = new MutationObserver(() => {
      emit((target as HTMLElement).innerText || "");
    });
    obs.observe(target, { subtree: true, childList: true, characterData: true });
    // @ts-ignore
    (window as any).__tvObs__ = obs;
  });

  try {
    // generator: wait for next emit each time (no queue)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (queue.length) {
        const msg = queue.shift()!;
        yield msg;
        continue;
      }
      const next = await new Promise<IteratorResult<{ ticker: string; price: number; ts: number }>>(
        (res) => (resolveNext = res)
      );
      if (next.done) return;
      yield next.value!;
    }
  } finally {
    await page.evaluate(() => {
      // @ts-ignore
      const obs = (window as any).__tvObs__ as MutationObserver | undefined;
      if (obs) obs.disconnect();
    });
    await page.close().catch(() => {});
  }
}