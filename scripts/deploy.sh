#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# ArkLife — one-command deploy on the Ubuntu VPS (run from the repo root)
#
#   bash scripts/deploy.sh
#
# 1. Refuses to deploy if known malware markers are present
# 2. Installs the OCR system packages if missing (Tesseract ita/eng, Poppler)
# 3. Installs dependencies and builds backend + frontend
# 4. (Re)starts both apps with PM2 — runs node/next DIRECTLY, never through
#    package.json scripts, so a tampered script cannot execute
# 5. Health-checks the backend
#
# Env overrides: API_URL (default https://api.arklifeproject.com),
#                BACK_NAME=back, FRONT_NAME=front, FRONT_PORT=3000
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-https://api.arklifeproject.com}"
BACK_NAME="${BACK_NAME:-back}"
FRONT_NAME="${FRONT_NAME:-front}"
FRONT_PORT="${FRONT_PORT:-3000}"
cd "$ROOT"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# ── 1. Safety check ────────────────────────────────────────────────────
say "Checking for injected code"
BAD=0
for f in backend/init frontend/init; do
  [ -e "$f" ] && { echo "  ✗ suspicious file present: $f"; BAD=1; }
done
if grep -n '"node init' backend/package.json frontend/package.json; then BAD=1; fi
if grep -rlE '_\$_[0-9a-f]{4}|global\[.!.\] *=|fromCharCode\(127\)' \
     --include='*.js' --include='*.mjs' --include='*.ts' --include='*.cjs' \
     backend/src frontend/src frontend/*.mjs frontend/*.ts 2>/dev/null; then
  BAD=1
fi
if [ "$BAD" = 1 ]; then
  echo "  Deployment aborted: remove the injected code first (see above)."
  exit 1
fi
echo "  ✓ clean"

# ── 2. OCR system packages ─────────────────────────────────────────────
say "Checking OCR packages (tesseract-ocr ita/eng, poppler-utils)"
need=()
command -v tesseract >/dev/null || need+=(tesseract-ocr)
command -v pdftoppm  >/dev/null || need+=(poppler-utils)
if command -v tesseract >/dev/null; then
  tesseract --list-langs 2>&1 | grep -qx ita || need+=(tesseract-ocr-ita)
  tesseract --list-langs 2>&1 | grep -qx eng || need+=(tesseract-ocr-eng)
else
  need+=(tesseract-ocr-ita tesseract-ocr-eng)
fi
if [ ${#need[@]} -gt 0 ]; then
  echo "  installing: ${need[*]}"
  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  $SUDO apt-get update -qq
  DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y -qq "${need[@]}"
fi
tesseract --version 2>&1 | head -1
echo "  languages: $(tesseract --list-langs 2>&1 | tail -n +2 | tr '\n' ' ')"
echo "  (if these were missing, the app still OCRs with its built-in engine)"

# ── 3. Build ───────────────────────────────────────────────────────────
say "Backend: install & build"
[ -f backend/.env ] || { echo "  ✗ backend/.env missing (copy backend/.env.example)"; exit 1; }
(cd backend && npm ci --no-audit --no-fund && npx tsc)

say "Frontend: install & build (API: $API_URL)"
(cd frontend && npm ci --no-audit --no-fund && NEXT_PUBLIC_API_URL="$API_URL" npx next build)

# ── 4. (Re)start with PM2 ──────────────────────────────────────────────
say "Restarting PM2 processes"
command -v pm2 >/dev/null || npm install -g pm2
pm2 delete "$BACK_NAME" >/dev/null 2>&1 || true
pm2 delete "$FRONT_NAME" >/dev/null 2>&1 || true
# Absolute paths: PM2 resolves a relative script path against --cwd.
pm2 start "$ROOT/backend/dist/server.js" --name "$BACK_NAME" \
  --cwd "$ROOT/backend" --update-env
pm2 start "$ROOT/frontend/node_modules/next/dist/bin/next" --name "$FRONT_NAME" \
  --cwd "$ROOT/frontend" -- start -p "$FRONT_PORT"
pm2 save

# ── 5. Health check ────────────────────────────────────────────────────
say "Health check"
PORT_BACK="$(grep -E '^PORT=' backend/.env | cut -d= -f2 | tr -d '[:space:]')"
PORT_BACK="${PORT_BACK:-8000}"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${PORT_BACK}/api/health" >/dev/null 2>&1; then
    echo "  ✓ backend healthy on port ${PORT_BACK}"
    pm2 logs "$BACK_NAME" --lines 15 --nostream | grep -E "OCR|Documents|Started" || true
    exit 0
  fi
  sleep 2
done
echo "  ✗ backend did not answer on port ${PORT_BACK}. Check: pm2 logs ${BACK_NAME}"
exit 1
