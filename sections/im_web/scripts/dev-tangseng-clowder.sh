#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IM_WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$IM_WEB_DIR/../.." && pwd)"

TANGSENG_DIR="${TANGSENG_DIR:-$REPO_ROOT/sections/im/TangSengDaoDaoServer}"
TANGSENG_CONFIG="${TANGSENG_CONFIG:-configs/tsdd.yaml}"
TANGSENG_TMUX_SESSION="${TANGSENG_TMUX_SESSION:-tangseng-v3-seedcmp}"
TANGSENG_API_PORT="${TANGSENG_API_PORT:-8090}"
TANGSENG_LOG_FILE="${TANGSENG_LOG_FILE:-/tmp/tangsengdaodao-v3-seedcmp.log}"

export IM_WEB_CLOWDER_ENABLED="${IM_WEB_CLOWDER_ENABLED:-true}"
export CLOWDER_API_BASE_URL="${CLOWDER_API_BASE_URL:-http://127.0.0.1:3000}"
export CLOWDER_CONNECTOR_ID="${CLOWDER_CONNECTOR_ID:-im-web}"
export CLOWDER_CONNECTOR_SECRET="${CLOWDER_CONNECTOR_SECRET:-dev-im-web-secret}"
export CLOWDER_DEFAULT_OWNER_USER_ID="${CLOWDER_DEFAULT_OWNER_USER_ID:-default-user}"

usage() {
  cat <<'EOF'
Usage: dev-tangseng-clowder.sh <command>

Commands:
  check        Check the process listening on TANGSENG_API_PORT.
  check-pid    Check a specific process PID. Used by regression tests.
  start        Start TangSeng bridge if the port is free or already correct.
  restart      Stop stale TangSeng bridge runtime and start a fresh one.
  env          Print the expected local V3 bridge environment.

Defaults:
  TANGSENG_API_PORT=8090
  TANGSENG_TMUX_SESSION=tangseng-v3-seedcmp
  CLOWDER_API_BASE_URL=http://127.0.0.1:3000
  CLOWDER_DEFAULT_OWNER_USER_ID=default-user
EOF
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

quote() {
  printf '%q' "$1"
}

expected_tangseng_dir() {
  readlink -f "$TANGSENG_DIR"
}

env_value_for_pid() {
  local pid="$1"
  local key="$2"
  tr '\0' '\n' <"/proc/$pid/environ" 2>/dev/null | sed -n "s/^$key=//p" | head -n 1
}

pid_cwd() {
  local pid="$1"
  readlink -f "/proc/$pid/cwd" 2>/dev/null || true
}

pid_cmd() {
  local pid="$1"
  tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true
}

listener_pid_for_port() {
  ss -ltnp 2>/dev/null | awk -v port=":$TANGSENG_API_PORT" '
    $4 ~ port "$" {
      if (match($0, /pid=[0-9]+/)) {
        print substr($0, RSTART + 4, RLENGTH - 4)
        exit
      }
    }
  '
}

check_pid() {
  local pid="${1:-}"
  [[ -n "$pid" ]] || die "missing pid"
  [[ -d "/proc/$pid" ]] || die "process $pid is not running"

  local expected_dir actual_dir actual_owner actual_api_base
  expected_dir="$(expected_tangseng_dir)"
  actual_dir="$(pid_cwd "$pid")"
  if [[ "$actual_dir" != "$expected_dir" ]]; then
    die "TangSeng runtime cwd mismatch: pid=$pid actual=$actual_dir expected=$expected_dir"
  fi

  actual_owner="$(env_value_for_pid "$pid" CLOWDER_DEFAULT_OWNER_USER_ID)"
  if [[ "$actual_owner" != "$CLOWDER_DEFAULT_OWNER_USER_ID" ]]; then
    die "CLOWDER_DEFAULT_OWNER_USER_ID mismatch: pid=$pid actual=$actual_owner expected=$CLOWDER_DEFAULT_OWNER_USER_ID"
  fi
  actual_api_base="$(env_value_for_pid "$pid" CLOWDER_API_BASE_URL)"
  if [[ "$actual_api_base" != "$CLOWDER_API_BASE_URL" ]]; then
    die "CLOWDER_API_BASE_URL mismatch: pid=$pid actual=$actual_api_base expected=$CLOWDER_API_BASE_URL"
  fi

  printf 'runtime ok: pid=%s cwd=%s owner=%s clowder=%s\n' "$pid" "$actual_dir" "$actual_owner" "$actual_api_base"
}

check_listener() {
  local pid
  pid="$(listener_pid_for_port)"
  [[ -n "$pid" ]] || die "no TangSeng listener found on port $TANGSENG_API_PORT"
  check_pid "$pid"
}

wait_for_port_free() {
  local i
  for i in $(seq 1 30); do
    if [[ -z "$(listener_pid_for_port)" ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

stop_owned_listener() {
  local pid actual_dir command
  pid="$(listener_pid_for_port)"
  [[ -n "$pid" ]] || return 0

  actual_dir="$(pid_cwd "$pid")"
  command="$(pid_cmd "$pid")"
  if [[ "$actual_dir" != "$(expected_tangseng_dir)" && "$command" != *"TangSengDaoDaoServer api"* ]]; then
    die "port $TANGSENG_API_PORT is held by unrelated process pid=$pid cwd=$actual_dir"
  fi

  printf 'Stopping stale TangSeng bridge pid=%s owner=%s\n' "$pid" "$(env_value_for_pid "$pid" CLOWDER_DEFAULT_OWNER_USER_ID)"
  kill "$pid" 2>/dev/null || true
  wait_for_port_free || die "port $TANGSENG_API_PORT is still busy after stopping pid=$pid"
}

start_session() {
  [[ -d "$TANGSENG_DIR" ]] || die "TangSeng directory not found: $TANGSENG_DIR"
  if tmux has-session -t "$TANGSENG_TMUX_SESSION" 2>/dev/null; then
    die "tmux session already exists: $TANGSENG_TMUX_SESSION"
  fi

  local cmd
  cmd="cd $(quote "$TANGSENG_DIR") && "
  cmd+="IM_WEB_CLOWDER_ENABLED=$(quote "$IM_WEB_CLOWDER_ENABLED") "
  cmd+="CLOWDER_API_BASE_URL=$(quote "$CLOWDER_API_BASE_URL") "
  cmd+="CLOWDER_CONNECTOR_ID=$(quote "$CLOWDER_CONNECTOR_ID") "
  cmd+="CLOWDER_CONNECTOR_SECRET=$(quote "$CLOWDER_CONNECTOR_SECRET") "
  cmd+="CLOWDER_DEFAULT_OWNER_USER_ID=$(quote "$CLOWDER_DEFAULT_OWNER_USER_ID") "
  cmd+="go run . api -config $(quote "$TANGSENG_CONFIG") 2>&1 | tee -a $(quote "$TANGSENG_LOG_FILE")"

  tmux new-session -d -s "$TANGSENG_TMUX_SESSION" "$cmd"
}

wait_for_health() {
  local i
  for i in $(seq 1 30); do
    if curl --noproxy '*' -fsS "http://localhost:$TANGSENG_API_PORT/v1/health" >/dev/null 2>&1; then
      check_listener
      return 0
    fi
    sleep 1
  done
  die "TangSeng health check did not pass on port $TANGSENG_API_PORT"
}

print_env() {
  cat <<EOF
TANGSENG_DIR=$TANGSENG_DIR
TANGSENG_CONFIG=$TANGSENG_CONFIG
TANGSENG_TMUX_SESSION=$TANGSENG_TMUX_SESSION
TANGSENG_API_PORT=$TANGSENG_API_PORT
TANGSENG_LOG_FILE=$TANGSENG_LOG_FILE
IM_WEB_CLOWDER_ENABLED=$IM_WEB_CLOWDER_ENABLED
CLOWDER_API_BASE_URL=$CLOWDER_API_BASE_URL
CLOWDER_CONNECTOR_ID=$CLOWDER_CONNECTOR_ID
CLOWDER_CONNECTOR_SECRET=$CLOWDER_CONNECTOR_SECRET
CLOWDER_DEFAULT_OWNER_USER_ID=$CLOWDER_DEFAULT_OWNER_USER_ID
EOF
}

start_runtime() {
  local pid
  pid="$(listener_pid_for_port)"
  if [[ -n "$pid" ]]; then
    check_pid "$pid"
    printf 'TangSeng bridge already running with expected V3 environment.\n'
    return 0
  fi
  start_session
  wait_for_health
}

restart_runtime() {
  if tmux has-session -t "$TANGSENG_TMUX_SESSION" 2>/dev/null; then
    tmux kill-session -t "$TANGSENG_TMUX_SESSION"
  fi
  wait_for_port_free || stop_owned_listener
  start_session
  wait_for_health
}

command="${1:-}"
case "$command" in
  check)
    check_listener
    ;;
  check-pid)
    check_pid "${2:-}"
    ;;
  start)
    start_runtime
    ;;
  restart)
    restart_runtime
    ;;
  env)
    print_env
    ;;
  -h|--help|help|'')
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
