#!/usr/bin/env bash
# Run backend + frontend together. Ctrl+C kills both.
#
# Usage:  ./studio/run.sh                 # from repo root, or
#         ./run.sh                        # from studio/
#
# First run bootstraps the backend venv and frontend node_modules.
# Backend logs stream to studio/.run/backend.log; tail it in another terminal.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$HERE/backend"
FRONTEND="$HERE/frontend"
LOGDIR="$HERE/.run"
mkdir -p "$LOGDIR"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# ---------- backend ----------
if [[ ! -d "$BACKEND/.venv" ]]; then
  echo "[run] creating backend venv"
  python3 -m venv "$BACKEND/.venv"
  "$BACKEND/.venv/bin/pip" install --quiet --upgrade pip
fi
# Install (or sync) deps every run. pip no-ops already-satisfied requirements,
# so this is cheap and keeps the venv in sync if the dep list grows.
"$BACKEND/.venv/bin/pip" install --quiet \
  fastapi 'uvicorn[standard]' pydantic python-dotenv requests httpx websockets sse-starlette

# ---------- frontend ----------
if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "[run] installing frontend deps (pnpm install)"
  (cd "$FRONTEND" && pnpm install)
fi

# ---------- launch ----------
BACKEND_LOG="$LOGDIR/backend.log"
: > "$BACKEND_LOG"

echo "[run] backend  → http://localhost:$BACKEND_PORT   (log: $BACKEND_LOG)"
(
  cd "$BACKEND"
  exec "$BACKEND/.venv/bin/uvicorn" app.main:app \
    --port "$BACKEND_PORT" --reload >>"$BACKEND_LOG" 2>&1
) &
BACKEND_PID=$!

cleanup() {
  echo
  echo "[run] stopping (backend pid $BACKEND_PID)"
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Give the backend a moment so its startup logs land before Next's banner.
sleep 1

echo "[run] frontend → http://localhost:$FRONTEND_PORT"
(cd "$FRONTEND" && pnpm dev --port "$FRONTEND_PORT")
