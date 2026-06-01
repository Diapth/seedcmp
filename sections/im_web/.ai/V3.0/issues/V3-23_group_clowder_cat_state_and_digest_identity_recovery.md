# V3-23 Group Clowder Cat State And Digest Identity Recovery

## Status

Resolved on 2026-06-01

## Problem

During manual testing on `http://100.79.157.76:3000` with account `18337488675`, the `集群` group showed only two human members in the group settings drawer and `猫猫 0`, even though recent group history contained messages sent by `布偶猫`.

The same group also showed `yunyi： 图片` in the outer conversation list for a Clowder-generated image, because the durable image rows used the human transport `from_uid` and did not carry `cat_display_name`.

## Root Cause

- TangSeng `clowder/group/cats` state is in-memory. After restarting TangSengDaoDao, the group cat membership state for `集群` was empty.
- The fallback `clowder/conversation/agents` request returned `403`, so the UI had no durable group-cat source.
- Recent durable Clowder text messages did include cat identity (`cat_display_name` or `[布偶猫/...]`), but the group settings store did not infer group cats from message history.
- Latest Clowder media messages only carried `connector_id: im-web` / `ai: true` and no cat name. Conversation and message hydration paths then summarized them using the human `from_uid` (`yunyi`).
- `ConversationList` skipped startup sync when any conversation already existed, so a pre-populated sidebar could miss the group-history recovery path.

## Fix

- Added group-cat recovery in `clowderStore.loadGroupCats()`:
  - if backend group cat state and agent directory are empty/unavailable, inspect recent group history;
  - infer Clowder cat display names from `cat_display_name`, `catDisplayName`, `【猫名】`, and `[猫名/...]`;
  - match inferred names against the Clowder cat directory;
  - repopulate local `groupCatMemberships` and best-effort sync the recovered cats back to TangSeng.
- Added Clowder cat-name propagation in `conversationStore`:
  - group history prefetch now backfills missing cat identity on latest media rows;
  - normal conversation sync now also repairs Clowder group digests that lack cat identity;
  - later syncs preserve an already recovered cat name instead of overwriting it with a bare media payload.
- Updated `messageStore` so group message hydration can recover a Clowder cat name from earlier group messages before summarizing a latest media row.
- Updated `ConversationList`:
  - always refreshes conversation sync on mount, even when the sidebar already has direct conversations;
  - digest sender resolution now prefers Clowder cat metadata before `from_uid` user-cache fallback.

## Files

- `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`
- `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts`
- `sections/im_web/apps/chat/src/views/ConversationList.vue`
- `sections/im_web/apps/chat/tests/clowderGroupIdentityRecovery.test.ts`

## Verification

- `pnpm --filter chat exec vitest run tests/clowderGroupIdentityRecovery.test.ts tests/clowderAgentDirectory.test.ts tests/clowderGroupMemberList.test.ts tests/conversationPresentation.test.ts tests/clowderMessageStore.test.ts --pool=threads --poolOptions.threads.singleThread=true` -> 5 files / 29 tests passed
- `pnpm type-check` -> passed
- `pnpm build` -> passed; existing Vite CJS deprecation and large chunk warnings only
- `/media/leng/DiskB1/exp/clowder-ai/packages/api`: `pnpm build` -> passed
- Playwright real-account smoke:
  - command: `TARGET_URL=http://100.79.157.76:3000 TEST_USERNAME=18337488675 TEST_PASSWORD=123456 node /home/leng/.codex/skills/playwright-skill/run.js /tmp/playwright-v3-23-group-cat-recovery.js`
  - result: passed
  - evidence: `sections/im_web/.ai/V3.0/tests-e2e/v3-23-group-cat-recovery-20260530171118/`
  - observed digest: `布偶猫： 图片`
  - failed request count: `0`
  - console error count: `0`

## 2026-06-01 Reverification And Regression Fix

During the V3 issue sweep, the V3-23 regression suite caught a new interaction with the V3-24 fallback work:

- `loadGroupCats()` fell back to the global `clowder/cats` directory when `clowder/conversation/agents` returned `403`.
- The global cat directory was then merged as if every cat belonged to the current group.
- Because the group appeared non-empty, message-history inference did not run and recovered group cats were not persisted back through `clowder/group/cats/sync`.

Fix:

- Updated `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts` to keep conversation-specific directory cats separate from the global cat directory.
- The global directory can still seed lookup data for history-name matching, but it no longer becomes group membership by itself.
- When backend group state and conversation-specific directory data are empty/unavailable, `loadGroupCats()` again infers cats from recent Clowder history and persists the recovered membership.

Verification:

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/clowderGroupIdentityRecovery.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

Result: 1 file / 8 tests passed.

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/notificationUnread.test.ts tests/sdkRecovery.test.ts tests/clowderGroupIdentityRecovery.test.ts tests/clowderAgentDirectory.test.ts tests/clowderGroupMemberList.test.ts tests/conversationPresentation.test.ts tests/clowderMessageStore.test.ts --config vitest.config.ts --pool=threads --poolOptions.threads.singleThread=true
```

Result: 7 files / 33 tests passed.

```bash
cd sections/im_web
pnpm type-check
pnpm build
```

Result: type-check passed; build passed with the existing Vite CJS deprecation and chunk-size warnings.
