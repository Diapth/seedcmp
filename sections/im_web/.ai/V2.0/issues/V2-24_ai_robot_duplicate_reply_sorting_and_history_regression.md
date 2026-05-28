# V2-24 AI 机器人重复回复、排序抖动与历史消息异常

## Status

Resolved

## Reported At

2026-05-26 11:04 CST

## Reporter Notes

用户反馈当前 AI 机器人会话仍有异常：

1. AI 生成时会先把用户消息“屏蔽/挤掉”。
2. 先出现一条未按 Markdown 整理格式显示的 AI 消息。
3. 随后用户消息又出现，并且又出现一条带 Markdown 整理格式的 AI 消息。
4. 旧消息记录仍存在丢失或显示不完整的问题。

截图显示同一 AI 回复存在两份显示：一份像流式/纯文本气泡，另一份像后端持久化后的 Markdown 气泡；用户消息和历史消息的顺序也发生跳动。

## Expected Behavior

- 用户发送的消息不应在 AI 生成期间消失、被遮挡或被排序到错误位置。
- 每次 AI 回复只显示一条消息。
- 流式生成中的 AI 回复也应按 Markdown 渲染。
- SSE 完成后本地流式消息应与后端持久化消息合并，而不是新增第二条。
- 刷新后历史消息完整保留，且不重复。

## Suspected Cause

- 前端先创建 `ai-stream-*` 本地消息，后端持久化消息通过 realtime 或 `message/channel/sync` 再回来一条。
- 本地消息使用临时 `messageID=ai-stream-*`，后端消息有正式 `message_id`；在收到正式 `message_id` 前，去重无法判断二者是同一条。
- 流式消息初始 `messageSeq=0`，排序规则把 pending 消息放在 confirmed 消息后，用户消息 ACK、AI realtime、sync 回包到达顺序不同，会造成消息列表跳动。
- 如果同步起点只按当前最后一条消息的 seq 计算，pending/临时消息可能干扰历史拉取范围。

## Acceptance Criteria

- [x] 发送给 `DeepSeek AI` 后，用户消息始终可见且顺序稳定。
- [x] AI 回复流式过程中只有一条 AI 气泡。
- [x] AI 回复流式过程中和完成后均按 Markdown 渲染。
- [x] 后端持久化消息返回后与本地 `ai-stream-*` 消息合并，不重复。
- [x] 刷新后历史消息完整，用户消息和 AI 回复都存在且不重复。
- [x] 浏览器可视化测试覆盖新消息、重复检查、刷新保留和 console/network clean。

## Verification Plan

- Vitest:
  - 覆盖本地 `ai-stream-*` 消息与后端相同 `message_id` 的 sync/realtime 消息合并。
  - 覆盖 `syncMessages` 拉取起点忽略 `messageSeq=0` 的 pending 消息。
- Browser audit:
  - 打开 `DeepSeek AI`。
  - 发送唯一 prompt。
  - 等待流式回复完成。
  - 验证唯一 prompt 和唯一 AI 回复各出现一次或符合一次用户气泡+一次 AI 气泡。
  - 刷新后再次验证不重复、不丢失。

## Root Cause

- 浏览器运行时曾加载同名旧 `packages/*/src/*.js` 文件，而 Vitest 覆盖的是 `.ts` 源码，导致测试通过但页面仍执行旧 `messageStore.js` 去重逻辑。
- DeepSeek SSE 完成事件在当前后端上会返回 `persisted: true` 但 `message_id=0`、`message_seq=0`；同时后端持久化机器人消息通过 realtime 写入列表，且该消息 `clientMsgNo` 为空。前端仅靠 `messageID/clientMsgNo` 无法把本地 `ai-stream-*` 气泡与持久化气泡合并。
- 私聊频道里机器人回复的 `messageSeq` 可能低于本地 prompt 的 confirmed seq，原先“低 seq 不合并”的历史保护会误挡当前 AI 回复。
- 重新打开定位后确认，后端 `message/channel/sync` 返回的 DeepSeek 历史 AI 回复多数 `client_msg_no` 为空；前端 `syncMessages` 和 `addMessage` 曾把空字符串当成唯一合并 key，导致所有空 `client_msg_no` 的机器人历史回复互相覆盖，只剩最后一条。
- 用户再次截图确认，DeepSeek 私聊中后端可能给 AI 回复分配比触发用户消息更低的 `messageSeq`；前端全局按 seq 排序时，AI 回复会被排到用户 prompt 前面，视觉上像“DeepSeek 先回答”。这类 AI 私聊应按实际时间线显示，时间相同时用户消息优先于 AI 回复。

## Fix Record

- `apps/chat/vite.config.ts`
  - 将工作区包别名从目录别名改为精确 `index.ts` + 子路径别名，确保浏览器运行时加载 TypeScript 源而不是旁边 stale `.js`。
- `packages/datasource-vue/src/stores/messageStore.ts`
  - 统一 `messageID/clientMsgNo/fromUID` 字符串化，修复 SDK numeric `messageID` 与 SSE string `message_id` 无法匹配的问题。
  - `syncMessages` 起点改为当前最大 confirmed seq，避免 `messageSeq=0` 的流式气泡干扰历史拉取。
  - realtime/sync 持久化机器人消息可合并本地 `ai-stream-*` 气泡，并强制保留 `format:'markdown'`、`markdown:true`、`ai:true`。
  - 同文本持久化 DeepSeek 消息出现后，会移除对应的本地 `ai-stream-*` 临时重复气泡，覆盖后端返回 `message_id=0` 且 `clientMsgNo` 为空的情况。
  - 新增稳定合并键：优先非空 `clientMsgNo`，其次 `messageID`，再退到 `fromUID/messageSeq/timestamp/text`；空 `clientMsgNo` 不再作为去重 key，避免多条历史 AI 回复被压成一条。
  - `addMessage` 仅在客户端号非空时按 `clientMsgNo` 去重，否则按 `messageID` 去重，保留多个空客户端号的持久化机器人消息。
  - 抽出频道排序 helper；DeepSeek AI 私聊按 timestamp 排序，时间相同用户消息排在 AI 回复前，避免后端私聊 seq 反向时把 AI 回复显示到 prompt 前。普通会话仍沿用原 seq 优先排序。
- `apps/chat/src/components/MessageInput.vue`
  - SSE done 有有效 `message_id` 时按 ID 更新本地流式气泡。
  - SSE done 无有效 `message_id` 时，如果同文本持久化回复已到达，则删除本地临时气泡；否则保留单条 Markdown AI 气泡作为兜底。
- `apps/chat/tests/messageActions.test.ts`
  - 新增 sync/realtime/SSE finalization/空 clientMsgNo/低 seq/current history 边界回归。
  - 新增两个空 `client_msg_no` 历史回归：连续插入多条空客户端号 AI 回复、sync 返回多条空客户端号 AI 历史回复，都必须完整保留。
  - 新增 DeepSeek 排序回归：当 AI 回复 seq 更低但 timestamp 晚于用户消息时，显示顺序必须是用户消息在前、AI 回复在后。
- `apps/chat/tests/filePreviewVoiceAiContracts.test.ts`
  - 覆盖无有效完成 ID 时的临时 AI 气泡移除兜底。

## Verification Evidence

- `cd sections/im_web && pnpm --filter chat exec vitest run tests/messageActions.test.ts tests/filePreviewVoiceAiContracts.test.ts --pool=threads --poolOptions.threads.singleThread=true`
  - Passed: 2 files, 26 tests.
- `cd sections/im_web && pnpm type-check`
  - Passed.
- `cd sections/im_web && pnpm build`
  - Passed.
- Browser visual audit:
  - Script: `sections/im_web/.ai/V2.0/issues/tests-e2e/v2-24-ai-duplicate-sort-history-20260526/audit.cjs`
  - Summary: `sections/im_web/.ai/V2.0/issues/tests-e2e/v2-24-ai-duplicate-sort-history-20260526/summary.md`
  - Screenshots: `sections/im_web/.ai/V2.0/issues/imgs/v2-24-ai-duplicate-sort-history-20260526/`
  - Result: after completion and after refresh, user marker rows = 1, AI marker rows = 1, AI Markdown rows = 1, no console/network failures.
- Reopened history inspection:
  - Script: `sections/im_web/.ai/V2.0/issues/tests-e2e/v2-24-ai-duplicate-sort-history-20260526/inspect-deepseek-sync.cjs`
  - Result: DeepSeek sync returned 30 messages, including 10 AI history replies; after the merge-key fix the DOM rendered 10 AI rows and all were Markdown rows.
- Multi-turn browser visual audit:
  - Script: `sections/im_web/.ai/V2.0/issues/tests-e2e/v2-24-ai-duplicate-sort-history-20260526/audit-multi-history.cjs`
  - Screenshots:
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-24-ai-duplicate-sort-history-20260526/06-multi-before.png`
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-24-ai-duplicate-sort-history-20260526/07-multi-after-first.png`
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-24-ai-duplicate-sort-history-20260526/08-multi-after-second.png`
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-24-ai-duplicate-sort-history-20260526/09-multi-after-refresh.png`
  - Result: two new unique prompts survived refresh; each had a Markdown AI reply; visible AI rows were all Markdown; duplicate AI text rows = 0; console/network failures = 0.
  - Latest order check: after refresh, marker A user index 16 < AI index 17; marker B user index 18 < AI index 19.

## Close Note

AI 机器人回复现在在运行时只保留一条 Markdown 气泡，刷新后仍由后端历史恢复为一条；用户 prompt 始终存在，输入框发送后清空。

## Reopen Note

2026-05-26 13:45 CST 用户截图反馈：重复问题虽缓解，但历史 AI 回复仍大面积消失。当前可见大量用户 prompt，只有最近一条 AI 回复，历史完整性验收未通过。需要重新定位 `message/channel/sync` 返回、后端持久化与前端合并逻辑，而不能只验证单条新消息。

## Reclose Note

2026-05-26 14:12 CST 已修复空 `client_msg_no` 合并覆盖问题。浏览器同步检查确认历史 AI 回复从后端返回并在 DOM 中完整渲染；多轮发送和刷新验证通过。

## Order Reclose Note

2026-05-26 14:31 CST 已修复 DeepSeek AI 私聊排序错位问题。浏览器自动测试确认新发两轮消息和刷新后均为用户 prompt 在前、AI Markdown 回复在后。
