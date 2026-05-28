# Quickstart: IM Web V3.0 Clowder Multi-Agent Connector

## Prerequisites

- IM Web dependencies installed under `sections/im_web`
- TangSengDaoDaoServer and WuKongIM running for normal IM message delivery
- Clowder API runnable from `/media/leng/DiskB1/exp/clowder-ai/packages/api`
- At least two Clowder cats configured with mention patterns
- V3.0 bridge feature flag disabled by default until configuration is present

## Configuration Draft

Set these values in the backend environment that owns the bridge:

```bash
CLOWDER_API_BASE_URL=http://127.0.0.1:3000
CLOWDER_CONNECTOR_ID=im-web
CLOWDER_CONNECTOR_SECRET=<shared-secret>
CLOWDER_DEFAULT_OWNER_USER_ID=<clowder-user-id>
IM_WEB_CLOWDER_ENABLED=true
```

## Local Analysis Commands

```bash
cd /media/leng/DiskB1/exp/seedcmp/sections/im_web
pnpm type-check
pnpm build
pnpm test:unit
```

```bash
cd /media/leng/DiskB1/exp/clowder-ai/packages/api
pnpm build
pnpm test:public
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

## Required Evidence Before Implementation Is Complete

- IM Web `pnpm type-check` pass
- IM Web `pnpm build` pass
- Relevant Vitest tests for message store merge/dedup, Clowder panel, command state, and permission UI pass
- Clowder API build and connector-focused tests pass
- Contract tests for `im-web` inbound and outbound payloads pass
- Playwright smoke screenshots for direct chat, group chat, multi-agent mentions, streaming reply, permission denied, and refresh history
