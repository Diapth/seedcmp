# Evidence: IM Web V3.0 Clowder Multi-Agent Connector

## Baseline

Baseline command inventory captured during Phase 1 setup. Execution remains pending until implementation dependencies for each slice are ready.

| Command | Status | Notes |
|---------|--------|-------|
| `cd sections/im_web && pnpm type-check` | Pass | Phase 2 type foundation verification passed after Clowder DTO/store type additions |
| `cd sections/im_web && pnpm build` | Pending | Required before implementation completion |
| `cd sections/im_web && pnpm test:unit` | Pending | Required before implementation completion |
| `cd sections/im_web && pnpm test:e2e` | Pending | Run once bridge and services are available |
| `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build` | Pass | Phase 2 connector scaffold verification passed after `im-web` adapter/route registration |
| `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm test:public` | Pending | Supplement with targeted connector tests |
| `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder ./modules/common` | Pending | Becomes runnable after bridge package exists |

## Fixture Inventory

- IM Web reusable fixture map: `sections/im_web/apps/chat/tests/setup.ts`
- Clowder connector helper: `/media/leng/DiskB1/exp/clowder-ai/packages/api/test/im-web-connector-test-helpers.js`
- TangSeng Docker ignore verified: `sections/im/TangSengDaoDaoServer/.dockerignore`

## Phase 2 Foundation Checks

- TangSeng HMAC helper RED: `cd sections/im/TangSengDaoDaoServer && go test ./modules/common -run 'Test(Sign|Verify|DefaultClowder)'` failed before implementation with missing helper symbols.
- TangSeng HMAC helper GREEN: `cd sections/im/TangSengDaoDaoServer && go test ./modules/common -run 'Test(Sign|Verify|DefaultClowder)'` passed.
- IM Web type foundation: `cd sections/im_web && pnpm type-check` passed.
- Clowder connector scaffold: `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build` passed.

## Story Evidence

### US1 - Route IM Conversations Into Clowder Threads

- Contract tests: Pending
- IM Web tests: Pending
- TangSeng tests: Pending
- Clowder tests: Pending
- Smoke: Pending
- Review: Pending

### US2 - Manage Multi-User Group Access and Permissions

- Permission tests: Pending
- IM Web tests: Pending
- TangSeng tests: Pending
- Clowder tests: Pending
- Smoke: Pending
- Review: Pending

### US3 - Connect Multiple Clowder Agents From One IM Conversation

- Multi-agent routing tests: Pending
- IM Web tests: Pending
- Clowder tests: Pending
- Smoke: Pending
- Review: Pending

### US4 - Provide IM-Side Thread and Agent Controls

- Component/store tests: Pending
- Health/status tests: Pending
- Smoke: Pending
- Review: Pending

### US5 - Preserve Streaming, Media, and History Behavior

- Streaming tests: Pending
- Media fallback tests: Pending
- V2 regression tests: Pending
- Smoke: Pending
- Review: Pending

## Final Verification

- IM Web type-check: Pending
- IM Web build: Pending
- IM Web unit tests: Pending
- IM Web E2E smoke: Pending
- Clowder API build: Pending
- Clowder connector tests: Pending
- TangSeng bridge tests: Pending
