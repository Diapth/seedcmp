# V2-22 机器人账号模型、发送框清空与 AI SSE 流式回复

## Status

Resolved

## Reported At

2026-05-26 09:02:30 CST

## Reporter Notes

用户明确指出当前机器人实现仍存在三个产品/技术问题：

1. 机器人应该是单独的联系人账号，但带有特殊标记，表明它是机器人；不应该只是复用系统账号并靠环境变量配置。
2. 发送消息后，发送框内的内容不会被清除。
3. AI 回复没有适配 SSE 流式传输。

## Current Behavior

- V2-21 中 `DeepSeek AI` 联系人入口为了避免后端 400，临时路由到已存在系统账号 `u_10000` 并通过 `?robot=deepseek` 启用 AI 模式。
- 这解决了浏览器 400，但没有满足“机器人是独立联系人账号”的产品模型。
- AI 联系人模式下发送消息的输入框状态需要重新验证；用户反馈发送后内容仍保留。
- DeepSeek 调用当前按非流式响应处理，前端没有展示 token 增量输出，也没有 SSE 取消、错误、结束态。

## Expected Behavior

- 后端或前端联系人模型中应存在独立机器人账号，例如 `deepseek_ai_robot`，并且该账号应有 `robot`/`is_robot`/`category=robot` 等明确标记。
- 联系人页应把机器人作为联系人项展示，并用视觉标记说明“机器人”，但点击后不应触发不存在用户或 channel 的 400。
- AI 联系人会话发送后，输入框应立即清空；失败时可恢复草稿或给出明确失败提示。
- AI 回复应支持 SSE 流式传输：
  - 请求可开启 stream。
  - 前端逐步渲染 Markdown 内容。
  - 支持结束态、错误态、取消/超时处理。
  - 流式消息最终应能与持久化消息或本地消息状态对齐，避免刷新后丢失或重复。

## Acceptance Criteria

- [ ] 机器人联系人不再依赖 `u_10000?robot=deepseek` 作为最终模型；应有独立账号/联系人标识和机器人标记。
- [ ] 联系人页 `DeepSeek AI` 点击后无 `/channels/<virtual-id>/1` 400、无 clearUnread 400。
- [ ] AI 会话发送后输入框内容被清空；失败恢复行为有测试覆盖。
- [ ] AI 回复支持 SSE 流式显示，且 Markdown 渲染在流式增量中保持安全可读。
- [ ] 浏览器可视化审计覆盖机器人联系人入口、发送框清空、流式回复开始/结束状态。

## Suggested Investigation

- 唐僧后端机器人表/用户表是否支持创建独立机器人用户，并将其作为联系人返回。
- `robot/sync`、`robots/:robot_id/:app_key/sendMessage` 与新 AI 代理接口应如何统一身份。
- `MessageInput.vue` 的 AI 发送路径是否在 `promptText` 参数分支中跳过了 `inputText.value = ''`。
- DeepSeek SSE API 响应格式与 Vite dev proxy/后端接口的流式转发方式。

## Verification Plan

- Vitest contract/store/component tests:
  - 机器人联系人标记与路由。
  - AI 发送后清空输入框。
  - SSE parser 增量合并与结束态。
- Backend Go tests:
  - 独立机器人账号/菜单/AI 回复接口的身份行为。
- Browser audit:
  - 联系人页展示 `DeepSeek AI` 独立机器人。
  - 点击进入会话无 400。
  - 输入消息发送后输入框清空。
  - AI 回复以流式方式逐步显示。

## Root Cause

- `DeepSeek AI` 在 V2-21 中只是前端虚拟联系人，为了绕过 `/channels/deepseek_ai_robot/1` 400 临时退回到 `u_10000?robot=deepseek`。
- 后端没有幂等创建 `deepseek_ai_robot` 的 `user` 账号和 `robot` 记录，所以独立机器人账号无法作为真实单聊频道读取。
- `MessageInput.vue` 的 AI 联系人发送路径传入 `promptText` 时跳过了 `inputText.value = ''`。
- AI 回复只走普通 JSON 请求，没有 SSE parser、流式 fetch、增量消息合并和完成态更新。
- 进入新机器人会话时本地还没有 conversation，前端仍调用远端 `clearUnread`，导致 IM 返回 `stale metadata` 400。

## Fix Record

- `packages/contacts-vue/src/views/ContactList.vue`
  - `DeepSeek AI` 改为独立账号 `deepseek_ai_robot`。
  - 联系人项展示 `机器人` 标记。
  - 点击后进入 `/chat/conversation/deepseek_ai_robot/1`，不再依赖 `u_10000?robot=deepseek`。
- `apps/chat/src/components/MessageInput.vue`
  - AI 联系人模式改为识别 `deepseek_ai_robot`。
  - 发送后立即清空输入框和草稿；失败时恢复草稿。
  - 新增流式本地 AI 消息，SSE token 增量合并为同一条 Markdown 消息，完成后更新 `message_id/message_seq/status`。
- `packages/datasource-vue/src/api/index.ts`
  - 新增 `parseAiStreamLine`。
  - 新增 `requestAiReplyStream`，通过 `fetch` 读取 `text/event-stream`。
- `packages/datasource-vue/src/stores/conversationStore.ts`
  - 对 `deepseek_ai_robot` 的全新空会话跳过无意义的远端 `clearUnread`，避免 `stale metadata` 400。
- `apps/chat/vite.config.ts`
  - Dev proxy 继续只在服务端读取 `DEEPSEEK_API_KEY`。
  - `/v1/robot/ai_reply` 改为 SSE 转发 DeepSeek stream，前端 bundle 不暴露 key。
- `sections/im/TangSengDaoDaoServer/modules/robot/api.go`
  - 幂等创建 `deepseek_ai_robot` 的用户账号和机器人记录。
  - AI 回复 `FromUID` 改为 `deepseek_ai_robot`。
  - `/v1/robot/ai_reply` 支持 `stream:true` SSE，最终仍将完整 Markdown 回复持久化为机器人消息。
- `sections/im/TangSengDaoDaoServer/modules/robot/api_test.go`
  - 覆盖独立 DeepSeek 机器人账号/robot 记录创建。

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

- Summary: `tests-e2e/v2-22-robot-ai-visual-20260526/summary.md`
- Screenshots:
  - `imgs/v2-22-robot-ai-visual-20260526/01-login.png`
  - `imgs/v2-22-robot-ai-visual-20260526/02-contacts.png`
  - `imgs/v2-22-robot-ai-visual-20260526/03-deepseek-conversation.png`
  - `imgs/v2-22-robot-ai-visual-20260526/04-before-send.png`
  - `imgs/v2-22-robot-ai-visual-20260526/05-after-send-stream.png`

Final browser audit result:

- URL: `/chat/conversation/deepseek_ai_robot/1`
- `DeepSeek AI` visible: yes
- `机器人` marker visible: yes
- AI panel visible: yes
- Input cleared after send: yes
- SSE response: `200 text/event-stream; charset=utf-8`
- Markdown reply rendered: yes
- Console warnings/errors: none
- Failed requests/responses: none
