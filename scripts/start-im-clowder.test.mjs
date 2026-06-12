import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('starts WuKongIM with single-node demo channel overrides', () => {
  const script = `
    set -Eeuo pipefail
    export SEEDCMP_SOURCE_ONLY=1
    export AGENTHUB_UI=0
    export LEGACY_IM_WEB=0
    export CLOWDER_WEB=0
    source scripts/start-im-clowder.sh
    cleanup_old_seedcmp_ports() { :; }
    start_infra() { :; }
    ensure_wukongim() { :; }
    ensure_tangseng() { :; }
    ensure_node_deps() { :; }
    ensure_clowder_pnpm_wrapper() { :; }
    wait_bg_port() { :; }
    stop_pid() { :; }
    stop_project_port() { :; }
    start_bg() {
      if [ "$1" = "wukongim" ]; then
        printf '%s\\n' "$*"
      fi
    }
    start_all
  `;

  const output = execFileSync('bash', ['-c', script], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });

  assert.match(output, /WK_CLUSTER_CHANNEL_BOOTSTRAP_DEFAULT_MIN_ISR=1/);
  assert.match(output, /WK_CLUSTER_CHANNEL_EXECUTION_MODE=dedicated/);
});

test('status reports external Redis when auto mode finds an existing local Redis', () => {
  const script = `
    set -Eeuo pipefail
    export SEEDCMP_SOURCE_ONLY=1
    export REDIS_MODE=auto
    source scripts/start-im-clowder.sh
    pid_alive() { return 1; }
    pid_cwd() { return 1; }
    pid_cmd() { :; }
    container_exists() { return 1; }
    docker_cmd() { return 1; }
    port_open() {
      [ "$1" = "127.0.0.1" ] && [ "$2" = "6379" ]
    }
    status_all
  `;

  const output = execFileSync('bash', ['-c', script], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
  });

  assert.match(output, /redis\s+external/);
  assert.doesNotMatch(output, /seedcmp-redis\s+missing/);
});
