# V3-03 Acceptance environment missing second agent and required smoke data

## Status

Open

## Reported At

2026-05-28 CST

## Labels

testing, data, e2e, multi-agent

## Priority

P2

## User Request

Validate V3.0 multi-user multi-agent behavior through browser automation.

## Problem

The V3 acceptance environment does not currently expose enough test data to run the full multi-agent and multi-user acceptance matrix.

Observed Clowder cats:

```bash
curl -i http://localhost:3003/api/cats
```

Result contains one cat:

```json
{
  "id": "ragdoll-kn9a",
  "name": "布偶猫",
  "displayName": "布偶猫",
  "mentionPatterns": ["@宪宪", "@布偶猫"]
}
```

The multi-agent Playwright smoke was skipped because `TEST_AGENT_B` was not provided. The full direct/group and permission flows also need explicit test conversations and optional second-account credentials to avoid mutating arbitrary persistent Redis/IM state.

## Expected Behavior

The V3 acceptance environment should provide:

- at least two configured Clowder agents/cats,
- one direct IM test conversation,
- one group IM test conversation with Clowder allowed,
- optionally one denied group or permission mutation flag,
- two IM test accounts for multi-user group verification,
- stable aliases through environment variables.

## Required Environment Variables

```bash
RUN_V3_CLOWDER_SMOKE=1
CLOWDER_URL=http://localhost:3003
TEST_AGENT_A=<first-agent-alias-or-cat-id>
TEST_AGENT_B=<second-agent-alias-or-cat-id>
TEST_DIRECT_CONVERSATION=<direct-chat-name-or-id>
TEST_GROUP_CONVERSATION=<group-chat-name-or-id>
TEST_V2_CONVERSATION=<non-clowder-chat-name-or-id>
TEST_B_USERNAME=<second-user-login>
TEST_B_PASSWORD=<second-user-password>
```

Optional:

```bash
TEST_DENIED_GROUP_CONVERSATION=<denied-group-name-or-id>
V3_CLOWDER_MUTATE_PERMISSIONS=1
TEST_V2_ROBOT_CONVERSATION=<v2-robot-chat-name-or-id>
TEST_UNSUPPORTED_MEDIA_MESSAGE=<fixture-trigger-text>
CLOWDER_TEST_USER=<x-cat-cafe-user-value>
CLOWDER_CONNECTOR_SECRET=<shared-test-secret>
```

## Test Discovery

| Test Type | Command / Operation | Result |
|---|---|---|
| Cats API | `curl -i http://localhost:3003/api/cats` | Pass: API reachable, but only one cat returned |
| Multi-agent smoke | `smoke-v3-clowder-multi-agent.spec.ts` | Skipped: `TEST_AGENT_B` missing |
| Group multi-user smoke | `smoke-v3-clowder-binding.spec.ts` | Second-account branch skipped unless `TEST_B_USERNAME` and `TEST_B_PASSWORD` are set |

## Impact

Without the second agent and named smoke data, SC-003 cannot be fully validated:

- two-agent mention routing,
- `/ask <agentB>`,
- near-concurrent multi-agent replies,
- preferred/last-active fallback across two agents.

Without second IM account credentials, sender attribution and multi-user group delivery cannot be fully validated through the browser.

## Proposed Fix

- Seed or configure a second Clowder cat in the production-mode Redis-backed environment.
- Publish the test aliases and IM conversation names through the environment variables above.
- Keep test data namespaced and non-destructive, following `browser-integration-test-plan.md`.

## Acceptance Criteria

- [ ] `GET /api/cats` returns at least two available cats with mention patterns.
- [ ] `TEST_AGENT_A` and `TEST_AGENT_B` are set and routable.
- [ ] Direct, group, V2, and optional denied-group conversations are provided.
- [ ] Second-user credentials are provided for multi-account Playwright contexts.
- [ ] `smoke-v3-clowder-multi-agent.spec.ts` runs rather than skipping for missing `TEST_AGENT_B`.

