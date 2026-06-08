# V3 Browser Acceptance Summary - 2026-05-28 17:15 CST

## Command

```bash
cd sections/im_web/apps/chat
RUN_V3_CLOWDER_SMOKE=1 CLOWDER_URL=http://localhost:3003 pnpm exec playwright test tests-e2e/smoke-v3-clowder-panel.spec.ts tests-e2e/smoke-v3-clowder-binding.spec.ts tests-e2e/smoke-v3-clowder-multi-agent.spec.ts tests-e2e/smoke-v3-clowder-permissions.spec.ts tests-e2e/smoke-v3-clowder-streaming-media.spec.ts tests-e2e/smoke-v3-clowder-v2-regression.spec.ts tests-e2e/smoke-v3-clowder-thread-lifecycle.spec.ts --reporter=line
```

## Result

```text
7 tests total
6 failed
1 skipped
```

## Failures

| Spec | Result | Primary Finding | Issue |
|---|---|---|---|
| `smoke-v3-clowder-binding.spec.ts` | Fail | IM Web login remained on `/login` | `V3-01` |
| `smoke-v3-clowder-panel.spec.ts` | Fail | `GET /api/connectors/im-web/status` returned 404 from `localhost:3003` | `V3-02` |
| `smoke-v3-clowder-permissions.spec.ts` | Fail | IM Web login remained on `/login` | `V3-01` |
| `smoke-v3-clowder-streaming-media.spec.ts` | Fail | IM Web login remained on `/login` | `V3-01` |
| `smoke-v3-clowder-thread-lifecycle.spec.ts` | Fail | IM Web login remained on `/login` | `V3-01` |
| `smoke-v3-clowder-v2-regression.spec.ts` | Fail | IM Web login remained on `/login` | `V3-01` |
| `smoke-v3-clowder-multi-agent.spec.ts` | Skipped | `TEST_AGENT_B` missing | `V3-03` |

## Service Probes

```text
http://localhost:3003/api/health -> 200
http://localhost:3003/api/commands?surface=connector -> 200
http://localhost:3003/api/cats -> 200
http://localhost:3003/api/connectors/im-web/status -> 404
http://localhost:3003/api/connectors/im-web/agents?externalChatId=2:test -> 404
http://localhost:8090/v1/user/login --noproxy '*' -> connection refused
```

`ss -ltnp` showed only `localhost:3003` among the expected ports; no TangSeng API listener was available on `8090`.

## Evidence Files

- `sections/im_web/apps/chat/test-results/.last-run.json`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-binding-V-b0309-durable-reply-after-refresh-chromium/error-context.md`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-panel-V3--b6fd6-ts-focus-and-delivery-state-chromium/error-context.md`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-permissio-4312c-d-blocks-non-admin-commands-chromium/error-context.md`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-streaming-c2aee-eeps-media-fallback-visible-chromium/error-context.md`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-thread-li-c8b43-th-visible-command-feedback-chromium/error-context.md`
- `sections/im_web/apps/chat/test-results/smoke-v3-clowder-v2-regres-2b65b-al-V2-robot-history-working-chromium/error-context.md`

## Notes

- `http://localhost:9000` was detected by the generic server probe but is MinIO, not IM Web.
- Playwright successfully started the IM Web Vite server at `http://localhost:3000`.
- The Clowder PWA rendered successfully, including navigation, thread list, message composer, and right status panel.
- General Clowder connector commands are present in `/api/commands?surface=connector`, but the `im-web` connector API prefix is not available through the production PWA URL.

