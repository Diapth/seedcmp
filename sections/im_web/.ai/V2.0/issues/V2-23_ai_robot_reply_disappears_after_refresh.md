# V2-23 AI 机器人回复刷新后消失

## Status

Resolved

## Reported At

2026-05-26 10:34 CST

## Reporter Notes

用户反馈：当前 `DeepSeek AI` 机器人的回复在页面刷新后会消失。

## Current Behavior

- V2-22 已实现独立机器人联系人 `deepseek_ai_robot`、SSE 流式回复、发送框清空和 Markdown 渲染。
- 浏览器当次会话内可以看到 AI 流式回复。
- 刷新页面后，AI 机器人回复不再出现在历史消息中。

## Expected Behavior

- AI 机器人回复应作为 `deepseek_ai_robot` 发出的正式消息持久化到后端。
- 刷新、重新进入 `/chat/conversation/deepseek_ai_robot/1` 后，用户提问和 AI 回复都应从历史消息同步恢复。
- SSE 流式本地消息与后端持久化消息应能对齐，避免刷新丢失或重复显示。

## Suspected Cause

- V2-22 的前端为了提供即时流式体验，先创建了本地 `ai-stream-*` 消息，再在 SSE done 事件里用后端返回的 `message_id/message_seq` 更新它。
- 但后端 `SendMessageWithResult` 对单聊的 `ChannelID`/`FromUID` 组合、消息保存频道，或前端 `messageID/messageSeq/clientMsgNo` 对齐逻辑可能没有让这条回复进入后续 `message/channel/sync` 可拉取的历史。
- 另一个可能点：SSE done 返回了持久化结果，但前端本地消息更新后没有触发可靠同步/去重；刷新后只依赖远端历史，导致未持久化或拉不到的消息消失。

## Acceptance Criteria

- [ ] 发送给 `DeepSeek AI` 后，AI 回复在当前页面流式出现。
- [ ] 刷新页面后，同一条 AI 回复仍在 `deepseek_ai_robot` 会话历史中。
- [ ] 不出现本地流式消息和远端持久化消息重复显示。
- [ ] 后端返回的 `message_id/message_seq` 与前端本地消息状态对齐。
- [ ] 浏览器可视化测试覆盖“发送 AI -> 等待回复 -> 刷新 -> 回复仍存在”。

## Suggested Investigation

- 查看 `/v1/robot/ai_reply` SSE done 返回的 `message_id/message_seq/persisted` 是否真实非零。
- 查看 TangSengDaoDaoServer `streamDeepSeekReply` 中单聊发送时 `ChannelID` 是否应为 `c.GetLoginUID()`、`deepseek_ai_robot`，或 fake channel。
- 查看刷新后 `message/channel/sync` 对 `deepseek_ai_robot` 的返回内容是否包含 AI 回复。
- 检查 `MessageInput.vue` 的本地流式消息 `messageID`/`messageSeq` 更新是否会被 `addRealtimeMessage` 或 `syncMessages` 去重合并。

## Verification Plan

- Vitest:
  - 覆盖 AI 流式本地消息 done 后保留远端 `message_id/message_seq`。
  - 覆盖远端同步消息与本地流式消息去重。
- Backend Go test:
  - 覆盖 `deepseek_ai_robot` 作为 `FromUID` 写入单聊后，目标用户能从频道历史同步到回复。
- Browser audit:
  - 登录。
  - 打开 `DeepSeek AI`。
  - 发送短 prompt。
  - 等待 AI Markdown 回复出现。
  - 刷新页面。
  - 验证 AI 回复仍然可见，且无重复。

## Root Cause

- V2-22 中 `apps/chat/vite.config.ts` 增加了开发期 `/v1/robot/ai_reply` 代理。
- 在 `http://100.79.157.76:3000` 下，前端 `requestAiReplyStream()` 会请求相对路径 `/v1/robot/ai_reply`。
- 该请求被 Vite dev server 拦截后直接调用 DeepSeek，并返回 `persisted:false`，没有经过 TangSengDaoDaoServer 的 `/v1/robot/ai_reply`。
- 因此当页能看到本地流式 AI 消息，但后端历史中没有这条机器人回复；刷新后只依赖远端同步，回复就消失。

## Fix Record

- `packages/datasource-vue/src/api/index.ts`
  - `requestAiReplyStream()` 统一请求 `apiClient.defaults.baseURL + robot/ai_reply`。
  - 不再根据 `window.location.port === '3000'` 改走相对路径。
  - 非流式 `requestAiReply()` 也统一走后端 `apiClient.post('robot/ai_reply')`。
- `apps/chat/vite.config.ts`
  - 移除开发期 DeepSeek 直连代理。
  - 前端开发环境不再拦截 `/v1/robot/ai_reply`，AI 请求由 `8090` 后端处理和持久化。
- `apps/chat/tests/filePreviewVoiceAiContracts.test.ts`
  - 增加契约：AI stream 必须走后端 API URL。
  - 增加契约：Vite config 不得包含 `DEEPSEEK_API_KEY`、`api.deepseek.com` 或 `persisted:false`。
- `tests-e2e/v2-23-ai-refresh-persistence-20260526/audit.cjs`
  - 覆盖“发送 AI -> 等待 SSE 完成 -> 刷新 -> 回复仍在”。

## Verification Results

- `pnpm --filter chat exec vitest run tests/filePreviewVoiceAiContracts.test.ts --pool=threads --poolOptions.threads.singleThread=true`
  - PASS: 7 tests.
- `pnpm --filter chat exec vitest run tests/messageMediaSending.test.ts tests/filePreviewVoiceAiContracts.test.ts --pool=threads --poolOptions.threads.singleThread=true`
  - PASS: 13 tests.
- `pnpm type-check`
  - PASS.
- `pnpm build`
  - PASS. Vite emitted only the existing chunk-size warning.
- `go test ./modules/robot -run 'TestInsertSystemRobotCreatesIndependentDeepSeekRobotAccount|TestSyncRobot|TestSystemRobotCommandParsingUsesConfiguredSystemUID' -count=1`
  - PASS.

## Browser Evidence

- Summary: `tests-e2e/v2-23-ai-refresh-persistence-20260526/summary.md`
- Screenshots:
  - `imgs/v2-23-ai-refresh-persistence-20260526/01-login.png`
  - `imgs/v2-23-ai-refresh-persistence-20260526/02-deepseek-before-send.png`
  - `imgs/v2-23-ai-refresh-persistence-20260526/03-ai-reply-before-refresh.png`
  - `imgs/v2-23-ai-refresh-persistence-20260526/04-ai-reply-after-refresh.png`

Final browser audit result:

- AI SSE request URL: `http://100.79.157.76:8090/v1/robot/ai_reply`
- SSE content type: `text/event-stream; charset=utf-8`
- AI reply visible before refresh: yes
- AI reply visible after refresh: yes
- Console warnings/errors: none
- Failed requests/responses: none
