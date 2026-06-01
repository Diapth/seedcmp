# V3-05: Clowder Runtime IM Web Connector Is Not Enabled For Full Live Routing

## Status

Resolved on 2026-06-01

## Severity

Medium

## Finding

The final live failure was caused by stale runtime state, not by the current checked-in bridge code: `localhost:8090` was still served by a TangSeng bridge process started on 2026-05-31, before the owner-header fix was deployed, and that process still had `CLOWDER_DEFAULT_OWNER_USER_ID=6db8b65b3ae94092badfeb82e47c06f7`. The live Clowder connector bindings are owned by `default-user`, so the stale bridge kept proxying agent-directory requests with the wrong Clowder identity and group/direct cat conversations could return `403 Forbidden` through TangSeng as `agent_directory_unavailable`.

The IM Web side now exposes the fixed `Clowder AI` contact, opens the `clowder_ai` direct conversation, and renders the unified right dock. This issue originally tracked the live Clowder runtime reporting the `im-web` connector as disabled/unconfigured; later verification narrowed the remaining gap to bound IM Web agent-directory authorization and finally to the stale `localhost:8090` TangSeng bridge process described above.

## Original Evidence

```bash
curl -sS http://localhost:3003/api/connectors/im-web/status
```

Returned:

```json
{
  "connectorId": "im-web",
  "enabled": false,
  "configured": false,
  "reachable": false,
  "version": "3.0",
  "featureFlags": { "imWebConnector": false },
  "registered": false,
  "state": "unconfigured"
}
```

```bash
curl -i 'http://localhost:3003/api/connectors/im-web/agents?externalChatId=1:clowder_ai' -H 'x-cat-cafe-user: 18337488675'
```

Returned `404 {"error":"Binding not found"}`.

## Impact

- The Clowder panel can open in IM Web, but live agent directory data depends on a configured Clowder connector and an existing connector-thread binding.
- Sending normal messages to `Clowder AI` will only reach Clowder after both TangSeng and Clowder use matching connector settings.

## Expected Configuration

Clowder API runtime should be started with compatible connector settings, for example:

```bash
IM_WEB_CLOWDER_ENABLED=true
CLOWDER_CONNECTOR_SECRET=<shared-secret>
CLOWDER_OUTBOUND_CALLBACK_URL=http://127.0.0.1:8090/api/im-web/clowder/outbound
DEFAULT_OWNER_USER_ID=<clowder-owner-user-id>
```

TangSeng should use the same secret and Clowder API base URL:

```bash
IM_WEB_CLOWDER_ENABLED=true
CLOWDER_API_BASE_URL=http://127.0.0.1:3004
CLOWDER_CONNECTOR_ID=im-web
CLOWDER_CONNECTOR_SECRET=<shared-secret>
CLOWDER_DEFAULT_OWNER_USER_ID=<clowder-owner-user-id>
```

## Acceptance

- [x] `GET /api/connectors/im-web/status` returns `enabled: true`, `configured: true`, `state: "ready"`.
- [x] Sending a first message in `clowder_ai` creates or resolves a binding for `externalChatId=1:clowder_ai`.
- [x] `GET /api/connectors/im-web/agents?externalChatId=1:clowder_ai` returns agent data instead of `Binding not found` after the Clowder route fallback patch is deployed.
- [x] TangSeng bridge queries Clowder agent directory with the connector owner identity, while keeping IM Web user-specific `externalChatId` calculation for direct virtual cat channels.
- [x] IM Web Clowder panel shows agent rows without an agent-directory unavailable state after the updated TangSeng bridge process is rebuilt/restarted.

## 2026-05-29 Reverification

Live status is now ready:

```json
{"connectorId":"im-web","enabled":true,"configured":true,"reachable":true,"version":"3.0","featureFlags":{"imWebConnector":true},"registered":true,"state":"ready"}
```

The old disabled/unconfigured state is no longer reproducible. The remaining live gap was unbound agent discovery: `GET /api/connectors/im-web/agents?externalChatId=1:clowder_ai` still returned `404 {"error":"Binding not found"}` from the currently running Clowder process.

Clowder route contract fix:

- Added a regression test for unbound IM Web external chats.
- Updated `/api/connectors/im-web/agents` to return the routable cat directory with `bindingRequired: true` instead of returning `Binding not found`.
- Verification in `/media/leng/DiskB1/exp/clowder-ai/packages/api`: `pnpm build && node --test test/im-web-agent-directory-route.test.js` passes 2 tests.

The live `localhost:3003` process must be rebuilt/restarted before this route-level fallback is visible in browser smoke.

Browser/API smoke with Playwright against `http://localhost:3003` on 2026-05-29:

- PWA loads with title `Clowder AI`.
- `/api/health` returns 200.
- `/api/connectors/im-web/status` returns 200 and `state:"ready"`.
- `/api/cats` returns multiple cats.
- `/api/connectors/im-web/agents?externalChatId=1:clowder_ai` still returns 404 from the currently running process, matching the restart requirement above.

## 2026-06-01 Bridge Owner Header Fix

Root cause:

- Clowder's `/api/connectors/im-web/agents` route correctly authorizes bound connector threads against the binding owner.
- Live group `externalChatId=2:cec409c5b5db4399a27358e76eb587b1` returned `403 Forbidden` when queried with the IM login UID (`18337488675`), but returned `200 OK` with `x-cat-cafe-user: default-user`.
- TangSeng `fetchAgentDirectory()` was using `ctx.GetLoginUID()` for the Clowder identity header. The connector thread binding owner is the bridge default owner, so group and already-bound direct cat directory queries could be rejected before the browser saw agent rows.

Fix:

- Updated `sections/im/TangSengDaoDaoServer/modules/clowder/api.go` so `fetchAgentDirectory()` sends `x-cat-cafe-user` as `DefaultOwnerUserID` when configured, falling back to the login UID only when no bridge owner exists.
- Kept `externalChatId` generation user-aware for direct virtual cat channels, so `1:<fake user/cat channel>` remains per IM user while Clowder thread auth uses the connector owner.
- Added/updated tests in `sections/im/TangSengDaoDaoServer/modules/clowder/proxy_test.go` for group directory proxying, direct virtual cat external chat calculation, and owner-header auth.

Verification:

```bash
cd sections/im/TangSengDaoDaoServer
go test ./modules/clowder -run TestFetchAgentDirectoryUsesBridgeOwnerForClowderThreadAuth -count=1
```

Result: failed before the fix with `expected: "default-user" actual: "im-user-1"`.

```bash
cd sections/im/TangSengDaoDaoServer
go test ./modules/clowder -run 'TestFetchAgentDirectory|TestFetchCatDirectory' -count=1
go test ./modules/clowder ./modules/robot -count=1
```

Result: passed.

```bash
cd /media/leng/DiskB1/exp/clowder-ai/packages/api
pnpm build
node --test test/im-web-agent-directory-route.test.js
```

Result: build passed; 2 route tests passed.

```bash
cd sections/im_web
pnpm type-check
pnpm build
cd apps/chat
pnpm exec vitest run tests/clowderAgentDirectory.test.ts tests/clowderPanel.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

Result: type-check passed; build passed with the existing Vite chunk-size warning; 2 files / 4 Vitest tests passed.

Live diagnostic against the running Clowder API:

```bash
curl --noproxy '*' -sS -i 'http://localhost:3003/api/connectors/im-web/agents?externalChatId=2:cec409c5b5db4399a27358e76eb587b1' -H 'x-cat-cafe-user: default-user'
```

Result: `200 OK`, with `ragdoll-kn9a`, `codex`, and the remaining live cat directory rows.

## 2026-06-01 Live Restart Completion

Root cause of the remaining live failure:

- `localhost:8090` was still served by a TangSeng bridge process started on 2026-05-31, before the owner-header fix was deployed.
- That process also had `CLOWDER_DEFAULT_OWNER_USER_ID=6db8b65b3ae94092badfeb82e47c06f7`, while the live Clowder connector bindings are owned by `default-user`.
- Direct Clowder verification showed `x-cat-cafe-user: default-user` returned `200 OK` for `externalChatId=2:cec409c5b5db4399a27358e76eb587b1`, while the old owner returned `403 Forbidden`.

Runtime fix:

- Restarted the `tangseng-v3-seedcmp` tmux process from the current `sections/im/TangSengDaoDaoServer` checkout.
- Started it with `CLOWDER_DEFAULT_OWNER_USER_ID=default-user` and the existing local connector settings:

```bash
IM_WEB_CLOWDER_ENABLED=true
CLOWDER_API_BASE_URL=http://127.0.0.1:3004
CLOWDER_CONNECTOR_ID=im-web
CLOWDER_CONNECTOR_SECRET=dev-im-web-secret
CLOWDER_DEFAULT_OWNER_USER_ID=default-user
go run . api -config configs/tsdd.yaml
```

Durable prevention:

- Added `sections/im_web/scripts/dev-tangseng-clowder.sh` so V3 smoke runs have a single guarded TangSeng bridge entrypoint.
- The script defaults the local live owner to `default-user`, starts/restarts the `tangseng-v3-seedcmp` tmux session from the current checkout, and checks the process listening on `localhost:8090`.
- `check` fails if the listener is from the wrong checkout or if `CLOWDER_DEFAULT_OWNER_USER_ID` differs from the expected owner, catching the exact stale-process/stale-owner failure before Playwright/API smoke.
- Added `sections/im_web/scripts/dev-tangseng-clowder.test.sh` to regress the stale owner case by spawning a fake runtime with `old-owner` and requiring the check to fail with an owner mismatch.

Post-restart verification:

```bash
curl --noproxy '*' -sS -i http://localhost:8090/v1/health
```

Result: `200 OK`, `{"db":"up","redis":"up","status":"up"}`.

```bash
curl --noproxy '*' -sS -i http://localhost:3003/api/connectors/im-web/status
```

Result: `200 OK`, `state:"ready"`, `enabled:true`, `configured:true`, `reachable:true`.

```bash
GET /v1/clowder/conversation/agents?channelId=cec409c5b5db4399a27358e76eb587b1&channelType=2
```

Result after login: `200 OK`, thread `thread_mpu1mp2tfhrabwfx`, 6 live agents including `ragdoll-kn9a` and `codex`.

```bash
GET /v1/clowder/conversation?channelId=cec409c5b5db4399a27358e76eb587b1&channelType=2
```

Result after login: `200 OK`, binding owner `default-user`, `externalChatId:"2:cec409c5b5db4399a27358e76eb587b1"`, 6 live agents.

```bash
GET /v1/clowder/conversation?channelId=clowder_ai&channelType=1
GET /v1/clowder/conversation/agents?channelId=clowder_ai&channelType=1
```

Result after login: both returned `200 OK` with the live agent directory.

```bash
cd sections/im/TangSengDaoDaoServer
go test ./modules/clowder -run 'TestFetchAgentDirectory|TestFetchCatDirectory' -count=1
```

Result: passed.

```bash
cd /media/leng/DiskB1/exp/seedcmp
bash sections/im_web/scripts/dev-tangseng-clowder.test.sh
sections/im_web/scripts/dev-tangseng-clowder.sh restart
sections/im_web/scripts/dev-tangseng-clowder.sh check
```

Result: shell regression passed; restart replaced the 8090 listener; check returned `runtime ok` with owner `default-user`.

```bash
cd sections/im_web/apps/chat
RUN_V3_CLOWDER_SMOKE=1 TARGET_URL=http://localhost:3000 CLOWDER_URL=http://localhost:3003 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_GROUP_CONVERSATION=集群 TEST_AGENT_A=codex TEST_AGENT_B=ragdoll CLOWDER_TEST_USER=default-user CLOWDER_CONNECTOR_SECRET=dev-im-web-secret pnpm exec playwright test tests-e2e/smoke-v3-clowder-panel.spec.ts --config playwright.config.ts --reporter=line
```

Result: 1 passed.

```bash
cd sections/im_web/apps/chat
RUN_V3_CLOWDER_SMOKE=1 TARGET_URL=http://localhost:3000 CLOWDER_URL=http://localhost:3003 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 TEST_GROUP_CONVERSATION=集群 TEST_AGENT_A=codex CLOWDER_TEST_USER=default-user CLOWDER_CONNECTOR_SECRET=dev-im-web-secret pnpm exec playwright test tests-e2e/smoke-v3-clowder-binding.spec.ts --config playwright.config.ts --reporter=line
```

Result: 1 passed.
