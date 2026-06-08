#!/usr/bin/env bash
set -Eeuo pipefail

# AgentHub UI H5 前端（seedcmp/sections/ui）是默认前端。
#
#   seedcmp/scripts/start-im-clowder.sh start
#
# 启动后访问：
#   http://localhost:5173/#/pages/login/index
# 已登录可直接进：
#   http://localhost:5173/#/pages/chat/index
# 如果 5173 被占用，uni/vite 会自动换端口，查看日志输出里的实际 URL。
# 旧版 sections/im_web 前端默认不启动；需要时设置 LEGACY_IM_WEB=1。

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.seedcmp-run"
LOG_DIR="$RUN_DIR/logs"
PID_DIR="$RUN_DIR/pids"

CLOWDER_DIR="$ROOT_DIR/sections/clowder-ai"
WK_DIR="$ROOT_DIR/sections/im/WuKongIM"
TSDD_DIR="$ROOT_DIR/sections/im/TangSengDaoDaoServer"
LEGACY_IM_WEB_DIR="$ROOT_DIR/sections/im_web"
AGENTHUB_UI_DIR="$ROOT_DIR/sections/ui"
UI_VERSION_LABEL="${UI_VERSION_LABEL:-AgentHub UI H5 (seedcmp/sections/ui)}"

CLOWDER_URL="${CLOWDER_URL:-${CAT_CAFE_API_URL:-http://127.0.0.1:3004}}"
CLOWDER_WEB_URL="${CLOWDER_WEB_URL:-http://127.0.0.1:3003}"
CLOWDER_API_PORT="${CLOWDER_API_PORT:-3004}"
CLOWDER_WEB_PORT="${CLOWDER_WEB_PORT:-3003}"
# Start the clowder-ai web (PWA, port 3003) alongside the API? Default: off.
# Single-web entry goal: most users only need AgentHub UI (5173). Flip on with
# CLOWDER_WEB=1 when you want the Clowder MissionControl / FeatureBoard UI.
CLOWDER_WEB="${CLOWDER_WEB:-0}"
# Start the AgentHub UI H5 frontend (seedcmp/sections/ui, port 5173).
AGENTHUB_UI="${AGENTHUB_UI:-1}"
# Start the old TangSengDaoDao Vue IM Web frontend (seedcmp/sections/im_web,
# port 3000). Default: off because AgentHub UI is the primary frontend.
LEGACY_IM_WEB="${LEGACY_IM_WEB:-0}"
CLOWDER_CONNECTOR_SECRET="${CLOWDER_CONNECTOR_SECRET:-dev-shared-secret}"
CLOWDER_CONNECTOR_ID="${CLOWDER_CONNECTOR_ID:-im-web}"
CLOWDER_DEFAULT_OWNER_USER_ID="${CLOWDER_DEFAULT_OWNER_USER_ID:-user-1}"
CLOWDER_OUTBOUND_CALLBACK_URL="${CLOWDER_OUTBOUND_CALLBACK_URL:-http://127.0.0.1:8090/api/im-web/clowder/outbound}"
CLOWDER_PNPM_VERSION="${CLOWDER_PNPM_VERSION:-9.15.4}"
CLOWDER_PNPM_BIN_DIR="$RUN_DIR/bin"
CLOWDER_PNPM_CMD="${CLOWDER_PNPM_CMD:-pnpm}"
TANGSENG_WAIT_TIMEOUT="${TANGSENG_WAIT_TIMEOUT:-180}"
IM_WEB_CHOKIDAR_USEPOLLING="${IM_WEB_CHOKIDAR_USEPOLLING:-true}"
IM_WEB_CHOKIDAR_INTERVAL="${IM_WEB_CHOKIDAR_INTERVAL:-250}"

MYSQL_CONTAINER="${MYSQL_CONTAINER:-seedcmp-mysql}"
REDIS_CONTAINER="${REDIS_CONTAINER:-seedcmp-redis}"
MINIO_CONTAINER="${MINIO_CONTAINER:-seedcmp-minio}"

REDIS_MODE="${REDIS_MODE:-auto}"
INFRA_IMAGE_PREFIX="${INFRA_IMAGE_PREFIX:-}"
if [ -n "$INFRA_IMAGE_PREFIX" ]; then
  MYSQL_IMAGE="${MYSQL_IMAGE:-${INFRA_IMAGE_PREFIX}mysql:8.0.33}"
  REDIS_IMAGE="${REDIS_IMAGE:-${INFRA_IMAGE_PREFIX}redis:7}"
  MINIO_IMAGE="${MINIO_IMAGE:-${INFRA_IMAGE_PREFIX}minio/minio:latest}"
else
  MYSQL_IMAGE="${MYSQL_IMAGE:-m.daocloud.io/docker.io/library/mysql:8.0.33}"
  REDIS_IMAGE="${REDIS_IMAGE:-m.daocloud.io/docker.io/library/redis:7}"
  MINIO_IMAGE="${MINIO_IMAGE:-m.daocloud.io/quay.io/minio/minio:latest}"
fi

MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-demo}"
MYSQL_DATABASE="${MYSQL_DATABASE:-im}"
MYSQL_USER="${MYSQL_USER:-tsdd_user}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-tsdd_password}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minio}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minio123}"

mkdir -p "$LOG_DIR" "$PID_DIR"

usage() {
  cat <<'EOF'
Usage:
  scripts/start-im-clowder.sh [start|stop|restart|status|logs]

Starts the integrated seedcmp demo:
  Docker: MySQL, Redis, MinIO
  Local:  WuKongIM, Clowder, TangSengDaoDaoServer, AgentHub UI

By default only the Clowder API (3004) is started — the clowder-ai web
on 3003 is a developer / admin surface and is opt-in via CLOWDER_WEB=1.
The day-to-day frontend is AgentHub UI from sections/ui on port 5173.

Notes:
  start reuses existing local processes. Use restart after code changes.

Environment overrides:
  CLOWDER_URL=http://127.0.0.1:3004       (API origin; frontends talk to this)
  CLOWDER_WEB_URL=http://127.0.0.1:3003   (clowder-ai web origin; admin)
  CLOWDER_WEB=0|1                         (default 0; set 1 to launch web)
  AGENTHUB_UI=0|1                         (default 1; set 0 to skip AgentHub UI H5 on 5173)
  LEGACY_IM_WEB=0|1                       (default 0; set 1 to launch old IM Web on 3000)
  CLOWDER_CONNECTOR_SECRET=dev-shared-secret
  CLOWDER_DEFAULT_OWNER_USER_ID=user-1
  CLOWDER_PNPM_VERSION=9.15.4
  CLOWDER_PNPM_CMD=pnpm
  TANGSENG_WAIT_TIMEOUT=180
  IM_WEB_CHOKIDAR_USEPOLLING=true             (avoid inotify watcher ENOSPC)
  IM_WEB_CHOKIDAR_INTERVAL=250
  REDIS_MODE=auto|docker|external
  INFRA_IMAGE_PREFIX=docker.example.com/
EOF
}

log() {
  printf '[seedcmp] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[seedcmp] missing command: %s\n' "$1" >&2
    return 1
  fi
}

docker_cmd() {
  if docker ps >/dev/null 2>&1; then
    docker "$@"
  else
    sudo docker "$@"
  fi
}

container_exists() {
  docker_cmd inspect "$1" >/dev/null 2>&1
}

container_running() {
  [ "$(docker_cmd inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" = "true" ]
}

port_open() {
  local host="$1"
  local port="$2"
  (echo >"/dev/tcp/$host/$port") >/dev/null 2>&1
}

ensure_container_started() {
  local name="$1"
  shift
  if container_exists "$name"; then
    if container_running "$name"; then
      log "container running: $name"
    else
      log "starting existing container: $name"
      docker_cmd start "$name" >/dev/null
    fi
    return
  fi
  log "creating container: $name"
  docker_cmd run -d --name "$name" "$@" >/dev/null
}

ensure_clowder_pnpm_wrapper() {
  mkdir -p "$CLOWDER_PNPM_BIN_DIR"
  local wrapper="$CLOWDER_PNPM_BIN_DIR/pnpm"
  cat >"$wrapper" <<EOF
#!/usr/bin/env bash
exec corepack pnpm@$CLOWDER_PNPM_VERSION "\$@"
EOF
  chmod +x "$wrapper"
}

wait_for_mysql() {
  log "waiting for MySQL..."
  for _ in $(seq 1 90); do
    if docker_cmd exec "$MYSQL_CONTAINER" mysqladmin ping -h 127.0.0.1 -uroot "-p$MYSQL_ROOT_PASSWORD" --silent >/dev/null 2>&1; then
      docker_cmd exec "$MYSQL_CONTAINER" mysql -uroot "-p$MYSQL_ROOT_PASSWORD" -e \
        "CREATE DATABASE IF NOT EXISTS \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
         CREATE USER IF NOT EXISTS '$MYSQL_USER'@'%' IDENTIFIED BY '$MYSQL_PASSWORD';
         GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO '$MYSQL_USER'@'%';
         FLUSH PRIVILEGES;" >/dev/null
      return
    fi
    sleep 1
  done
  printf '[seedcmp] MySQL did not become ready. See: sudo docker logs %s\n' "$MYSQL_CONTAINER" >&2
  exit 1
}

wait_for_redis() {
  log "waiting for Redis..."
  if [ "$REDIS_MODE" = "external" ]; then
    wait_port 127.0.0.1 6379 "Redis"
    return
  fi
  for _ in $(seq 1 60); do
    if docker_cmd exec "$REDIS_CONTAINER" redis-cli ping >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  printf '[seedcmp] Redis did not become ready. See: sudo docker logs %s\n' "$REDIS_CONTAINER" >&2
  exit 1
}

wait_port() {
  local host="$1"
  local port="$2"
  local label="$3"
  local max="${4:-90}"
  log "waiting for $label on $host:$port..."
  for _ in $(seq 1 "$max"); do
    if port_open "$host" "$port"; then
      return
    fi
    sleep 1
  done
  printf '[seedcmp] %s did not open %s:%s\n' "$label" "$host" "$port" >&2
  exit 1
}

wait_bg_port() {
  local process_name="$1"
  local host="$2"
  local port="$3"
  local label="$4"
  local max="${5:-90}"
  local pid_file="$PID_DIR/$process_name.pid"
  local log_file="$LOG_DIR/$process_name.log"
  local pid=""

  [ -f "$pid_file" ] && pid="$(cat "$pid_file" 2>/dev/null || true)"
  log "waiting for $label on $host:$port..."
  for _ in $(seq 1 "$max"); do
    if port_open "$host" "$port"; then
      return
    fi
    if [ -n "$pid" ] && ! kill -0 "$pid" >/dev/null 2>&1; then
      printf '[seedcmp] %s exited before opening %s:%s. See: %s\n' "$label" "$host" "$port" "$log_file" >&2
      exit 1
    fi
    sleep 1
  done
  printf '[seedcmp] %s did not open %s:%s. See: %s\n' "$label" "$host" "$port" "$log_file" >&2
  exit 1
}

# Like wait_bg_port, but tolerates the port staying closed when the process is
# still alive. Useful for Vite/Uni dev servers that auto-pick another port when
# the default is occupied.
wait_bg_port_flexible() {
  local process_name="$1"
  local host="$2"
  local port="$3"
  local label="$4"
  local max="${5:-30}"
  local pid_file="$PID_DIR/$process_name.pid"
  local log_file="$LOG_DIR/$process_name.log"
  local pid=""

  [ -f "$pid_file" ] && pid="$(cat "$pid_file" 2>/dev/null || true)"
  log "waiting for $label on $host:$port (vite may auto-select another port)..."
  for _ in $(seq 1 "$max"); do
    if port_open "$host" "$port"; then
      return
    fi
    if [ -n "$pid" ] && ! kill -0 "$pid" >/dev/null 2>&1; then
      printf '[seedcmp] %s exited before opening %s:%s. See: %s\n' "$label" "$host" "$port" "$log_file" >&2
      exit 1
    fi
    sleep 1
  done

  if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
    log "$label did not open $host:$port but process is alive; see $log_file for the actual URL"
    return
  fi
  printf '[seedcmp] %s did not open %s:%s. See: %s\n' "$label" "$host" "$port" "$log_file" >&2
  exit 1
}

pid_alive() {
  local pid_file="$1"
  [ -f "$pid_file" ] || return 1
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1
}

port_pids() {
  local port="$1"
  local found=0
  if command -v lsof >/dev/null 2>&1; then
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      printf '%s\n' "$pid"
      found=1
    done < <(lsof -nP -i ":$port" -sTCP:LISTEN -t 2>/dev/null || true)
    [ "$found" -eq 1 ] && return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :$port )" 2>/dev/null | awk '
      {
        while (match($0, /pid=[0-9]+/)) {
          print substr($0, RSTART + 4, RLENGTH - 4)
          $0 = substr($0, RSTART + RLENGTH)
        }
      }
    ' | sort -u || true
    return
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser -n tcp "$port" 2>&1 | sed 's#^[^:]*:##' | grep -oE '[0-9]+' | sort -u || true
  fi
}

pid_cwd() {
  local pid="$1"
  [ -L "/proc/$pid/cwd" ] || return 1
  readlink "/proc/$pid/cwd" 2>/dev/null
}

path_in_root() {
  local path="$1"
  case "$path" in
    "$ROOT_DIR"|"$ROOT_DIR"/*) return 0 ;;
    *) return 1 ;;
  esac
}

stop_project_port() {
  local port="$1"
  local label="$2"
  local pid cwd

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    cwd="$(pid_cwd "$pid" || true)"
    if [ -n "$cwd" ] && path_in_root "$cwd"; then
      log "stopping stale $label listener on port $port (PID $pid)"
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done < <(port_pids "$port")

  sleep 0.5

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    cwd="$(pid_cwd "$pid" || true)"
    if [ -n "$cwd" ] && path_in_root "$cwd"; then
      log "force stopping stale $label listener on port $port (PID $pid)"
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  done < <(port_pids "$port")
}

start_bg() {
  local name="$1"
  local workdir="$2"
  shift 2
  local pid_file="$PID_DIR/$name.pid"
  local log_file="$LOG_DIR/$name.log"
  if pid_alive "$pid_file"; then
    log "$name already running (PID $(cat "$pid_file"))"
    return
  fi
  log "starting $name (log: $log_file)"
  (
    cd "$workdir"
    if command -v setsid >/dev/null 2>&1; then
      nohup setsid "$@" >"$log_file" 2>&1 &
    else
      nohup "$@" >"$log_file" 2>&1 &
    fi
    echo $! >"$pid_file"
  )
}

stop_pid() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"
  if ! pid_alive "$pid_file"; then
    log "$name not running"
    rm -f "$pid_file"
    return
  fi
  local pid
  pid="$(cat "$pid_file")"
  log "stopping $name (PID $pid)"
  kill "$pid" >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      rm -f "$pid_file"
      return
    fi
    sleep 0.5
  done
  kill -9 "$pid" >/dev/null 2>&1 || true
  rm -f "$pid_file"
}

binary_stale() {
  local binary="$1"
  local source_dir="$2"
  [ -x "$binary" ] || return 0
  [ -n "$(find "$source_dir" -name '*.go' -newer "$binary" -print -quit 2>/dev/null)" ]
}

ensure_wukongim() {
  require_cmd go
  if binary_stale "$WK_DIR/wukongim" "$WK_DIR"; then
    log "building WuKongIM..."
    (cd "$WK_DIR" && go mod download && go build -o wukongim ./cmd/wukongim/)
  fi
  if [ ! -f "$WK_DIR/wukongim.conf" ]; then
    log "creating WuKongIM config from example"
    cp "$WK_DIR/wukongim.conf.example" "$WK_DIR/wukongim.conf"
    sed -i 's/^WK_CHANNEL_BOOTSTRAP_DEFAULT_MIN_ISR=.*/WK_CHANNEL_BOOTSTRAP_DEFAULT_MIN_ISR=1/' "$WK_DIR/wukongim.conf"
  fi
}

ensure_tangseng() {
  require_cmd go
  if binary_stale "$TSDD_DIR/tsdd_server" "$TSDD_DIR"; then
    log "building TangSengDaoDaoServer..."
    (cd "$TSDD_DIR" && go mod download && go build -o tsdd_server .)
  fi
}

ensure_node_deps() {
  require_cmd corepack
  if [ "$AGENTHUB_UI" = "1" ] && [ ! -d "$AGENTHUB_UI_DIR/node_modules" ]; then
    log "installing AgentHub UI dependencies..."
    # CI=1 disables pnpm's interactive "reinstall modules?" prompt.
    (cd "$AGENTHUB_UI_DIR" && CI=1 corepack pnpm install)
  fi
  if [ "$LEGACY_IM_WEB" = "1" ] && [ ! -d "$LEGACY_IM_WEB_DIR/node_modules" ]; then
    log "installing legacy IM Web dependencies..."
    (cd "$LEGACY_IM_WEB_DIR" && corepack pnpm install)
  fi
  if [ ! -d "$CLOWDER_DIR/node_modules" ]; then
    log "installing Clowder dependencies..."
    ensure_clowder_pnpm_wrapper
    (
      cd "$CLOWDER_DIR"
      ONNXRUNTIME_NODE_INSTALL_CUDA=skip \
        PATH="$CLOWDER_PNPM_BIN_DIR:$PATH" \
        PNPM_HOME="$CLOWDER_DIR/.pnpm-home" \
        npm_config_store_dir="$CLOWDER_DIR/.pnpm-store" \
        $CLOWDER_PNPM_CMD install
    )
  fi
}

start_infra() {
  require_cmd docker
  ensure_container_started "$MYSQL_CONTAINER" \
    -p 3306:3306 \
    -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
    -e MYSQL_DATABASE="$MYSQL_DATABASE" \
    -e MYSQL_USER="$MYSQL_USER" \
    -e MYSQL_PASSWORD="$MYSQL_PASSWORD" \
    "$MYSQL_IMAGE" \
    --default-authentication-plugin=mysql_native_password
  case "$REDIS_MODE" in
    auto)
      if port_open 127.0.0.1 6379; then
        REDIS_MODE=external
        log "detected existing Redis on 127.0.0.1:6379"
      else
        REDIS_MODE=docker
        ensure_container_started "$REDIS_CONTAINER" -p 6379:6379 "$REDIS_IMAGE"
      fi
      ;;
    external)
      log "using external Redis on 127.0.0.1:6379"
      ;;
    docker)
      ensure_container_started "$REDIS_CONTAINER" -p 6379:6379 "$REDIS_IMAGE"
      ;;
    *)
      printf '[seedcmp] invalid REDIS_MODE: %s (expected auto, docker, or external)\n' "$REDIS_MODE" >&2
      exit 2
      ;;
  esac
  ensure_container_started "$MINIO_CONTAINER" \
    -p 9000:9000 \
    -p 9001:9001 \
    -e MINIO_ROOT_USER="$MINIO_ROOT_USER" \
    -e MINIO_ROOT_PASSWORD="$MINIO_ROOT_PASSWORD" \
    "$MINIO_IMAGE" server /data --console-address ':9001'
  wait_for_mysql
  wait_for_redis
}

start_all() {
  start_infra
  ensure_wukongim
  ensure_tangseng
  ensure_node_deps

  start_bg wukongim "$WK_DIR" ./wukongim -config ./wukongim.conf
  wait_bg_port wukongim 127.0.0.1 5001 "WuKongIM API"

  ensure_clowder_pnpm_wrapper

  # Single-web-entry default: start only the Clowder API (port 3004) so the
  # user can run with just AgentHub UI (5173). When CLOWDER_WEB=1, fall back to
  # the integrated start:direct launcher which boots both API and the
  # clowder-ai web (port 3003) in one go.
  if [ "$CLOWDER_WEB" = "1" ]; then
    log "starting Clowder (API + web, port 3004 + 3003)..."
    start_bg clowder-web "$CLOWDER_DIR" env \
      IM_WEB_CLOWDER_ENABLED=true \
      CLOWDER_CONNECTOR_ID="$CLOWDER_CONNECTOR_ID" \
      CLOWDER_CONNECTOR_SECRET="$CLOWDER_CONNECTOR_SECRET" \
      CLOWDER_OUTBOUND_CALLBACK_URL="$CLOWDER_OUTBOUND_CALLBACK_URL" \
      CAT_CAFE_API_URL="$CLOWDER_URL" \
      NEXT_PUBLIC_API_URL="$CLOWDER_URL" \
      DEFAULT_OWNER_USER_ID="$CLOWDER_DEFAULT_OWNER_USER_ID" \
      REDIS_PORT=6379 \
      REDIS_URL=redis://127.0.0.1:6379 \
      REDIS_KEY_PREFIX=seedcmp:cat-cafe: \
      ONNXRUNTIME_NODE_INSTALL_CUDA=skip \
      PATH="$CLOWDER_PNPM_BIN_DIR:$PATH" \
      PNPM_HOME="$CLOWDER_DIR/.pnpm-home" \
      npm_config_store_dir="$CLOWDER_DIR/.pnpm-store" \
      $CLOWDER_PNPM_CMD start:direct --quick
    wait_bg_port clowder-web 127.0.0.1 3004 "Clowder API"
    wait_bg_port clowder-web 127.0.0.1 3003 "Clowder Web"
  else
    log "starting Clowder API only (port 3004, no web at 3003)..."
    # Clowder API is a node process — cd into packages/api and run the
    # prebuilt dist bundle (or the tsx-watched dev entry if dist is stale).
    # We use the start script so production-mode scripts (port probing,
    # signal handling) work the same as the integrated launcher.
    start_bg clowder-api "$CLOWDER_DIR/packages/api" env \
      IM_WEB_CLOWDER_ENABLED=true \
      CLOWDER_CONNECTOR_ID="$CLOWDER_CONNECTOR_ID" \
      CLOWDER_CONNECTOR_SECRET="$CLOWDER_CONNECTOR_SECRET" \
      CLOWDER_OUTBOUND_CALLBACK_URL="$CLOWDER_OUTBOUND_CALLBACK_URL" \
      CAT_CAFE_API_URL="$CLOWDER_URL" \
      NEXT_PUBLIC_API_URL="$CLOWDER_URL" \
      DEFAULT_OWNER_USER_ID="$CLOWDER_DEFAULT_OWNER_USER_ID" \
      REDIS_PORT=6379 \
      REDIS_URL=redis://127.0.0.1:6379 \
      REDIS_KEY_PREFIX=seedcmp:cat-cafe: \
      ONNXRUNTIME_NODE_INSTALL_CUDA=skip \
      PATH="$CLOWDER_PNPM_BIN_DIR:$PATH" \
      PNPM_HOME="$CLOWDER_DIR/.pnpm-home" \
      npm_config_store_dir="$CLOWDER_DIR/.pnpm-store" \
      NODE_ENV=production \
      $CLOWDER_PNPM_CMD start
    wait_bg_port clowder-api 127.0.0.1 3004 "Clowder API"
  fi

  start_bg tangseng "$TSDD_DIR" env \
    IM_WEB_CLOWDER_ENABLED=true \
    CLOWDER_API_BASE_URL="$CLOWDER_URL" \
    CLOWDER_CONNECTOR_ID="$CLOWDER_CONNECTOR_ID" \
    CLOWDER_CONNECTOR_SECRET="$CLOWDER_CONNECTOR_SECRET" \
    CLOWDER_DEFAULT_OWNER_USER_ID="$CLOWDER_DEFAULT_OWNER_USER_ID" \
    ./tsdd_server -config ./configs/tsdd.yaml
  wait_bg_port tangseng 127.0.0.1 8090 "TangSeng API" "$TANGSENG_WAIT_TIMEOUT"

  if [ "$LEGACY_IM_WEB" != "1" ]; then
    stop_pid im-web
    stop_project_port 3000 "Legacy IM Web"
  fi

  if [ "$LEGACY_IM_WEB" = "1" ]; then
    # Legacy im_web uses CLOWDER_URL (the API) — never the web — for V3.0 chat flows.
    start_bg im-web "$LEGACY_IM_WEB_DIR" env \
      CHOKIDAR_USEPOLLING="$IM_WEB_CHOKIDAR_USEPOLLING" \
      CHOKIDAR_INTERVAL="$IM_WEB_CHOKIDAR_INTERVAL" \
      VITE_API_BASE_URL=http://127.0.0.1:8090/v1/ \
      VITE_TANGSENG_PROXY_TARGET=http://127.0.0.1:8090 \
      VITE_CLOWDER_PUBLIC_URL="$CLOWDER_URL" \
      corepack pnpm --filter chat dev --host 0.0.0.0
    wait_bg_port im-web 127.0.0.1 3000 "Legacy IM Web"
  fi

  if [ "$AGENTHUB_UI" = "1" ]; then
    # --host makes the Vite dev server bind to 0.0.0.0 so the H5 frontend is
    # reachable from the LAN. Vite defaults to port 5173 and auto-increments
    # if it is occupied; the flexible wait tolerates that.
    start_bg agenthub-ui "$AGENTHUB_UI_DIR" env \
      PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false \
      corepack pnpm dev:h5 --host
    wait_bg_port_flexible agenthub-ui 127.0.0.1 5173 "AgentHub UI"
  fi

  log "ready:"
  if [ "$AGENTHUB_UI" = "1" ]; then
    log "  AgentHub UI: http://localhost:5173 (vite may have auto-selected another port; see $LOG_DIR/agenthub-ui.log)"
  fi
  if [ "$LEGACY_IM_WEB" = "1" ]; then
    log "  Legacy IM Web: http://localhost:3000"
  fi
  log "  Clowder API: http://localhost:3004"
  if [ "$CLOWDER_WEB" = "1" ]; then
    log "  Clowder Web: $CLOWDER_WEB_URL (admin / MissionControl)"
  fi
  log "  Logs:    $LOG_DIR"
}

stop_all() {
  stop_pid agenthub-ui
  stop_pid im-web
  stop_pid tangseng
  # Either the unified `clowder-web` name (when CLOWDER_WEB=1) or the
  # API-only `clowder-api` name (default). Stop both — stop_pid no-ops
  # when the pid file is missing.
  stop_pid clowder-web
  stop_pid clowder-api
  stop_pid clowder
  stop_pid wukongim
  stop_project_port 5173 "AgentHub UI"
  stop_project_port 3000 "Legacy IM Web"
  stop_project_port 8090 "TangSeng API"
  stop_project_port 6979 "TangSeng gRPC"
  stop_project_port 3003 "Clowder Web"
  stop_project_port 3004 "Clowder API"
  stop_project_port 4100 "Clowder Preview"
  stop_project_port 5001 "WuKongIM API"
  stop_project_port 5100 "WuKongIM TCP"
  stop_project_port 5200 "WuKongIM WebSocket"
  stop_project_port 5301 "WuKongIM Manager"
  stop_project_port 7000 "WuKongIM Monitor"
  if command -v docker >/dev/null 2>&1; then
    local containers=("$MINIO_CONTAINER" "$MYSQL_CONTAINER")
    if [ "$REDIS_MODE" != "external" ]; then
      containers=("$MINIO_CONTAINER" "$REDIS_CONTAINER" "$MYSQL_CONTAINER")
    fi
    for c in "${containers[@]}"; do
      if container_exists "$c" && container_running "$c"; then
        log "stopping container: $c"
        docker_cmd stop "$c" >/dev/null || true
      fi
    done
  fi
}

status_one() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"
  if pid_alive "$pid_file"; then
    printf '  %-10s running  PID %s\n' "$name" "$(cat "$pid_file")"
  else
    printf '  %-10s stopped\n' "$name"
  fi
}

pid_cmd() {
  local pid="$1"
  tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null || true
}

status_runtime_one() {
  local name="$1"
  local pid_file="$PID_DIR/$name.pid"
  local pid cwd cmd
  if ! pid_alive "$pid_file"; then
    return
  fi
  pid="$(cat "$pid_file")"
  cwd="$(pid_cwd "$pid" || true)"
  cmd="$(pid_cmd "$pid")"
  printf '  %-10s cwd      %s\n' "$name" "${cwd:-unknown}"
  printf '  %-10s command  %s\n' "$name" "${cmd:-unknown}"
}

status_all() {
  log "runtime:"
  printf '  %-16s %s\n' "ui-version" "$UI_VERSION_LABEL"
  printf '  %-16s %s\n' "agenthub-ui-dir" "$AGENTHUB_UI_DIR"
  printf '  %-16s %s\n' "legacy-im-dir" "$LEGACY_IM_WEB_DIR"
  printf '  %-16s %s\n' "tangseng-dir" "$TSDD_DIR"
  if [ -x "$TSDD_DIR/tsdd_server" ]; then
    printf '  %-16s %s\n' "tangseng-bin" "$(stat -c '%y' "$TSDD_DIR/tsdd_server" 2>/dev/null || echo unknown)"
  fi
  status_runtime_one tangseng
  status_runtime_one im-web
  status_runtime_one agenthub-ui
  log "processes:"
  status_one wukongim
  # Either clowder-api (default, API-only) or clowder-web (when CLOWDER_WEB=1).
  if pid_alive "$PID_DIR/clowder-web.pid"; then
    status_one clowder-web
  else
    status_one clowder-api
  fi
  status_one tangseng
  status_one im-web
  status_one agenthub-ui
  if command -v docker >/dev/null 2>&1; then
    log "containers:"
    local containers=("$MYSQL_CONTAINER" "$MINIO_CONTAINER")
    if [ "$REDIS_MODE" != "external" ]; then
      containers=("$MYSQL_CONTAINER" "$REDIS_CONTAINER" "$MINIO_CONTAINER")
    fi
    for c in "${containers[@]}"; do
      if container_exists "$c"; then
        printf '  %-15s %s\n' "$c" "$(docker_cmd inspect -f '{{.State.Status}}' "$c" 2>/dev/null || echo unknown)"
      else
        printf '  %-15s missing\n' "$c"
      fi
    done
    if [ "$REDIS_MODE" = "external" ]; then
      printf '  %-15s external\n' redis
    fi
  fi
  log "ports:"
  for item in "5001 WuKongIM" "3004 Clowder-API" "3003 Clowder-Web" "8090 TangSeng" "3000 Legacy-IM-Web" "5173 AgentHub-UI"; do
    set -- $item
    if (echo >"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; then
      printf '  %-5s open    %s\n' "$1" "$2"
    else
      printf '  %-5s closed  %s\n' "$1" "$2"
    fi
  done
}

show_logs() {
  local name="${1:-}"
  if [ -n "$name" ]; then
    tail -n 120 "$LOG_DIR/$name.log"
    return
  fi
  log "available logs:"
  ls -1 "$LOG_DIR" 2>/dev/null || true
  log "use: scripts/start-im-clowder.sh logs agenthub-ui"
}

case "${1:-start}" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  status)
    status_all
    ;;
  logs)
    show_logs "${2:-}"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 2
    ;;
esac
