import { chromium, Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    console.log("[Browser] launching Chromium")
    browserPromise = chromium.launch({ headless: false });
  }
  return browserPromise;
}