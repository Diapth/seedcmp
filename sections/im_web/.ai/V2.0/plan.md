# Implementation Plan: IM Web V2.0 Completion

**Branch**: `001-im-web-v2` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `sections/im_web/.ai/V2.0/spec.md`

## Summary

Finish the remaining V1.0 regressions first, prove the client is clean through build, tests, smoke checks, and review, then begin V2.0 delivery from the approved spec. The V2.0 scope is a user-facing IM web client completion pass over messaging, group management, recovery, account/settings, discovery, and productivity surfaces, with backend-aligned unavailable states where the server does not support a flow.

## Technical Context

**Language/Version**: TypeScript + Vue 3 / Vite 5

**Primary Dependencies**: Vue 3, Pinia, Vue Router, Arco Design Vue, `wukongimjssdk`, Axios, Playwright, Vitest, Testing Library, howler, mitt, pinyin-pro

**Storage**: Browser storage plus backend IM persistence; no new local database layer is planned

**Testing**: `vue-tsc`, `pnpm build`, Vitest unit/component/store/integration tests, Playwright smoke/E2E, manual realtime recovery checks

**Target Platform**: Web browser, with desktop-form-factor readiness for long-running sessions and notifications

**Project Type**: Web application in a monorepo

**Performance Goals**: Preserve responsive message lists and stable conversation ordering during refresh, reconnect, and multi-device sync; no new hard numerical targets beyond the spec

**Constraints**: Respect `sections/im_web` package boundaries, keep durable state in datasource stores, preserve the minimalist UI system, and never expose unsupported backend actions as fake-available controls

**Scale/Scope**: Multi-package web client spanning chat, login, contacts, datasource, and shared base UI packages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Monorepo boundaries**: Affected packages are `apps/chat`, `packages/base-vue`, `packages/datasource-vue`, `packages/login-vue`, and `packages/contacts-vue`; the plan keeps state ownership in stores and avoids cross-package shortcuts.
- **Minimalist UI**: New or revised screens, drawers, modals, rows, and message cells must preserve the restrained design system, stable sizing, and text containment.
- **SDK/store ownership**: Realtime listeners, command handling, conversation/message recovery, and durable session state stay in the datasource store layer.
- **Backend alignment**: The plan only uses backend capabilities that are verified in TangSengDaoDaoServer and WuKongIM, and explicitly defines unavailable or permission-denied states for unsupported flows.
- **Build evidence**: Required gates are `pnpm type-check`, `pnpm build`, and any package-specific build or type-check commands needed for touched workspaces.
- **Test evidence**: Required gates are the relevant Vitest component/store/integration tests, Playwright smoke flows, and manual realtime recovery checks for each story; non-applicable checks must be marked with rationale.
- **Code review evidence**: Each story is only complete after build output, test output, smoke evidence, and a blocking review checklist pass.

## Project Structure

### Documentation (this feature)

```text
sections/im_web/.ai/V2.0/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
sections/im_web/
├── apps/chat/
│   ├── src/
│   ├── tests/
│   └── tests-e2e/
├── packages/base-vue/
│   └── src/
├── packages/datasource-vue/
│   └── src/
├── packages/login-vue/
│   └── src/
├── packages/contacts-vue/
│   └── src/
└── .ai/V2.0/
    └── issues/
```

**Structure Decision**: This is a Vue monorepo web application. Implementation work stays inside `sections/im_web/apps/chat` for UI flows and the `packages/*-vue` packages for shared UI, login, contacts, and durable data-state logic.

## Build, Test, and Review Plan

**Build Commands**:
- `cd sections/im_web && pnpm type-check`
- `cd sections/im_web && pnpm build`
- Run any workspace-specific build or type-check command if a story touches a package that needs additional verification beyond the root scripts

**Automated Test Commands**:
- `cd sections/im_web && pnpm test:unit`
- `cd sections/im_web && pnpm test:unit:coverage` when store/component coverage needs proof
- `cd sections/im_web && pnpm test:e2e` for Playwright smoke coverage
- Targeted Vitest runs inside `apps/chat` or package test files when a story is narrower than the whole suite

**Smoke/User-Flow Checks**:
- Close the remaining V1.0 issues one by one and verify the matching regression check scripts or manual flows pass
- Confirm message send, refresh, reconnect, unread recovery, group settings, and permission flows against the current server
- For V2.0 stories, smoke each independently testable user story from the spec before it is marked complete

**Code Review Checklist**:
- [ ] Package boundaries and dependency direction verified
- [ ] SDK/listener/store ownership verified
- [ ] Backend capability and unavailable-state handling verified
- [ ] UI consistency, responsive behavior, and text containment verified
- [ ] Permissions, destructive confirmations, and recovery states verified
- [ ] Build output reviewed
- [ ] Test output reviewed
- [ ] Smoke/user-flow evidence reviewed
- [ ] No story is closed before review approval

## Execution Strategy

### Phase 0: Close Remaining V1.0 Issues

1. Audit the remaining unresolved V1.0 issue list and confirm the exact residual work.
2. Fix each remaining issue in priority order, starting with regressions that block messaging reliability, conversation ordering, group permissions, or recovery.
3. Run the exact build and tests tied to each fix, then record the smoke evidence in the corresponding issue notes.
4. Resolve every remaining V1.0 issue before touching V2.0 feature work.

### Phase 1: Verify the Client Is Clean

1. Run the root build and type-check gates.
2. Run the relevant unit, store, integration, and Playwright checks for the whole client.
3. Re-run the regression check scripts for the migrated V2.0 issues that overlap the old V1.0 failure modes.
4. Stop only when the known V1.0 backlog is at zero and the verification evidence is current.

### Phase 2: Start V2.0 Delivery From Spec

1. Work V2.0 by user story priority, starting with P1 messaging, group management, and recovery flows.
2. Keep each story independently testable and close it only after build, test, smoke, and review evidence are recorded.
3. Use the V2.0 issue backlog as the regression tracker for any remaining gaps.
4. Defer lower-priority account, discovery, workplace, robot, report, and desktop-readiness work until the P1 core is stable.

## Complexity Tracking

No constitution violations are expected for the planned scope.
