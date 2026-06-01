#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/dev-tangseng-clowder.sh"

tmp_dir="$(mktemp -d)"
pids=()
cleanup() {
  for pid in "${pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

spawn_runtime() {
  local owner="$1"
  local api_base="${2:-http://127.0.0.1:3000}"
  (cd "$tmp_dir" && CLOWDER_DEFAULT_OWNER_USER_ID="$owner" CLOWDER_API_BASE_URL="$api_base" exec sleep 30) </dev/null >/dev/null 2>&1 &
  RUNTIME_PID=$!
  pids+=("$RUNTIME_PID")
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    printf 'Expected output to contain %q, got:\n%s\n' "$needle" "$haystack" >&2
    exit 1
  fi
}

spawn_runtime old-owner
old_pid="$RUNTIME_PID"
if TANGSENG_DIR="$tmp_dir" CLOWDER_DEFAULT_OWNER_USER_ID=default-user "$SCRIPT" check-pid "$old_pid" >"$tmp_dir/old.out" 2>&1; then
  printf 'Expected stale owner check to fail.\n' >&2
  exit 1
fi
old_output="$(<"$tmp_dir/old.out")"
assert_contains "$old_output" "CLOWDER_DEFAULT_OWNER_USER_ID mismatch"
assert_contains "$old_output" "old-owner"
assert_contains "$old_output" "default-user"

spawn_runtime default-user http://127.0.0.1:3004
old_api_pid="$RUNTIME_PID"
if TANGSENG_DIR="$tmp_dir" CLOWDER_DEFAULT_OWNER_USER_ID=default-user CLOWDER_API_BASE_URL=http://127.0.0.1:3000 "$SCRIPT" check-pid "$old_api_pid" >"$tmp_dir/old-api.out" 2>&1; then
  printf 'Expected stale Clowder API base check to fail.\n' >&2
  exit 1
fi
old_api_output="$(<"$tmp_dir/old-api.out")"
assert_contains "$old_api_output" "CLOWDER_API_BASE_URL mismatch"
assert_contains "$old_api_output" "http://127.0.0.1:3004"
assert_contains "$old_api_output" "http://127.0.0.1:3000"

if ! "$SCRIPT" env >"$tmp_dir/env.out" 2>&1; then
  printf 'Expected env command to succeed.\n' >&2
  cat "$tmp_dir/env.out" >&2
  exit 1
fi
assert_contains "$(<"$tmp_dir/env.out")" "CLOWDER_API_BASE_URL=http://127.0.0.1:3000"

spawn_runtime default-user http://127.0.0.1:3000
good_pid="$RUNTIME_PID"
TANGSENG_DIR="$tmp_dir" CLOWDER_DEFAULT_OWNER_USER_ID=default-user "$SCRIPT" check-pid "$good_pid" >"$tmp_dir/good.out" 2>&1
assert_contains "$(<"$tmp_dir/good.out")" "runtime ok"
