# AgentHub — 多 Agent 协作平台

AgentHub 是一个以 IM 聊天为入口的多 Agent 协作平台。用户像使用普通聊天工具一样发送需求、文件和确认指令；后端把消息同步到 TangSeng/WuKongIM，并通过 Clowder 调度 Claude Code、Codex、opencode 等执行型 Agent。Agent 的回复、文件、预览和部署请求会回到同一条聊天流里，方便追踪和验收。

本文只描述当前主前端 `sections/ui` 的部署和配置方式。产品/技术说明见 `assets/roadmap/`。

## 1. 项目结构

| 路径 | 作用 |
| --- | --- |
| `sections/ui` | AgentHub H5 前端，基于 Vue 3、uni-app、Pinia 和 Vite |
| `sections/im/WuKongIM` | IM 通讯层，负责长连接、消息投递和历史 |
| `sections/im/TangSengDaoDaoServer` | IM 业务层，负责登录、好友、群组、文件、消息 API 和 Clowder bridge |
| `sections/clowder-ai` | 多 Agent 平台，负责 thread、connector、命令、路由、Agent 调用、产物和部署 |
| `scripts/start-im-clowder.sh` | 本地集成启动脚本，拉起基础设施、IM、Clowder API 和 `sections/ui` |
| `assets/roadmap` | PRD、技术文档、架构图和 UI 验收截图 |

## 2. 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3、uni-app H5、Pinia、Vite、Sass、`wukongimjssdk` |
| 文件预览 | `markdown-it`、KaTeX、Mammoth、PDF.js、JSZip |
| IM 通讯 | WuKongIM、WebSocket、TCP、Pebble |
| IM 业务 | TangSengDaoDaoServer、Go、Gin、MySQL、Redis、MinIO |
| Agent 平台 | Node.js 20+、TypeScript、Fastify、Socket.IO、Redis、better-sqlite3 |
| Agent 适配 | Claude Code、Codex、opencode、Clowder connector router |
| 部署与预览 | Clowder deployment routes、preview gateway、静态站点预览 |
| 本地基础设施 | Docker、MySQL 8、Redis 7、MinIO |

## 3. 架构概览

```text
Browser
  |
  |  sections/ui H5
  |  /v1 -> TangSeng API
  |  /clowder-api -> Clowder API
  v
TangSengDaoDaoServer  <->  WuKongIM
  |
  | HMAC signed inbound/outbound bridge
  v
Clowder API  <->  Agent runtimes
  |
  v
Artifacts / preview / deployment
```

消息归属边界：

- `sections/ui` 只负责用户界面、消息状态、文件预览、Agent 目录、技能、项目看板和卡片展示。
- `sections/im` 负责 IM 账号、会话、群组、消息持久化、文件上传和多端同步。
- `sections/clowder-ai` 负责 Agent 路由、权限、thread binding、协作记录、执行调用、产物和部署。

## 4. 本地一键启动

### 4.1 环境要求

建议环境：

| 依赖 | 版本或说明 |
| --- | --- |
| Node.js | 20+ |
| Corepack / pnpm | 脚本会使用 Corepack；Clowder 默认 `pnpm@9.15.4` |
| Go | 推荐 1.23.x；TangSeng 最低 1.20，WuKongIM 使用 1.23 toolchain |
| Docker | 用于 MySQL、Redis、MinIO |
| Bash | 启动脚本依赖 Bash、`lsof`/`ss`/`fuser` 中至少一个用于端口清理 |

第一次使用可先启用 Corepack：

```bash
corepack enable
```

### 4.2 启动完整本地栈

在仓库根目录执行：

```bash
bash scripts/start-im-clowder.sh start
```

脚本会自动处理：

- Docker 容器：MySQL、Redis、MinIO
- Go 服务：WuKongIM、TangSengDaoDaoServer
- Node 服务：Clowder API
- 前端：`sections/ui` H5 dev server

启动完成后访问：

```text
http://localhost:5173/#/pages/login/index
```

已登录时可直接进入：

```text
http://localhost:5173/#/pages/chat/index
```

常用管理命令：

```bash
bash scripts/start-im-clowder.sh status
bash scripts/start-im-clowder.sh logs
bash scripts/start-im-clowder.sh logs agenthub-ui
bash scripts/start-im-clowder.sh logs tangseng
bash scripts/start-im-clowder.sh logs clowder-api
bash scripts/start-im-clowder.sh restart
bash scripts/start-im-clowder.sh stop
```

运行日志位于：

```text
.seedcmp-run/logs/
```

### 4.3 默认访问地址

| 服务 | 地址 |
| --- | --- |
| AgentHub UI | `http://localhost:5173` |
| TangSeng API | `http://127.0.0.1:8090` |
| Clowder API | `http://127.0.0.1:3004` |
| WuKongIM API | `http://127.0.0.1:5001` |
| WuKongIM WebSocket | `ws://127.0.0.1:5200` |
| MinIO API | `http://127.0.0.1:9000` |
| MinIO Console | `http://127.0.0.1:9001` |
| Clowder preview gateway | `http://127.0.0.1:4100` |

### 4.4 测试账号

短信验证码统一使用：

```text
123456
```


## 5. 配置如何修改

本项目推荐通过环境变量改配置。最简单的方式是在启动命令前追加变量：

```bash
CLOWDER_CONNECTOR_SECRET=change-me \
CLOWDER_DEFAULT_OWNER_USER_ID=user-1 \
bash scripts/start-im-clowder.sh restart
```

### 5.1 本地集成启动脚本配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `AGENTHUB_UI` | `1` | 是否启动 `sections/ui` H5 前端 |
| `CLOWDER_URL` | `http://127.0.0.1:3004` | Clowder API 地址，前端和 TangSeng 都会使用 |
| `CLOWDER_WEB` | `0` | 是否额外启动 Clowder 管理 Web |
| `CLOWDER_WEB_URL` | `http://127.0.0.1:3003` | Clowder 管理 Web 地址 |
| `CLOWDER_CONNECTOR_ID` | `im-web` | Clowder connector ID，需与两端配置一致 |
| `CLOWDER_CONNECTOR_SECRET` | `dev-shared-secret` | TangSeng 与 Clowder 双向 HMAC secret |
| `CLOWDER_DEFAULT_OWNER_USER_ID` | `user-1` | TangSeng 代理访问 Clowder 时使用的默认 owner |
| `TANGSENG_WAIT_TIMEOUT` | `180` | 等待 TangSeng API 启动的秒数 |
| `SEEDCMP_CLEAN_OLD_PORTS` | `1` | 启动前清理旧 seedcmp/worktree 端口监听 |
| `SEEDCMP_CLEAN_ALL_PORTS` | `0` | 设置为 `1` 会清理已知端口上的任意监听，谨慎使用 |
| `REDIS_MODE` | `auto` | `auto`、`docker` 或 `external` |
| `INFRA_IMAGE_PREFIX` | 空 | Docker 镜像前缀，适合内网镜像源 |

基础设施账号和镜像：

| 变量 | 默认值 |
| --- | --- |
| `MYSQL_CONTAINER` | `seedcmp-mysql` |
| `MYSQL_IMAGE` | `m.daocloud.io/docker.io/library/mysql:8.0.33` |
| `MYSQL_ROOT_PASSWORD` | `demo` |
| `MYSQL_DATABASE` | `im` |
| `MYSQL_USER` | `tsdd_user` |
| `MYSQL_PASSWORD` | `tsdd_password` |
| `REDIS_CONTAINER` | `seedcmp-redis` |
| `REDIS_IMAGE` | `m.daocloud.io/docker.io/library/redis:7` |
| `MINIO_CONTAINER` | `seedcmp-minio` |
| `MINIO_IMAGE` | `m.daocloud.io/quay.io/minio/minio:latest` |
| `MINIO_ROOT_USER` | `minio` |
| `MINIO_ROOT_PASSWORD` | `minio123` |

示例：使用外部 Redis 和公司镜像源：

```bash
REDIS_MODE=external \
INFRA_IMAGE_PREFIX=registry.example.com/library/ \
bash scripts/start-im-clowder.sh restart
```

### 5.2 `sections/ui` 前端配置

开发模式下，`sections/ui/vite.config.js` 已经配置代理：

| 前端请求 | 默认代理目标 | 修改方式 |
| --- | --- | --- |
| `/v1/*` | `http://127.0.0.1:8090` | `VITE_TANGSENG_PROXY_TARGET` |
| `/clowder-api/*` | `http://127.0.0.1:3004` | `VITE_CLOWDER_PROXY_TARGET` |

前端运行时也会读取浏览器 storage：

| Storage key | 用途 |
| --- | --- |
| `native_api_base_url` | 覆盖 TangSeng API base URL |
| `clowder_api_base_url` | 覆盖 Clowder API base URL |
| `native_device_id` | 当前浏览器设备 ID |

如果要单独启动 UI：

```bash
cd sections/ui
npm install
npm run dev:h5
```

如果要构建 H5 静态产物：

```bash
cd sections/ui
npm install
npm run build:h5
```

产物目录：

```text
sections/ui/dist/build/h5
```

本地预览构建产物：

```bash
cd sections/ui
PORT=5173 node scripts/serve-prod.js
```

### 5.3 TangSeng Clowder bridge 配置

TangSeng 通过环境变量启用 Clowder bridge：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `IM_WEB_CLOWDER_ENABLED` | `false` | 设置为 `true` 后启用 bridge |
| `CLOWDER_API_BASE_URL` | 空 | Clowder API 地址，例如 `http://127.0.0.1:3004` |
| `CLOWDER_CONNECTOR_ID` | `im-web` | connector ID |
| `CLOWDER_CONNECTOR_SECRET` | 空 | HMAC secret，必须与 Clowder 侧一致 |
| `CLOWDER_DEFAULT_OWNER_USER_ID` | 空 | bridge 代理访问 Clowder 的默认 owner |
| `CLOWDER_REQUEST_TIMEOUT_MS` | `5000` | 请求 Clowder 超时时间 |
| `CLOWDER_SIGNATURE_TOLERANCE_MS` | `300000` | HMAC 签名时间窗 |

只有当 `Enabled/APIBaseURL/ConnectorID/ConnectorSecret/DefaultOwnerUserID` 都有值时，bridge 才算配置完整。

### 5.4 Clowder API 配置

本地脚本会自动给 Clowder API 注入：

| 变量 | 默认值或来源 | 说明 |
| --- | --- | --- |
| `CAT_CAFE_API_URL` | `CLOWDER_URL` | Clowder API public URL |
| `NEXT_PUBLIC_API_URL` | `CLOWDER_URL` | 前端/公开 API URL |
| `DEFAULT_OWNER_USER_ID` | `CLOWDER_DEFAULT_OWNER_USER_ID` | 默认 owner |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Clowder 状态存储 |
| `REDIS_KEY_PREFIX` | `seedcmp:cat-cafe:` | Redis key 前缀 |
| `API_SERVER_PORT` | `3004` | Clowder API 端口，单独启动 API 时可改 |
| `PREVIEW_GATEWAY_PORT` | `4100` | preview gateway 端口 |
| `MEMORY_STORE` | 未设置 | 没有 Redis 时可设为 `1` 使用内存存储，仅适合临时调试 |

单独启动 Clowder API：

```bash
cd sections/clowder-ai
corepack pnpm install
corepack pnpm --filter @cat-cafe/api build

cd packages/api
REDIS_URL=redis://127.0.0.1:6379 \
DEFAULT_OWNER_USER_ID=user-1 \
API_SERVER_PORT=3004 \
corepack pnpm start
```

## 6. 生产或演示环境部署

### 6.1 推荐拓扑

```text
Nginx / Caddy / Ingress
  |
  +-- /                 -> sections/ui/dist/build/h5
  +-- /v1               -> TangSengDaoDaoServer:8090
  +-- /clowder-api      -> Clowder API:3004, strip /clowder-api
  +-- WuKongIM WS/TCP   -> expose 5200/5100 or configure external gateway

TangSengDaoDaoServer -> MySQL / Redis / MinIO / WuKongIM
Clowder API          -> Redis / workspace storage / Agent runtimes
```

生产环境建议：

- 使用独立 MySQL、Redis、MinIO，不复用本地 demo 容器。
- 修改 `CLOWDER_CONNECTOR_SECRET`，不要使用 `dev-shared-secret`。
- 用 HTTPS 终止在网关层，并让前端通过同域 `/v1` 和 `/clowder-api` 访问后端。
- 对外只开放需要的端口；MySQL、Redis、MinIO API 不直接暴露公网。
- 为 Clowder API、TangSeng 和 WuKongIM 配置进程守护，例如 systemd、Supervisor、Docker Compose 或 Kubernetes。

### 6.2 构建步骤

构建 AgentHub UI：

```bash
cd sections/ui
npm install
npm run build:h5
```

构建 Clowder API：

```bash
cd sections/clowder-ai
corepack pnpm install
corepack pnpm --filter @cat-cafe/api build
```

构建 WuKongIM：

```bash
cd sections/im/WuKongIM
go mod download
go build -o wukongim ./cmd/wukongim/
```

构建 TangSengDaoDaoServer：

```bash
cd sections/im/TangSengDaoDaoServer
go mod download
go build -o tsdd_server .
```

### 6.3 Nginx 示例

下面示例假设：

- H5 产物放在 `/opt/agenthub/ui`
- TangSeng API 在 `127.0.0.1:8090`
- Clowder API 在 `127.0.0.1:3004`

```nginx
server {
    listen 80;
    server_name agenthub.example.com;

    root /opt/agenthub/ui;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:8090/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /clowder-api/ {
        proxy_pass http://127.0.0.1:3004/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

如果前端与后端不在同域部署，需要通过 `VITE_TANGSENG_PROXY_TARGET`、`VITE_CLOWDER_PROXY_TARGET` 或运行时 storage 调整 API 地址，并同时配置后端 CORS。

## 7. Demo 使用流程

1. 启动完整本地栈：

   ```bash
   bash scripts/start-im-clowder.sh start
   ```

2. 打开 `http://localhost:5173/#/pages/login/index`。
3. 使用 `008618337488675` / `123456` 登录。
4. 进入群聊或 Agent 会话，发送需求并 @ 可用 Agent。
5. 查看聊天流中的 Agent 回复、文件卡、预览入口、部署卡和看板状态。

推荐测试一句：

```text
@协调者 请帮我拆解一个 AgentHub 活动页任务，安排执行 Agent 生成页面，完成后给出预览、源码下载和风险说明。
```

OAuth 前置条件：

- 使用 Claude Code Agent 前，先在本机完成 `claude login`。
- 使用 Codex Agent 前，先在本机完成 `codex login`。
- 实际可用 Agent 以页面里的 Agent 列表、群成员和 Clowder API 返回为准。

## 8. 测试与验收

常用检查命令：

```bash
# 前端构建
cd sections/ui
npm run build:h5

# 前端状态测试
npm run test:native-im

# 前端 smoke，H5_BASE_URL 可指向实际端口
H5_BASE_URL=http://localhost:5173 npm run test:smoke
```

```bash
# TangSeng bridge 测试
cd sections/im/TangSengDaoDaoServer
go test ./modules/common ./modules/clowder
```

```bash
# Clowder API 构建与公开测试
cd sections/clowder-ai
corepack pnpm --filter @cat-cafe/api build
corepack pnpm --filter @cat-cafe/api test:public
```

人工验收重点：

- 登录、会话列表、群聊和单聊可用。
- 文本消息发送后能同步、刷新后不重复。
- 文件卡可以下载和预览。
- Markdown、图片、Office/PDF 预览不空白。
- Agent 回复能回写同一会话。
- Clowder 不可用时，UI 有明确失败态。
- 部署卡能进入 queued/running/succeeded/failed 状态。

## 9. 常见问题

### 9.1 5173 端口被占用

执行：

```bash
bash scripts/start-im-clowder.sh restart
```

脚本默认会清理旧 seedcmp/worktree 监听。如果仍然占用，可查看：

```bash
lsof -i :5173
```

### 9.2 Docker 拉镜像慢

配置镜像前缀：

```bash
INFRA_IMAGE_PREFIX=registry.example.com/library/ \
bash scripts/start-im-clowder.sh start
```

也可以单独改 `MYSQL_IMAGE`、`REDIS_IMAGE`、`MINIO_IMAGE`。

### 9.3 TangSeng 已启动但前端请求失败

检查：

```bash
bash scripts/start-im-clowder.sh status
bash scripts/start-im-clowder.sh logs tangseng
```

确认 `/v1` 代理目标是 `http://127.0.0.1:8090`，并检查浏览器 storage 中是否误写了 `native_api_base_url`。

### 9.4 Agent 没有回复

检查：

```bash
bash scripts/start-im-clowder.sh logs clowder-api
bash scripts/start-im-clowder.sh logs tangseng
```

重点确认：

- `CLOWDER_CONNECTOR_SECRET` 两端一致。
- `CLOWDER_DEFAULT_OWNER_USER_ID` 有值。
- Clowder API `http://127.0.0.1:3004` 可访问。
- 当前群聊或会话已绑定可用 Agent。
- 需要真实 CLI Agent 时，本机已完成对应 OAuth 登录。

### 9.5 文件预览空白

检查：

- TangSeng 文件上传是否成功。
- MinIO 容器是否运行。
- 浏览器控制台是否有资源 404。
- `sections/ui` 是否已重新构建，尤其是 Office/PDF/Markdown 预览相关依赖更新后。

## 10. 相关文档

- `assets/roadmap/prd产品需求文档.md`
- `assets/roadmap/技术文档.md`
- `assets/roadmap/figures/`
- `assets/roadmap/evidence/`
- `sections/ui/issues/`
