import { chromium, Browser, BrowserContext } from "playwright";

let ctxPromise: Promise<BrowserContext> | null = null;

export async function getBrowserContext(): Promise<BrowserContext> {
  if (ctxPromise) return ctxPromise;

  ctxPromise = (async () => {
    console.log("[Browser] launching Chromium (headed, single window)");
    const browser: Browser = await chromium.launch({ headless: false }); // hard-wired headed
    const ctx: BrowserContext = await browser.newContext({
      viewport: { width: 1280, height: 840 },
    });

    // graceful shutdown
    const shutdown = async () => {
      try { await ctx.close(); } catch {}
      try { await browser.close(); } catch {}
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    return ctx;
  })();

  return ctxPromise;
}