#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://127.0.0.1:8090/v1/}"
export VITE_MEDIA_BASE_URL="${VITE_MEDIA_BASE_URL:-${VITE_API_BASE_URL%/v1/}}"
export VITE_OBJECT_STORAGE_BASE_URL="${VITE_OBJECT_STORAGE_BASE_URL:-http://127.0.0.1:9000}"
export VITE_TANGSENG_WS_HOST="${VITE_TANGSENG_WS_HOST:-127.0.0.1}"

cd "$ROOT_DIR"
exec pnpm --filter chat dev

