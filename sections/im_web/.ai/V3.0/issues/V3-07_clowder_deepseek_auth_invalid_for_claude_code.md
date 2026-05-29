# V3-07: DeepSeek-backed Claude Code Invocation Fails With Invalid Authentication

## Status

Resolved on 2026-05-29.

## Severity

High

## Finding

The complex task acceptance flow reaches Clowder invocation with the Claude Code CLI and DeepSeek Anthropic-compatible base URL, but the final assistant response is a provider authentication failure instead of a news summary.

## Evidence

Browser audit artifact:

- `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529084044/summary.md`

Final synced TangSeng message:

```text
Failed to authenticate. API Error: 401 {"error":{"message":"Authentication Fails, Your api key: ****opic is invalid","type":"authentication_error","param":null,"code":"invalid_request_error"}}
```

Relevant Clowder invocation logs:

- `baseUrl":"https://api.deepseek.com/anthropic"`
- `resolved":"/home/leng/.npm-global/bin/claude"`
- `finalContentLen":192`

Relevant screenshot:

- `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529084044/08-after-reload-final-state.png`

## Impact

The original acceptance task, `整理一下今天的新闻`, cannot complete through the IM Web Clowder surface because the runtime provider call fails before any browsing or summarization result can be returned.

## Expected

- The `deepseek` account used by runtime cats passes a valid API key into Claude Code's Anthropic-compatible execution path.
- A news prompt can complete with a normal assistant answer.
- The UI must not hide provider failures behind an infinite thinking placeholder.

## Acceptance

- Environment/profile diagnostics identify which account/key source is used without exposing the secret.
- A focused invocation or browser smoke completes a DeepSeek-backed Claude Code request, or the issue is explicitly marked blocked by missing/invalid local credentials.
- Browser smoke for `整理一下今天的新闻` produces a real summary rather than a 401 provider error.

## Resolution Evidence

- Clowder regression: `test/account-resolver-deepseek-env.test.js` passed and proves `DEEPSEEK_API_KEY` overrides stale stored `deepseek` credentials.
- Browser smoke: `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529094101/result.json` has `finalTextLength: 1981` and a normal Chinese news summary instead of a 401 authentication error.
- Runtime log: `Claude CLI invocation completed` for `catId:"f2b2"` with `textEvents:1533`; final outbound check recorded `finalContentLen:2885`.
