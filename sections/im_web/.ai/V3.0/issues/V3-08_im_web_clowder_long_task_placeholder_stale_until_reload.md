# V3-08: Long Clowder Task Final Message Stays Hidden Until Browser Reload

## Status

Resolved on 2026-05-29.

## Severity

Medium

## Finding

During the browser audit, IM Web rendered the Clowder streaming placeholder and thought transcript, but did not replace it with the final durable message while the page stayed open. Reloading the browser showed the final provider error from TangSeng history.

## Evidence

Browser audit artifact:

- `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529084044/summary.md`

Screenshots:

- Before reload: `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529084044/07-clowder-thinking-visible.png`
- After reload: `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529084044/08-after-reload-final-state.png`

Before reload, visible Clowder text remained:

```text
【布偶猫🐱】🤔 思考中...

思考
等待 Clowder 智能体输出
```

After reload, TangSeng history contained the final 401 error at message seq `125`.

## Impact

For slow Clowder tasks, users can believe the task is still running even after a durable final result or error has already been delivered to TangSeng.

## Expected

- IM Web continues syncing the `clowder_ai` conversation long enough for slow agent tasks.
- A final or cleanup stream state replaces the placeholder without requiring reload.

## Acceptance

- A regression test proves sending to `clowder_ai` schedules follow-up syncs beyond the current short post-send window.
- Browser smoke shows the final Clowder message appears in the open chat when the backend has persisted it.

## Resolution Evidence

- IM Web regression: `pnpm --filter chat test:unit -- clowderAiContactRouting.test.ts` passed 48 files / 132 tests, including the source assertion for `scheduleClowderConversationSync` and the 300000ms follow-up sync.
- IM Web build: `pnpm --filter chat build` passed.
- Browser smoke: `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529094101/08-final-news-reply.png` shows the final news summary in the open chat without requiring a reload.
