# Implementation Plan: IM Web V3.0 Clowder Multi-Agent Connector

**Branch**: `001-im-web-v2` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `sections/im_web/.ai/V3.0/spec.md`

## Summary

V3.0 turns IM Web from a single TangSeng AI robot client into a Clowder-connected multi-user, multi-agent chat surface. The planned architecture adds an `im-web` Clowder connector and a backend bridge that maps TangSeng direct/group conversations to Clowder connector thread bindings, forwards messages with sender identity and dedup keys, reuses Clowder command/permission/routing logic, and delivers Clowder agent replies back into WuKongIM as durable IM messages. Browser UI work exposes Clowder status, bindings, agent directory, focus, and permissions while preserving V2.0 message recovery, streaming merge, markdown rendering, and duplicate prevention.

## Technical Context

**Language/Version**: TypeScript + Vue 3 / Vite 5 for IM Web; TypeScript + Node/Fastify for Clowder API connector integration

**Primary Dependencies**: Vue 3, Pinia, Vue Router, Arco Design Vue, `wukongimjssdk`, Axios/fetch, Playwright, Vitest, Clowder `ConnectorRouter`, `ConnectorCommandLayer`, `ConnectorThreadBindingStore`, `ConnectorPermissionStore`, `OutboundDeliveryHook`, `StreamingOutboundHook`

**Storage**: TangSeng/WuKongIM remain authoritative for IM messages, users, groups, unread, and realtime state; Clowder remains authoritative for threads, connector bindings, agent registry, invocation state, and connector permissions; no browser-side database

**Testing**: `vue-tsc`, `pnpm build`, Vitest store/component/contract tests, Playwright IM Web smoke/E2E, Clowder API build and connector tests, bridge contract tests with signed payload fixtures

**Target Platform**: Web browser plus backend bridge service connecting TangSeng/WuKongIM and Clowder API

**Project Type**: Web application plus backend service integration across two local projects

**Performance Goals**: Agent routing should not block normal IM message display; duplicate replay handling should be idempotent; streaming replies should update a single visible message without list reflow; Clowder unavailable state should surface within 5 seconds

**Constraints**: Do not expose Clowder secrets in browser code; keep durable IM state in datasource stores; do not copy Clowder connector internals into IM Web; preserve package boundaries; keep unsupported Clowder/rich-block states visibly unavailable; preserve V2.0 duplicate/history/streaming fixes

**Scale/Scope**: Direct and group conversations, multiple human senders, at least two Clowder agents, command routing, group whitelist/admin permissions, streaming replies, text/markdown plus safe media fallback

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Monorepo boundaries**: Affected seedcmp areas are `sections/im_web/apps/chat`, `packages/datasource-vue`, `packages/base-vue`, and `packages/contacts-vue` for UI/store integration. Clowder changes remain in `/media/leng/DiskB1/exp/clowder-ai/packages/api` and `/packages/shared`; no cross-copy of source code is planned.
- **Minimalist UI**: New Clowder panels, badges, disabled states, agent rows, and streaming indicators must use the existing restrained IM Web styling and stable text containment.
- **SDK/store ownership**: WuKongIM listeners, message normalization, duplicate merge, recovery, and durable local state stay in `packages/datasource-vue`; Vue components consume store state only.
- **Backend alignment**: The plan uses verified Clowder connector capabilities: router, command layer, binding store, permission store, outbound delivery, streaming outbound hook, cat registry, and thread-cats API shape. Missing Clowder config, denied groups, queue-full, and unsupported media/rich blocks get explicit unavailable states.
- **Build evidence**: Required gates are `cd sections/im_web && pnpm type-check`, `cd sections/im_web && pnpm build`, and `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build`.
- **Test evidence**: Required gates include IM Web Vitest store/component tests, Clowder connector tests, bridge contract tests, Playwright direct/group multi-agent smoke, and reconnect/refresh duplicate checks.
- **Code review evidence**: Each V3.0 story is complete only after package boundary review, secret/auth review, connector contract review, UI state review, build/test output review, and smoke evidence review.

## Project Structure

### Documentation (this feature)

```text
sections/im_web/.ai/V3.0/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── im-web-clowder-bridge.md
│   ├── im-web-adapter-interface.md
│   └── ui-state-contract.md
└── tasks.md             # Phase 2 output, not created by this plan step
```

### Source Code (repository root)

```text
sections/im_web/
├── apps/chat/
│   ├── src/components/
│   ├── src/views/
│   ├── tests/
│   └── tests-e2e/
├── packages/base-vue/
│   └── src/
├── packages/datasource-vue/
│   ├── src/api/
│   ├── src/stores/
│   └── src/contentTypes/
├── packages/contacts-vue/
│   └── src/
└── .ai/V3.0/

/media/leng/DiskB1/exp/clowder-ai/packages/
├── shared/src/types/connector.ts
├── api/src/infrastructure/connectors/
│   ├── ConnectorRouter.ts
│   ├── ConnectorCommandLayer.ts
│   ├── ConnectorPermissionStore.ts
│   ├── ConnectorThreadBindingStore.ts
│   ├── OutboundDeliveryHook.ts
│   ├── StreamingOutboundHook.ts
│   └── adapters/
└── api/src/routes/
    ├── connector-webhooks.ts
    ├── thread-cats.ts
    └── messages.ts
```

**Structure Decision**: V3.0 is a two-project integration. IM Web owns browser UI, datasource stores, WuKongIM message normalization, and TangSeng-facing unavailable states. Clowder owns connector definitions, routing, commands, binding/permission stores, agent registry, outbound/streaming hooks, and service-side secret handling. A thin backend bridge contract connects the two systems.

## Build, Test, and Review Plan

**Build Commands**:
- `cd sections/im_web && pnpm type-check`
- `cd sections/im_web && pnpm build`
- `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm build`

**Automated Test Commands**:
- `cd sections/im_web && pnpm test:unit`
- Targeted IM Web Vitest runs for message store dedup/stream merge, Clowder panel UI, permission state, and API contract helpers
- `cd sections/im_web && pnpm test:e2e` for Playwright smoke once the bridge is runnable
- `cd /media/leng/DiskB1/exp/clowder-ai/packages/api && pnpm test:public`
- Targeted Clowder connector tests for `im-web` adapter, inbound normalization, permission store behavior, command routing, outbound delivery, and streaming cleanup

**Smoke/User-Flow Checks**:
- Direct chat: bind to Clowder, mention one agent, receive one reply, refresh and verify history has no duplicates
- Group chat: allow group, send messages from two users, mention two different agents, verify sender attribution and replies
- Permission denial: deny group and verify no invocation, no binding mutation, and visible denial message
- Commands: `/where`, `/threads`, `/use`, `/cats`, `/status`, `/focus`, `/ask`, `/history`, `/allow-group`, `/deny-group`
- Streaming: long reply updates one assistant message and finalizes into one durable message after refresh
- Failure: Clowder unavailable, queue full, media unsupported, and outbound delivery failure produce visible states

**Code Review Checklist**:

- [ ] Package boundaries and dependency direction verified
- [ ] SDK/listener/store ownership verified
- [ ] Backend capability and unavailable-state handling verified
- [ ] UI consistency, responsive behavior, and text containment verified
- [ ] Permissions, destructive confirmations, and recovery states verified
- [ ] Clowder connector contract and signed bridge authentication verified
- [ ] Multi-user sender attribution and multi-agent routing verified
- [ ] Streaming placeholder/final merge behavior verified
- [ ] Build output reviewed
- [ ] Test output reviewed
- [ ] Smoke/user-flow evidence reviewed

## Execution Strategy

### Phase 0: Contract Alignment

1. Add or validate Clowder `im-web` connector definition and adapter contract.
2. Define signed inbound and outbound bridge endpoints.
3. Define TangSeng conversation ID, sender, message ID, and media normalization rules.
4. Confirm deployment configuration and unavailable states.

### Phase 1: Backend Bridge and Connector MVP

1. Implement inbound IM event normalization and forward to Clowder `ConnectorRouter`.
2. Implement `im-web` outbound adapter for text/markdown replies.
3. Implement dedup, group whitelist/admin command enforcement, and queue-full/failure mapping.
4. Add contract and connector tests.

### Phase 2: IM Web Store and UI Integration

1. Add datasource APIs/stores for Clowder status, bindings, agent directory, focus, and permission state.
2. Add conversation panel and message presentation states.
3. Preserve V2.0 message merge, markdown, refresh, and reconnect behavior.
4. Add Vitest and Playwright coverage.

### Phase 3: Multi-Agent, Streaming, and Media Hardening

1. Route mention, `/ask`, `/focus`, preferred cats, and fallback paths across multiple agents.
2. Map Clowder streaming placeholder/chunk/final events to one IM message.
3. Add safe rich-block and media fallback behavior.
4. Complete direct/group/reconnect smoke and review.

## Post-Design Constitution Check

- **Monorepo boundaries**: Pass. V3.0 documents a bridge contract and keeps IM Web and Clowder ownership separate.
- **Minimalist UI**: Pass. UI work is limited to conversation controls, status states, agent rows, and message presentation within the existing IM Web style.
- **SDK/store ownership**: Pass. WuKongIM listeners and message recovery remain in datasource stores.
- **Backend alignment**: Pass with one documented complexity item for cross-project integration.
- **Build evidence**: Pass. Required IM Web and Clowder commands are listed.
- **Test evidence**: Pass. Contract, unit, connector, Playwright, reconnect, and refresh checks are listed.
- **Code review evidence**: Pass. V3.0 adds connector/auth/multi-agent review gates.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Cross-project integration with `/media/leng/DiskB1/exp/clowder-ai` | V3.0 explicitly requires Clowder to fully plug into IM Web and reuse existing connector infrastructure | Rebuilding Clowder connector behavior inside seedcmp would duplicate routing, permission, streaming, and command logic |
