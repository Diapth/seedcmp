#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR_FOR_TEST="$(cd "$SCRIPT_DIR/.." && pwd)"

SEEDCMP_SOURCE_ONLY=1 source "$ROOT_DIR_FOR_TEST/scripts/start-im-clowder.sh"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_true() {
  local label="$1"
  shift
  "$@" || fail "$label"
}

assert_false() {
  local label="$1"
  shift
  if "$@"; then
    fail "$label"
  fi
}

assert_false "current worktree cwd is not an old seedcmp tree" \
  path_in_old_seedcmp_tree "$ROOT_DIR/sections/ui"

assert_true "sibling seedcmp worktree cwd is cleanable" \
  path_in_old_seedcmp_tree "$ROOT_PARENT_DIR/seedcmp-old/sections/ui"

assert_true "deleted sibling seedcmp worktree cwd is cleanable" \
  path_in_old_seedcmp_tree "$ROOT_PARENT_DIR/seedcmp-old/sections/ui (deleted)"

assert_false "non-seedcmp project cwd is left alone by default" \
  path_in_old_seedcmp_tree "$ROOT_PARENT_DIR/other-project"

SEEDCMP_CLEAN_ALL_PORTS=1
assert_true "danger mode can clean non-seedcmp cwd" \
  path_in_old_seedcmp_tree "$ROOT_PARENT_DIR/other-project"

declare -f start_all | grep -q 'cleanup_old_seedcmp_ports' || \
  fail "start_all should clean old seedcmp ports before launching services"

printf 'ok - start-im-clowder port cleanup helpers\n'
