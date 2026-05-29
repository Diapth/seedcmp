# V3 Clowder Direct Complex Browser Smoke

- Time: 2026-05-29 10:32 Asia/Shanghai
- Target: http://100.79.157.76:3000/
- Clowder API: http://127.0.0.1:3004
- Account: 008618337488675
- MySQL check: README business account `tsdd_user` / `tsdd_password` against database `im`
- External chat: `1:clowder_ai`
- Marker: `IMWEB-CLOWDER-DIRECT-1780021962378`

## Result

- `/new` direct inbound returned 200 and became visible in IM Web.
- `/cats new Codex @codex` direct inbound returned 200; Clowder reported the alias already exists, confirming `codex` is now present in the runtime catalog.
- `/ask codex ...` direct inbound returned 200 with `threadId=thread_mpqb4ekog3v6wbvx`.
- Clowder API dispatched the task to codex and created a CLI invocation.
- The complex task did not complete. The Clowder thread export shows the codex agent failed authentication:

```text
Failed to authenticate. API Error: 401 {"error":{"message":"Authentication Fails, Your api key: ****opic is invalid","type":"authentication_error","param":null,"code":"invalid_request_error"}}
[anthropic/deepseek-v4-flash]
Error: Claude CLI: CLI 异常退出 (code: 1, signal: none)
```

## Browser Evidence

- `sections/im_web/.ai/V3.0/issues/imgs/v3-clowder-direct-complex-1780021962378/01-clowder-open.png`
- `sections/im_web/.ai/V3.0/issues/imgs/v3-clowder-direct-complex-1780021962378/02-after-direct-new.png`
- `sections/im_web/.ai/V3.0/issues/imgs/v3-clowder-direct-complex-1780021962378/03-after-create-codex.png`
- `sections/im_web/.ai/V3.0/issues/imgs/v3-clowder-direct-complex-1780021962378/04-after-direct-ask.png`
- `sections/im_web/.ai/V3.0/issues/imgs/v3-clowder-direct-complex-1780021962378/05-reply-check.png`

## Notes

- Console errors: 0.
- Network errors captured by the browser smoke: 0.
- IM Web remained on the streaming placeholder because the downstream agent invocation failed before producing the requested structured answer.
- Browser-originated messages still require WuKongIM webhook delivery into TangSeng. Current `sections/im/WuKongIM/wukongim.conf` does not configure the README-listed gRPC webhook target `127.0.0.1:6979`.
