# V3-02 Clowder production PWA missing `im-web` connector API routes

## Status

Open

## Reported At

2026-05-28 CST

## Labels

bug, clowder, connector, e2e, production

## Priority

P1

## User Request

Run browser automation against the production-mode Clowder PWA at `http://localhost:3003` and validate the V3.0 `im-web` connector integration.

## Problem

The production-mode Clowder PWA is reachable at `http://localhost:3003`, and general API routes work, but the V3 `im-web` connector routes return `404`.

Observed:

```text
GET http://localhost:3003/api/health -> 200
GET http://localhost:3003/api/commands?surface=connector -> 200
GET http://localhost:3003/api/cats -> 200
GET http://localhost:3003/api/connectors/im-web/status -> 404
GET http://localhost:3003/api/connectors/im-web/agents?externalChatId=2:test -> 404
GET http://localhost:3003/api/connectors/im-web/inbound -> 404
```

The source and `dist` artifacts contain the route definitions, but the running production PWA/API surface does not expose them through `localhost:3003`.

## Expected Behavior

The production PWA URL used by browser acceptance should expose:

```text
GET  /api/connectors/im-web/status
GET  /api/connectors/im-web/agents?externalChatId=<id>
POST /api/connectors/im-web/inbound
```

At minimum, `/status` should return:

```json
{
  "connectorId": "im-web",
  "enabled": true,
  "configured": true,
  "reachable": true,
  "version": "3.0",
  "featureFlags": {}
}
```

If the connector is not configured, the route should still exist and return a structured `unconfigured` response rather than `404`.

## Reproduction

1. Confirm Clowder production PWA is running:

   ```bash
   curl -i http://localhost:3003/api/health
   ```

2. Probe connector routes:

   ```bash
   curl -i http://localhost:3003/api/connectors/im-web/status
   curl -i 'http://localhost:3003/api/connectors/im-web/agents?externalChatId=2:test'
   ```

3. Result:

   ```json
   {"message":"Route GET:/api/connectors/im-web/status not found","error":"Not Found","statusCode":404}
   ```

4. Run Playwright panel smoke:

   ```bash
   RUN_V3_CLOWDER_SMOKE=1 CLOWDER_URL=http://localhost:3003 pnpm exec playwright test tests-e2e/smoke-v3-clowder-panel.spec.ts --reporter=line
   ```

5. Result:

   ```text
   Expected: 200
   Received: 404
   at expectClowderApiPreflight()
   ```

## Related Code

- `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/connector-webhooks.ts`
  - Defines `/api/connectors/im-web/inbound` and `/api/connectors/im-web/status`.
- `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/routes/thread-cats.ts`
  - Defines `/api/connectors/im-web/agents`.
- `/media/leng/DiskB1/exp/clowder-ai/packages/api/dist/routes/connector-webhooks.js`
  - Built artifact includes `/api/connectors/im-web/status`.
- `/media/leng/DiskB1/exp/clowder-ai/packages/api/src/index.ts`
  - Registers `connectorWebhookRoutes` with an empty handler map before listen.

## Test Discovery

| Test Type | Command / Operation | Result |
|---|---|---|
| API health | `curl -i http://localhost:3003/api/health` | Pass: 200 |
| Commands API | `curl -i 'http://localhost:3003/api/commands?surface=connector'` | Pass: 200, includes `/status`, `/cats`, `/focus`, `/ask`, `/new`, `/threads`, `/use`, `/thread`, `/where` |
| Cats API | `curl -i http://localhost:3003/api/cats` | Pass: 200 |
| Connector status | `curl -i http://localhost:3003/api/connectors/im-web/status` | Fail: 404 |
| Connector agents | `curl -i 'http://localhost:3003/api/connectors/im-web/agents?externalChatId=2:test'` | Fail: 404 |
| Layer 5 E2E | `smoke-v3-clowder-panel.spec.ts` | Fail: expected connector status 200, got 404 |

## Evidence

- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-panel-V3--b6fd6-ts-focus-and-delivery-state-chromium/error-context.md`

## Root Cause Hypothesis

The running production PWA on port `3003` appears to expose general API routes, but not the newly added connector route prefix. Likely causes:

- production process is serving an older API bundle or route manifest,
- Next production API proxy/rewrite excludes `/api/connectors/*`,
- connector route plugin is registered in source/dist but not in the API instance reached through `localhost:3003`,
- production quick mode reused stale web/API artifacts.

## Proposed Fix

- Rebuild and restart Clowder production mode without stale quick artifacts.
- Confirm the API instance behind `localhost:3003` loads the new `dist/routes/connector-webhooks.js`.
- Add a production smoke check to Clowder startup for `/api/connectors/im-web/status`.
- If Next rewrites proxy API routes, ensure `/api/connectors/:path*` is forwarded to the Fastify API.

## Acceptance Criteria

- [ ] `GET http://localhost:3003/api/connectors/im-web/status` returns 200 with `connectorId: "im-web"`.
- [ ] `GET http://localhost:3003/api/connectors/im-web/agents?externalChatId=<id>` does not return 500 or route-level 404.
- [ ] `POST http://localhost:3003/api/connectors/im-web/inbound` reaches the handler and returns either signed-routing result or `401 invalid_signature`.
- [ ] `smoke-v3-clowder-panel.spec.ts` passes the Clowder API preflight.

