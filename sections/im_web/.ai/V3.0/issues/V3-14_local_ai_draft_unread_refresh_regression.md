# V3-14 Local AI draft and unread refresh regression

## Status

Fixed on 2026-05-30.

## Problem

In local-only AI direct conversations such as `clowder_ai` and `deepseek_ai_robot`, clearing the message input or opening a conversation to clear unread state could be undone after a browser refresh.

Observed symptoms:

- a deleted draft reappeared in the send box after reload;
- stale unread badges reappeared after the conversation had already been opened;
- rows with a local draft could still show a red unread dot from stale sync data.

## Root Cause

Local-only AI conversations did not sync draft updates back to TangSeng, but the conversation store still accepted stale remote `draft` values from `conversation/sync` and `conversation/extra/sync`.

Unread clear state was kept only in memory. After a full browser refresh, stale remote unread values could win again when the backend returned the same conversation with no useful message sequence.

## Fix

- Keep local-only AI drafts scoped to the browser/user and ignore stale remote drafts for those conversations.
- Persist cleared unread checkpoints per user and conversation so refresh can suppress stale unread sync results.
- Drop the persisted cleared marker when a new incoming digest message arrives.
- Align Vitest package aliasing with Vite's runtime TypeScript entrypoints.

## Evidence

- Unit regression:
  - `tests/clowderVirtualConversationDraft.test.ts`
  - `tests/groupOfflineUnreadRetention.test.ts`
- Browser regression:
  - `tests-e2e/smoke-local-ai-draft-unread-refresh.spec.ts`
  - result: `sections/im_web/.ai/V3.0/tests-e2e/local-ai-draft-unread-refresh-20260529163515/result.json`
  - screenshots:
    - `01-stale-unread-before-open.png`
    - `02-cleared-draft-after-reload.png`
    - `03-no-stale-unread-after-refresh.png`
