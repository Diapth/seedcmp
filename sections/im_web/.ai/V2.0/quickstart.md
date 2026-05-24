# Quickstart: IM Web V2.0 Completion

## Prerequisites
- Node and pnpm installed
- Backend services for TangSengDaoDaoServer and WuKongIM available for the scenarios you want to verify

## Common commands
```bash
cd sections/im_web
pnpm type-check
pnpm build
pnpm test:unit
pnpm test:e2e
```

`pnpm test:unit` runs the chat Vitest suite in a single-thread worker pool because the default pool has shown Node/V8 native crashes in this workspace without test assertion failures.

## Targeted smoke commands
```bash
cd sections/im_web/apps/chat
pnpm exec playwright test tests-e2e/smoke-uc1-daily-messaging.spec.ts --project=chromium
pnpm exec playwright test tests-e2e/smoke-uc2-group-management.spec.ts --project=chromium
pnpm exec playwright test tests-e2e/smoke-uc4-recovery.spec.ts --project=chromium
pnpm exec playwright test tests-e2e/smoke-uc6-account-settings.spec.ts --project=chromium
pnpm exec playwright test tests-e2e/smoke-uc7-discovery-productivity.spec.ts --project=chromium
pnpm exec playwright test tests-e2e/smoke-uc8-large-history.spec.ts --project=chromium
```

## Recommended workflow
1. Finish the remaining V1.0 issue list first.
2. Run the build gate and the matching regression checks after each fix.
3. When the V1.0 backlog is clear, start V2.0 by user story priority.
4. For every V2.0 story, record build evidence, test evidence, smoke evidence, and review approval before marking it done.

## Smoke checks to keep repeating
- Send a message, refresh, and confirm state is stable.
- Reconnect after a disconnect and confirm pending work is recovered.
- Open group settings and confirm permissions, avatar, and announcement controls match the current user role.
- Run the relevant Playwright flow for the story being closed.

## Environment notes
- Default smoke credentials use `TEST_USERNAME` / `TEST_PASSWORD`, falling back to the local test account values embedded in the smoke specs.
- Full realtime recovery and multi-device checks need TangSengDaoDaoServer, WuKongIM, and at least two active accounts/devices.
- QR login confirmation needs a paired mobile/client flow. The web smoke verifies QR surfaces and terminal state handling.
- Robot command and report submission surfaces are backend-aligned, but local smoke accepts explicit unavailable/failure states when those endpoints are not enabled.
- The production build still emits the known large chunk warning; it is non-blocking for V2.0 closure and remains a performance optimization follow-up.
