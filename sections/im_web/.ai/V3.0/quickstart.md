# Quickstart: IM Web V3.0 Clowder Multi-Agent Connector

## Prerequisites

- IM Web dependencies installed under `sections/im_web`
- TangSengDaoDaoServer and WuKongIM running for normal IM message delivery
- Clowder API runnable from `/media/leng/DiskB1/exp/clowder-ai/packages/api`
- At least two Clowder cats configured with mention patterns
- V3.0 bridge feature flag disabled by default until configuration is present

## Configuration Draft

Set these values for the IM Web browser runtime. Vite reads `apps/chat/.env`; `scripts/dev-chat.sh` also accepts the same variables:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8090/v1/
VITE_MEDIA_BASE_URL=http://127.0.0.1:8090
VITE_OBJECT_STORAGE_BASE_URL=http://127.0.0.1:9000
VITE_TANGSENG_WS_HOST=127.0.0.1
```

Set these values in the backend environment that owns the bridge:

```bash
CLOWDER_API_BASE_URL=http://127.0.0.1:3000
CLOWDER_CONNECTOR_ID=im-web
CLOWDER_CONNECTOR_SECRET=<shared-secret>
CLOWDER_DEFAULT_OWNER_USER_ID=<clowder-user-id>
IM_WEB_CLOWDER_ENABLED=true
```

For the checked-in local V3 smoke environment, start or repair the TangSeng bridge with the guarded script instead of hand-running `go run`:

```bash
cd /media/leng/DiskB1/exp/seedcmp
sections/im_web/scripts/dev-tangseng-clowder.sh restart
sections/im_web/scripts/dev-tangseng-clowder.sh check
```

The script defaults `CLOWDER_API_BASE_URL` to the Clowder AI local entrypoint `http://127.0.0.1:3000` and `CLOWDER_DEFAULT_OWNER_USER_ID` to `default-user`, checks the process listening on `localhost:8090`, and fails fast if that process was started from the wrong checkout, with a stale Clowder URL, or with a stale owner.

For local smoke, keep Clowder AI itself on port `3000`. If another dev server is using `3000`, move that server instead of changing TangSeng's Clowder URL. The Clowder config files under `/media/leng/DiskB1/exp/clowder-ai` should not be edited for this; use process-level env overrides when starting the live stack.

Set these values in the Clowder API process:

```bash
CLOWDER_OUTBOUND_CALLBACK_URL=http://127.0.0.1:<tangseng-port>/api/im-web/clowder/outbound
CLOWDER_CONNECTOR_SECRET=<shared-secret>
```

## Environment Variable Inventory

| Variable | Owner | Required | Purpose | Safe Default |
|----------|-------|----------|---------|--------------|
| `IM_WEB_CLOWDER_ENABLED` | TangSeng bridge | Yes | Feature flag for all V3 Clowder controls and forwarding | `false` |
| `CLOWDER_API_BASE_URL` | TangSeng bridge | Yes when enabled | Server-side URL used to call Clowder connector APIs | empty |
| `CLOWDER_CONNECTOR_ID` | TangSeng bridge and Clowder | Yes | Stable connector ID used in bindings and dedup keys | `im-web` |
| `CLOWDER_CONNECTOR_SECRET` | TangSeng bridge and Clowder | Yes when enabled | Shared HMAC secret for server-to-server calls | empty |
| `CLOWDER_DEFAULT_OWNER_USER_ID` | TangSeng bridge | Yes when enabled | Clowder user ID used for direct-chat binding ownership | empty |
| `CLOWDER_REQUEST_TIMEOUT_MS` | TangSeng bridge | No | Timeout for inbound forward, health, and action calls | `5000` |
| `CLOWDER_SIGNATURE_TOLERANCE_MS` | TangSeng bridge and Clowder | No | Accepted timestamp drift for signed callbacks | `300000` |
| `CLOWDER_OUTBOUND_CALLBACK_URL` | Clowder API | Yes when enabled | TangSeng bridge callback URL for agent replies and stream events | empty |
| `CLOWDER_IM_WEB_HEALTH_PATH` | TangSeng bridge | No | Health endpoint path used by IM Web status checks | `/api/clowder/status` |
| `VITE_API_BASE_URL` | IM Web browser | Yes for non-proxy local runs | TangSeng HTTP API base used by axios | `/v1/` |
| `VITE_MEDIA_BASE_URL` | IM Web browser | No | Browser-reachable media/file origin | derived from `VITE_API_BASE_URL` |
| `VITE_OBJECT_STORAGE_BASE_URL` | IM Web browser | No | Browser-reachable object storage origin for preview links | derived from media host with port `9000` |
| `VITE_TANGSENG_WS_HOST` | IM Web browser | No | Fallback host when WuKongIM returns `localhost`, `127.0.0.1`, or `0.0.0.0` websocket addresses | current browser host |

Do not expose `CLOWDER_CONNECTOR_SECRET` or Clowder service credentials to browser code. Browser clients should call TangSeng-owned status/action APIs only.

## Local Analysis Commands

```bash
cd /media/leng/DiskB1/exp/seedcmp/sections/im_web
pnpm type-check
pnpm build
pnpm test:unit
./scripts/dev-chat.sh
./scripts/dev-tangseng-clowder.sh check
```

```bash
cd /media/leng/DiskB1/exp/clowder-ai/packages/api
pnpm build
pnpm test:public
```

Targeted V3 verification commands used during implementation:

```bash
cd /media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat
pnpm exec vitest run tests/clowderPermissionState.test.ts tests/clowderAgentDirectory.test.ts tests/clowderCommandContracts.test.ts tests/clowderMessagePresentation.test.ts tests/clowderPanel.test.ts tests/clowderControlStore.test.ts tests/clowderStreamingMerge.test.ts tests/clowderMediaFallback.test.ts tests/clowderHistoryRecovery.test.ts --pool=threads --poolOptions.threads.singleThread=true
```

```bash
cd /media/leng/DiskB1/exp/seedcmp/sections/im/TangSengDaoDaoServer
go test ./modules/clowder ./modules/common ./modules/robot -run 'Test(Normalize|Sign|Verify|DefaultClowder|ClowderBridgeConfigFromEnv|MessagesListen|StableStreamClientMsgNo|RobotRouting)' -count=1
```

```bash
cd /media/leng/DiskB1/exp/clowder-ai/packages/api
pnpm build
node --test test/im-web-webhook-response-mapping.test.js test/im-web-agent-directory-route.test.js test/im-web-multi-agent-routing.test.js test/im-web-streaming-adapter.test.js test/rich-block-plaintext.test.js test/im-web-permissions.test.js
```

## Manual Smoke Flow

1. Start TangSeng/WuKongIM, IM Web, and Clowder API.
2. Enable `IM_WEB_CLOWDER_ENABLED`.
3. Open IM Web and sign in with a test account.
4. In a direct chat, enable Clowder binding from the conversation Clowder panel or send the planned binding command.
5. Send `@<agent-alias> hello from IM Web`.
6. Verify Clowder creates or reuses an `im-web` connector binding and the agent reply appears once in IM Web.
7. Refresh IM Web and verify the user message and agent reply remain ordered and non-duplicated.
8. Repeat in a group chat with two human users and two different agent mentions.
9. Deny the group and verify future agent messages are blocked with a clear authorization response.
10. Re-enable the group, send `/cats`, `/status`, `/focus <agent>`, and `/ask <agent> <message>`, and verify command responses and routing state.
11. Send `/cats new 悟净 @悟净`, verify IM Web shows a success command response with the new cat id and alias, then send `/cats` and `/ask <new-cat-id> hello` to confirm the new cat is visible to Clowder routing.

The checked-in Playwright smoke specs are environment-gated. To run them against a live stack:

```bash
cd /media/leng/DiskB1/exp/seedcmp/sections/im_web/apps/chat
RUN_V3_CLOWDER_SMOKE=1 pnpm test:e2e -- smoke-v3-clowder
```

## Required Evidence Before Implementation Is Complete

- IM Web `pnpm type-check` pass
- IM Web `pnpm build` pass
- Relevant Vitest tests for message store merge/dedup, Clowder panel, command state, and permission UI pass
- Clowder API build and connector-focused tests pass
- Contract tests for `im-web` inbound and outbound payloads pass
- Playwright smoke screenshots for direct chat, group chat, multi-agent mentions, streaming reply, permission denied, and refresh history when the complete live environment is available
