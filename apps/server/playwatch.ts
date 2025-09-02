import { chromium, type Browser, type Page } from "playwright";

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
  browser: Browser
): AsyncGenerator<{ ticker: string; price: number; ts: number }, void, void> {
  const page: Page = await browser.newPage();
  await page.goto(tvUrl(ticker), { waitUntil: "domcontentloaded" });

  const header = page.locator(".js-symbol-page-header-root:visible").first();
  await header.waitFor({ state: "visible", timeout: 15_000 });

  const box = header.locator(".js-symbol-header-ticker:not(.i-hidden)").first();
  await box.waitFor({ state: "visible", timeout: 15_000 });

  // log page console too (helps while validating content)
  page.on("console", (msg) => console.log(`[page:${ticker}]`, msg.text()));

  let lastPrice: number | undefined;
  let resolveNext:
    | ((r: IteratorResult<{ ticker: string; price: number; ts: number }>) => void)
    | null = null;

  // bridge page -> node
  await page.exposeFunction("emitRawFromPage", (rawText: string) => {
    const raw = (rawText ?? "").trim();
    const price = extractPriceSimple(raw)
    if (!price || price === lastPrice) return; // dedupe only
    lastPrice = price;


    const payload = { ticker: ticker.toUpperCase(), price, ts: Date.now() };
    console.log(`${ticker}:`, price); // <— you wanted to see this BEFORE parsing

    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r({ value: payload, done: false });
    }
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