# V3-21: Clowder Cat Sender Name False Slash Inference

## Status

Fixed and verified.

## Created

2026-05-31

## Labels

bug, clowder, cat-groups, identity, sender-label

## Priority

P0

## User Report

In the `集群` group chat, several Clowder messages showed confusing sender ids such as `data`, `是给餐厅`, and `@ragdoll-kn9a（布偶猫`. One of the rows should have been `Codex`, but the displayed id was not the Codex cat.

The user also asked whether cats assigned by `布偶猫` should be labeled with an annotation such as `（布偶猫分配）`.

## Impact

- Users cannot tell which cat actually produced a message.
- Normal text fragments can appear as fake cat ids.
- Codex replies can be mislabeled as a referenced `@ragdoll...` mention from the body text.
- Multi-cat group context becomes unreliable even when the backend message history is correct.

## Root Cause

The frontend inferred missing Clowder cat names from any slash-style text inside a message body:

```text
是给餐厅/食堂用的真实点餐系统？
@ragdoll-kn9a（布偶猫/宪宪）做一个桌面 Web 点餐 demo
```

That broad inline slash regex existed in:

- `MessageList.vue` for outer sender labels and avatars.
- `TextCell.vue` for the inner Clowder bubble label.
- `conversationStore.ts` for derived conversation titles.

Because suffix signatures such as `[Codex/deepseek-v4-flash🐾]` were checked after the broad inline match, the UI preferred incidental body text over the actual final reply signature.

No payload evidence showed that `data` or `是给餐厅` were delegated cats assigned by `布偶猫`; they were false frontend inference artifacts. A future `（布偶猫分配）` annotation should be driven by explicit backend metadata, not guessed from free text.

## Fix

Updated sender-name extraction in:

- `sections/im_web/apps/chat/src/components/MessageList.vue`
- `sections/im_web/packages/base-vue/src/components/messages/TextCell.vue`
- `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`

The extraction now accepts only:

1. A Clowder prefix at the start, for example `【布偶猫🐱】`.
2. A leading slash signature at the very start, for example `布偶猫/宪宪已收到...`.
3. A final reply suffix at the end, for example `[Codex/deepseek-v4-flash🐾]`.

It no longer treats slash text in the middle of normal prose, mentions, or paths as a cat sender name.

## Regression Coverage

Updated `sections/im_web/apps/chat/tests/clowderMessagePresentation.test.ts`:

- `prefers final reply signatures over incidental slash text for group cat sender labels`
- `prefers final reply signatures over incidental slash text for Clowder bubble labels`

Updated `sections/im_web/apps/chat/tests/clowderMessageStore.test.ts`:

- `does not derive direct-cat titles from incidental slash text before final signatures`

The tests first failed with:

- `是给餐厅`
- `@ragdoll-kn9a（布偶猫`

Then passed after the extraction fix.

## Browser Evidence

Headless Playwright audit:

```bash
IM_WEB_URL=http://127.0.0.1:5174 IM_WEB_AUDIT_DIR=sections/im_web/.ai/V3.0/tests-e2e/v3-21-cat-identity-20260531001138 HEADLESS=true node /home/leng/.codex/skills/playwright-skill/run.js /tmp/im-web-v3-21-cat-identity-audit.js
```

Result for account `18337488675` in `集群`:

- Restaurant question row label: `布偶猫`
- Codex thread row label: `Codex`
- Default plan row label: `布偶猫`
- Suspect labels (`data`, `是给餐厅`, `@ragdoll...`): none
- Console errors: `0`
- Page errors: `0`
- Failed requests: `0`

Evidence files:

- `sections/im_web/.ai/V3.0/tests-e2e/v3-21-cat-identity-20260531001138/summary.md`
- `sections/im_web/.ai/V3.0/tests-e2e/v3-21-cat-identity-20260531001138/result.json`
- `sections/im_web/.ai/V3.0/tests-e2e/v3-21-cat-identity-20260531001138/group-cat-identity.png`

## Verification

Focused red/green:

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/clowderMessagePresentation.test.ts tests/clowderMessageStore.test.ts --config vitest.config.ts
```

Result: PASS, 2 files / 31 tests.

Related regression coverage:

```bash
cd sections/im_web/apps/chat
pnpm exec vitest run tests/clowderMessagePresentation.test.ts tests/clowderMessageStore.test.ts tests/clowderStreamingMerge.test.ts tests/clowderAiContactRouting.test.ts tests/messageStoreDailyMessaging.test.ts --config vitest.config.ts
```

Result: PASS, 5 files / 47 tests.

Required gates:

```bash
cd sections/im_web
pnpm type-check
pnpm test:unit
pnpm build
```

Results:

- `pnpm type-check`: PASS.
- `pnpm test:unit`: PASS, 57 files / 198 tests. Existing negative-path stderr from recovery/draft tests was expected; exit code was 0.
- `pnpm build`: PASS. Vite emitted the existing large chunk warning.

## Close Notes

Resolved. The visible cat sender labels now come from explicit metadata, start-of-message signatures, or final reply signatures, not incidental slash text inside the message body.
