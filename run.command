#!/bin/bash
# MoneyMood.ai launcher — double-click this file in Finder (or run ./start.command)
# Starts the FastAPI backend on :6150, the Vite frontend on :6100, opens the browser.
# Press Ctrl-C in this window (or just close it) to stop both servers.

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR" || exit 1

BACKEND_PORT=6150
FRONTEND_PORT=6100
LOG_DIR="$PROJECT_DIR/logs"
PY="$PROJECT_DIR/.venv/bin/python"

mkdir -p "$LOG_DIR"

# Homebrew node/npm are not on the PATH of a Finder-launched shell.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
info() { printf "  \033[36m•\033[0m %s\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
die()  { printf "  \033[31m✗\033[0m %s\n" "$1"; printf "\nPress return to close this window."; read -r _; exit 1; }

printf "\n"
bold "MoneyMood.ai"
printf "%s\n\n" "$PROJECT_DIR"

# ---- preflight -------------------------------------------------------------
[ -x "$PY" ] || die "No virtualenv at .venv — create it, then: .venv/bin/python -m pip install -r requirements.txt"
command -v npm >/dev/null 2>&1 || die "npm not found. Install Node.js (brew install node)."

# A port held by an older copy of this project is the classic 'data not loading'
# trap, so reclaim our own leftovers but never touch an unrelated process.
reclaim_port() {
    local port=$1 label=$2 pid cwd
    pid="$(lsof -ti :"$port" -sTCP:LISTEN 2>/dev/null | head -1)"
    [ -z "$pid" ] && return 0

    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)"
    if [ "$cwd" = "$PROJECT_DIR" ] || [ "$cwd" = "$PROJECT_DIR/frontend" ]; then
        info "Stopping previous $label (pid $pid)"
        kill "$pid" 2>/dev/null
        for _ in $(seq 1 20); do
            kill -0 "$pid" 2>/dev/null || return 0
            sleep 0.25
        done
        kill -9 "$pid" 2>/dev/null
        return 0
    fi

    die "Port $port is held by pid $pid from a different folder:
      $cwd
    That is another project squatting the port. Quit it, then run this again."
}

reclaim_port "$BACKEND_PORT"  "backend"
reclaim_port "$FRONTEND_PORT" "frontend"

if [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
    info "Installing frontend dependencies (first run, this takes a minute)…"
    npm install --prefix frontend >"$LOG_DIR/npm-install.log" 2>&1 \
        || die "npm install failed — see logs/npm-install.log"
fi

# ---- start -----------------------------------------------------------------
BACKEND_PID=""
FRONTEND_PID=""

SHUTTING_DOWN=0

shutdown() {
    # Runs on Ctrl-C, on window close (HUP), and on any exit path. Guarded so
    # the EXIT trap can't re-enter it after INT/TERM already cleaned up.
    [ "$SHUTTING_DOWN" -eq 1 ] && return
    SHUTTING_DOWN=1

    if [ -n "$FRONTEND_PID" ] || [ -n "$BACKEND_PID" ]; then
        printf "\n"
        info "Shutting down…"
        # npm forwards SIGTERM to the vite grandchild, but sweep its children
        # too so a stuck npm can't leave :6100 held by an orphan.
        [ -n "$FRONTEND_PID" ] && { pkill -P "$FRONTEND_PID" 2>/dev/null; kill "$FRONTEND_PID" 2>/dev/null; }
        [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null
        wait 2>/dev/null
        ok "Stopped."
    fi
}
trap 'shutdown; exit 0' INT TERM HUP
trap shutdown EXIT

info "Starting backend on :$BACKEND_PORT"
"$PY" -m uvicorn api:app --host 0.0.0.0 --port "$BACKEND_PORT" \
    >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# The market cache loads ~2,000 symbols from disk at startup, so give it room.
for i in $(seq 1 90); do
    kill -0 "$BACKEND_PID" 2>/dev/null || die "Backend exited on startup — see logs/backend.log"
    curl -sf -m 2 "http://localhost:$BACKEND_PORT/" >/dev/null 2>&1 && break
    sleep 1
    [ "$i" -eq 90 ] && die "Backend never became healthy — see logs/backend.log"
done
ok "Backend  → http://localhost:$BACKEND_PORT  (docs at /docs)"

info "Starting frontend on :$FRONTEND_PORT"
npm run dev --prefix frontend >"$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

for i in $(seq 1 60); do
    kill -0 "$FRONTEND_PID" 2>/dev/null || die "Frontend exited on startup — see logs/frontend.log"
    curl -sf -m 2 "http://localhost:$FRONTEND_PORT/" >/dev/null 2>&1 && break
    sleep 1
    [ "$i" -eq 60 ] && die "Frontend never came up — see logs/frontend.log"
done
ok "Frontend → http://localhost:$FRONTEND_PORT"

open "http://localhost:$FRONTEND_PORT"

printf "\n"
bold "Running. Leave this window open."
printf "  Logs: logs/backend.log, logs/frontend.log\n"
printf "  Press \033[1mCtrl-C\033[0m to stop both servers.\n\n"

# Exit as soon as either server dies, so a crash doesn't leave a half-up app.
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
    sleep 2
done

printf "\n"
kill -0 "$BACKEND_PID"  2>/dev/null || info "Backend stopped — see logs/backend.log"
kill -0 "$FRONTEND_PID" 2>/dev/null || info "Frontend stopped — see logs/frontend.log"
shutdown
