#!/bin/bash

# ──────────────────────────────────────────────────────────────────────
#  Bhante Sangharakshita Vector Search — Development Server
# ──────────────────────────────────────────────────────────────────────

set -e

# Colors
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
RESET='\033[0m'

DIVIDER="${DIM}──────────────────────────────────────────────────────────${RESET}"

header() {
    echo ""
    echo -e "$DIVIDER"
    echo -e "  ${BOLD}Sangharakshita Search${RESET}  ${DIM}Development Server${RESET}"
    echo -e "$DIVIDER"
    echo ""
}

step() {
    echo -e "  ${CYAN}[$1]${RESET} $2"
}

ok() {
    echo -e "  ${GREEN} ✓${RESET}  $1"
}

warn() {
    echo -e "  ${YELLOW} !${RESET}  $1"
}

fail() {
    echo -e "  ${RED} ✗${RESET}  $1"
    exit 1
}

cleanup() {
    echo ""
    echo -e "  ${DIM}Shutting down...${RESET}"
    kill $API_PID 2>/dev/null
    kill $UI_PID 2>/dev/null
    wait $API_PID 2>/dev/null
    wait $UI_PID 2>/dev/null
    echo -e "  ${GREEN} ✓${RESET}  Stopped."
    echo ""
}

# ── Preflight checks ─────────────────────────────────────────────────

header

step "1/4" "Checking environment"

if [ ! -f .env ]; then
    fail ".env file not found — create one with OPENAI_API_KEY=your_key"
fi
ok ".env found"

if ! poetry run python -c "import fastapi" 2>/dev/null; then
    fail "Python dependencies missing — run: poetry install"
fi
ok "Python dependencies"

if [ ! -d "src/client/node_modules" ]; then
    step "  " "Installing frontend dependencies..."
    (cd src/client && npm install --silent)
fi
ok "Frontend dependencies"

# ── Data status ───────────────────────────────────────────────────────

step "2/4" "Checking data"

if [ -d "./chroma" ]; then
    ok "ChromaDB directory found"
else
    warn "No ./chroma directory — searches will return errors until you ingest data"
fi

SEMINAR_COUNT=0
if [ -d "data/seminars/raw" ]; then
    SEMINAR_COUNT=$(find data/seminars/raw -name '*.json' ! -name '*C.json' 2>/dev/null | wc -l)
fi

if [ "$SEMINAR_COUNT" -gt 0 ]; then
    ok "$SEMINAR_COUNT seminar transcripts downloaded"
else
    warn "No seminar transcripts — run: poetry run python scrape_seminars.py"
fi

# ── Start API server ─────────────────────────────────────────────────

echo ""
step "3/4" "Starting API server"

poetry run python src/server/api.py 2>&1 | tee /tmp/bhante-api.log &
API_PID=$!

# Wait for API to be ready
for i in $(seq 1 30); do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    ok "API running on ${BOLD}http://localhost:8000${RESET}"
    ok "API docs at ${BOLD}http://localhost:8000/docs${RESET}"
else
    echo ""
    echo -e "  ${RED} ✗${RESET}  API failed to start. Log output:"
    echo -e "${DIM}"
    tail -20 /tmp/bhante-api.log 2>/dev/null
    echo -e "${RESET}"
    kill $API_PID 2>/dev/null
    exit 1
fi

# ── Start frontend dev server ────────────────────────────────────────

step "4/4" "Starting frontend"

(cd src/client && npm run dev -- --open 2>&1) &
UI_PID=$!

# Wait for Vite to print its URL
sleep 3

ok "Frontend running  ${DIM}(proxying API requests to :8000)${RESET}"

# ── Ready ─────────────────────────────────────────────────────────────

echo ""
echo -e "$DIVIDER"
echo -e "  ${GREEN}${BOLD}Ready${RESET}"
echo ""
echo -e "  ${BOLD}Frontend${RESET}   http://localhost:5173"
echo -e "  ${BOLD}API${RESET}        http://localhost:8000"
echo -e "  ${BOLD}API docs${RESET}   http://localhost:8000/docs"
echo ""
echo -e "  ${DIM}Press Ctrl+C to stop both servers${RESET}"
echo -e "$DIVIDER"
echo ""

trap cleanup EXIT INT TERM
wait
