"use client";

import { useRef, useState } from "react";
import styles from "@/styles/TokenPrices.module.css";
import { useTickers } from "../hooks/useTicker";

export default function TokenPrices() {
  const { tickers, addTicker, removeTicker } = useTickers();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    console.log(`[Client] Calling server on Ticker: ${input}`)
    const ok = addTicker(input);
    if (ok) {
      setInput("");
      inputRef.current?.focus();
    }
  };

  return (
    <main className={styles.container}>
      <section className={styles.card} aria-label="Token Prices">
        <h1 className={styles.title}>Token Prices</h1>

        <form className={styles.inputRow} onSubmit={onSubmit}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Enter ticker (e.g., BTC, ETH)…"
            className={styles.input}
            aria-label="Ticker symbol"
          />
          <button
            type="submit"
            className={styles.addButton}
            disabled={!input.trim()}
          >
            Add
          </button>
        </form>

        <div className={styles.list} role="list" aria-label="Ticker list">
          {tickers.length === 0 ? (
            <div className={styles.empty}>No tickers yet. Add your first one!</div>
          ) : (
            tickers.map((t) => (
              <div className={styles.row} role="listitem" key={t.symbol}>
                <span className={styles.symbol} title={t.symbol}>{t.symbol}</span>
                <span className={styles.price} aria-live="polite">
                  {t.isLoading ? "Loading…" : (t.price ?? "—")}
                </span>
                <button
                  className={styles.removeButton}
                  onClick={() => removeTicker(t.symbol)}
                  aria-label={`Remove ${t.symbol}`}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
