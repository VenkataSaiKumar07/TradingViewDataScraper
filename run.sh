#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▶︎ Codegen (buf generate)…"
# Prefer workspace-local buf if available; fall back to root script
if pnpm -C "$ROOT" exec buf --version >/dev/null 2>&1; then
  pnpm -C "$ROOT" exec buf generate || true
else
  pnpm -C "$ROOT" run codegen || true
fi

# Playwright should be installed via server postinstall, but run once more just in case
if pnpm -C "$ROOT/apps/server" exec playwright --version >/dev/null 2>&1; then
  echo "▶︎ Ensuring Playwright browsers are installed…"
  pnpm -C "$ROOT/apps/server" exec playwright install --with-deps || pnpm -C "$ROOT/apps/server" exec playwright install || true
fi

echo "▶︎ Starting backend (apps/server) and frontend (apps/client)…"
echo "    - Frontend: http://localhost:3000"
echo "    - Backend : http://localhost:8080"
echo "    Press Ctrl+C to stop."

# Start both using your root scripts
pnpm -C "$ROOT" run server &
PID_SERVER=$!

pnpm -C "$ROOT" run client &
PID_CLIENT=$!

cleanup() {
  echo
  echo "⏹  Stopping processes…"
  kill "$PID_SERVER" "$PID_CLIENT" 2>/dev/null || true
  wait "$PID_SERVER" "$PID_CLIENT" 2>/dev/null || true
}
trap cleanup INT TERM

# Wait for both (don’t exit early if one stops)
set +e
wait "$PID_SERVER"
WS=$?
wait "$PID_CLIENT"
WC=$?
set -e

exit $(( WS || WC ))
