# V3-01 IM Web smoke login backend unreachable

## Status

Open

## Reported At

2026-05-28 CST

## Labels

bug, testing, e2e, environment

## Priority

P1

## User Request

Run the V3.0 browser automation acceptance flow and create issues for discovered problems, consistent with previous IM Web versions.

## Problem

The V3 Playwright smoke suite cannot reach IM Web chat flows because the browser remains on `/login` after submitting the default test account.

The login form is visible and filled with:

- username: `18337488675`
- password: `123456`

After clicking `安全登录`, the page stays at:

```text
http://localhost:3000/login
```

Playwright expected a redirect matching `/\/chat/` and timed out after 15 seconds.

## Expected Behavior

With valid smoke credentials and a reachable TangSeng API, IM Web should:

- post `user/login` to the configured TangSeng API,
- persist login/session state,
- navigate to `/chat`,
- render `.conversation-list-container`.

If the backend is unavailable, the login page should show a clear user-facing error that can be asserted by E2E tests.

## Reproduction

1. Start V3 smoke from `sections/im_web/apps/chat`.
2. Run:

   ```bash
   RUN_V3_CLOWDER_SMOKE=1 CLOWDER_URL=http://localhost:3003 pnpm exec playwright test tests-e2e/smoke-v3-clowder-*.spec.ts --reporter=line
   ```

3. Observe all IM Web-dependent V3 tests fail at `helpers/v3-clowder.ts:38`.
4. Probe the configured API directly:

   ```bash
   curl --noproxy '*' -i --max-time 8 \
     -X POST http://100.79.157.76:8090/v1/user/login \
     -H 'content-type: application/json' \
     --data '{"username":"18337488675","password":"123456","device":{"device_id":"playwright-smoke","device_name":"Playwright","platform":"web"}}'
   ```

5. Result:

   ```text
   curl: (7) Failed to connect to 100.79.157.76 port 8090
   ```

With proxy variables enabled, the same request returned `HTTP/1.1 502 Bad Gateway`.

## Related Code

- `sections/im_web/packages/base-vue/src/service/APIClient.ts`
  - `apiClient.baseURL` is currently hardcoded to `http://100.79.157.76:8090/v1/`.
- `sections/im_web/packages/login-vue/src/stores/loginStore.ts`
  - `loginWithPassword()` calls `userStore.login()`, which depends on the configured API.
- `sections/im_web/apps/chat/tests-e2e/helpers/v3-clowder.ts`
  - `login()` waits for `/chat` and `.conversation-list-container`.

## Test Discovery

| Test Type | Command / Operation | Result |
|---|---|---|
| Layer 5 E2E | `RUN_V3_CLOWDER_SMOKE=1 CLOWDER_URL=http://localhost:3003 pnpm exec playwright test tests-e2e/smoke-v3-clowder-*.spec.ts --reporter=line` | Fail: login remains on `/login` |
| API probe | `curl --noproxy '*' http://100.79.157.76:8090/v1/user/login` | Fail: connection refused |
| Server probe | `ss -ltnp | rg ':(3000|3003|8090)\b'` | Only `3003` is listening; no TangSeng API on `8090` |

## Evidence

- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-binding-V-b0309-durable-reply-after-refresh-chromium/error-context.md`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-permissio-4312c-d-blocks-non-admin-commands-chromium/error-context.md`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-streaming-c2aee-eeps-media-fallback-visible-chromium/error-context.md`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-thread-li-c8b43-th-visible-command-feedback-chromium/error-context.md`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-v2-regres-2b65b-al-V2-robot-history-working-chromium/error-context.md`

## Proposed Fix

- Start TangSengDaoDaoServer and WuKongIM for the smoke environment, or configure IM Web to point at the correct reachable TangSeng API URL.
- Avoid hardcoding the LAN API host for browser smoke if the local acceptance environment uses a different endpoint.
- Add a clear login error assertion path to the smoke helper so backend-unreachable failures are reported with the actual API error message.

## Acceptance Criteria

- [ ] `curl --noproxy '*' http://<tangseng-api>/v1/user/login` succeeds with smoke credentials.
- [ ] IM Web login redirects to `/chat`.
- [ ] `.conversation-list-container` renders.
- [ ] V3 smoke tests progress beyond the shared `login()` helper.

