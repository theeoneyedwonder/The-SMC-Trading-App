#!/usr/bin/env bash
set -euo pipefail

QUANT_CORE_DIR="/home/henry/Documents/QUANT_CORE"
FRONTEND_DIR="$QUANT_CORE_DIR/v2"
PYTHON_BIN="$QUANT_CORE_DIR/.venv-mock/bin/python"
ELECTRON_BIN="/usr/bin/electron42"

if [[ ! -x "$PYTHON_BIN" ]]; then
  notify-send "QUANT_CORE" "Linux Python environment is missing. Recreate .venv-mock first." 2>/dev/null || true
  exit 1
fi

if [[ ! -x "$ELECTRON_BIN" ]]; then
  notify-send "QUANT_CORE" "electron42 is not installed." 2>/dev/null || true
  exit 1
fi

if [[ ! -f "$FRONTEND_DIR/dist/index.html" ]]; then
  cd "$FRONTEND_DIR"
  node node_modules/vite/bin/vite.js build
fi

export PYTHON="$PYTHON_BIN"
export SMC_MOCK=1
export QUANT_CORE_DIST=1

cd "$FRONTEND_DIR"
exec "$ELECTRON_BIN" .
