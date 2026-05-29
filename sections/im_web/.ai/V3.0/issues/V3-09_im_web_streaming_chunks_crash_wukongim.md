# V3-09: IM Web Streaming Chunk Writes Can Crash WuKongIM Before Final Reply

## Status

Resolved on 2026-05-29.

## Severity

High

## Finding

The live browser acceptance flow proved that DeepSeek-backed Claude Code can complete the news task through the newly created cat, but the IM Web outbound path wrote many Clowder token-stream `chunk` messages into the TangSeng/WuKongIM durable chat. Under that burst, WuKongIM crashed before the final answer could be delivered to IM Web.

## Evidence

Browser audit artifact:

- `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529093625/`

The browser flow reached the task prompt and rendered the Clowder thinking placeholder:

- `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529093625/06-user-news-prompt-visible.png`
- `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529093625/07-clowder-thinking-visible.png`

Clowder logs show the invocation completed with DeepSeek/Claude Code and the freshly created cat:

```text
catId:"cat-qq95qd"
textEvents:1228
finalContentLen:2123
Claude CLI invocation completed
```

Immediately before failure, the adapter repeatedly logged:

```text
streamState:"chunk"
[ImWebAdapter] outbound delivery sent
```

WuKongIM then crashed:

```text
panic: runtime error: invalid memory address or nil pointer dereference
github.com/WuKongIM/WuKongIM/pkg/channel/replica.(*replica).emitAppendBatchLocked
sections/im/WuKongIM/pkg/channel/replica/append_pipeline.go:131
```

After the crash, final delivery failed:

```text
IM Web outbound callback failed: 502 Bad Gateway
Post "http://127.0.0.1:5001/message/send": dial tcp 127.0.0.1:5001: connect: connection refused
```

## Impact

Long Clowder tasks can generate enough IM Web chunk writes to crash the local message service. Users see the placeholder and partial transcript but never receive the final durable answer, even though the agent completed the task.

## Expected

- IM Web receives a lightweight placeholder and the final durable Clowder reply.
- Token-stream chunks are not persisted as separate TangSeng/WuKongIM messages.
- Chunk write failures are rate-limited for platforms that do support edit-in-place streaming.

## Acceptance

- A Clowder regression test proves `StreamingOutboundHook.onStreamChunk()` skips `im-web` bindings.
- Existing streamable connector behavior still rate-limits repeated `editMessage` failures.
- Browser smoke for `整理一下今天的新闻` no longer crashes WuKongIM and can receive the final answer in the open IM Web chat.

## Resolution Evidence

- Clowder regression: `test/streaming-outbound-hook.test.js` passed with both `onStreamChunk does not write token-stream edits into IM Web durable chat` and `onStreamChunk rate limits retry storms after editMessage failures`.
- Browser smoke: `sections/im_web/.ai/V3.0/tests-e2e/manual-clowder-news-20260529094101/result.json` completed with `08-final-news-reply.png` and `finalTextLength: 1981`.
- Runtime log check: the `09:41` run contains `Claude CLI invocation completed` and `finalContentLen:2885`, with no `streamState:"chunk"` IM Web deliveries.
- Process/log check after the smoke: WuKongIM remains running on `:5001`, and the latest `/tmp/wukongim-v3.log` tail contains no `panic`.
