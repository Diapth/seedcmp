# V3-06: `/cats new` Created Cat Is Not Immediately Visible Or Routable

## Status

Resolved on 2026-05-29.

## Severity

High

## Finding

In the live IM Web + TangSeng + Clowder browser flow, `/cats new` reports success, but the newly created runtime cat is not included in the immediately following `/cats` roster and a direct mention to its alias routes to the default cat instead.

## Evidence

Browser audit artifact:

- `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529084044/summary.md`

Observed chat sequence:

1. `/new manual-clowder-news-20260529084044` created thread `thread_mpqo9k7u2vjdffmj`.
2. `/cats new 新闻猫9izf @newsqo9izf` returned:
   - `ID: cat-qo9kez`
   - `别名：@newsqo9izf`
3. `/cats` only listed:
   - `布偶猫`
   - `Codex`
4. `@newsqo9izf 整理一下今天的新闻...` routed to `ragdoll-kn9a`, not `cat-qo9kez`.

Relevant screenshots:

- `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529084044/06-user-news-prompt-visible.png`
- `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529084044/07-clowder-thinking-visible.png`

Relevant logs:

- `Cat catalog changed, reconciling registry...`
- `catId":"ragdoll-kn9a"` for the news invocation in `thread_mpqo9k7u2vjdffmj`

## Impact

User-created Clowder cats cannot be reliably used from the IM Web chat immediately after creation. The command response tells the user to use the new alias, but the next message is handled by another cat.

## Expected

- `/cats new <name> @alias` registers the runtime cat into the live Clowder cat registry before the command completes.
- The next `/cats` output includes the created cat.
- The next message mentioning the created alias routes to that cat.

## Acceptance

- A regression test proves `/cats new` updates the live roster used by `/cats`.
- A regression test or browser smoke proves a freshly created alias is parsed into the newly created cat id.
- Browser smoke with `/cats new 新闻猫 @新闻猫` followed by `@新闻猫 ...` invokes the new cat rather than the default cat.

## Resolution Evidence

- Clowder regression: `pnpm build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import $(pwd)/test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/streaming-outbound-hook.test.js test/account-resolver-deepseek-env.test.js test/connector-command-layer-cats-new.test.js` passed 27 tests.
- Browser smoke: `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529094101/result.json` shows `/cats new 新闻猫f2b2 @newsqqf2b2`, `/cats` listing `新闻猫f2b2`, and the final reply signed `[新闻猫f2b2/deepseek-v4-flash🐾]`.
