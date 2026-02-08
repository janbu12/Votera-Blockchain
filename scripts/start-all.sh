set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

NETWORK="${NETWORK:-besuLocal}"
SKIP_CONTRACTS="${SKIP_CONTRACTS:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
DEV_MODE="${DEV_MODE:-0}"
SETUP_ONLY="${SETUP_ONLY:-0}"

run_step() {
  local name="$1"
  local path="$2"
  local cmd="$3"
  echo "==> ${name}"
  (cd "$path" && bash -lc "$cmd")
}

start_bg() {
  local name="$1"
  local path="$2"
  local cmd="$3"
  local log_file="$ROOT_DIR/.run-${name}.log"
  echo "==> starting ${name} (log: ${log_file})"
  (
    cd "$path"
    bash -lc "$cmd"
  ) >"$log_file" 2>&1 &
  PIDS+=("$!")
}

cleanup() {
  if [[ "${#PIDS[@]}" -gt 0 ]]; then
    echo "Stopping services..."
    kill "${PIDS[@]}" 2>/dev/null || true
  fi
}

PIDS=()
trap cleanup INT TERM

CONTRACTS_DIR="$ROOT_DIR/contracts"
BACKEND_DIR="$ROOT_DIR/backend"
CAMPUS_DIR="$ROOT_DIR/campus-service"
FACE_DIR="$ROOT_DIR/face-service"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [[ "$SKIP_CONTRACTS" != "1" ]]; then
  run_step "Contracts: npm install" "$CONTRACTS_DIR" "npm install"
  run_step "Contracts: compile" "$CONTRACTS_DIR" "npx hardhat compile"
  run_step "Contracts: deploy multi election (${NETWORK})" "$CONTRACTS_DIR" "npx hardhat run scripts/deploy-multi.ts --network ${NETWORK}"
else
  echo "Skipping contracts setup."
fi

run_step "Backend: npm install" "$BACKEND_DIR" "npm install"
if [[ "$SKIP_BUILD" != "1" ]]; then
  run_step "Backend: build" "$BACKEND_DIR" "npm run build"
else
  echo "Skipping backend build."
fi

run_step "Campus Service: npm install" "$CAMPUS_DIR" "npm install"

if [[ -x "$FACE_DIR/.venv/bin/python" ]]; then
  run_step "Face Service: install requirements (.venv)" "$FACE_DIR" ".venv/bin/python -m pip install -r requirements.txt"
else
  echo "Face Service: .venv not found, skipping pip install. Using system python at runtime."
fi

run_step "Frontend: npm install" "$FRONTEND_DIR" "npm install"
if [[ "$SKIP_BUILD" != "1" ]]; then
  run_step "Frontend: build" "$FRONTEND_DIR" "npm run build"
else
  echo "Skipping frontend build."
fi

if [[ "$SETUP_ONLY" == "1" ]]; then
  echo "Setup completed. No services started because SETUP_ONLY=1."
  exit 0
fi

BACKEND_START="npm run start"
FRONTEND_START="npm run start"
if [[ "$DEV_MODE" == "1" ]]; then
  BACKEND_START="npm run dev"
  FRONTEND_START="npm run dev"
fi

FACE_START="python src/run.py"
if [[ -x "$FACE_DIR/.venv/bin/python" ]]; then
  FACE_START=".venv/bin/python src/run.py"
fi

start_bg "campus-service" "$CAMPUS_DIR" "npm run dev"
start_bg "face-service" "$FACE_DIR" "$FACE_START"
start_bg "backend" "$BACKEND_DIR" "$BACKEND_START"
start_bg "frontend" "$FRONTEND_DIR" "$FRONTEND_START"

echo
echo "All services started in background."
echo "Campus:   http://localhost:4100/health"
echo "Face:     http://localhost:4200/health"
echo "Backend:  http://localhost:4000/health"
echo "Frontend: http://localhost:3000"
echo
echo "Press Ctrl+C to stop."

wait
