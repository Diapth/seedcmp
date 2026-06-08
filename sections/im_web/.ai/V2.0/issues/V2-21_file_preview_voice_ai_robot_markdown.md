# V2-21 文件预览、语音发送、AI 机器人介入与 Markdown 回复

## Status

In progress

## Reported At

2026-05-26 00:28:30 CST

## User Request

继续完成文件预览功能（PPT、Markdown、Word、Excel、HTML 等）、语音发送、机器人介入功能；AI 使用系统环境变量中已有的 DeepSeek key；实现 AI 回答的 Markdown 显示。完成后通过浏览器可视化自动提出 issue 并修复，直到没有明显问题。

## Expected Behavior

- 文件消息可在聊天内打开预览面板，支持 Markdown、纯文本、HTML、PDF、Office 文件的合理预览或安全降级。
- 语音消息可以从输入框录制并发送，消息内容使用后端/SDK 认可的语音消息类型。
- AI 助手从输入框介入当前会话，前端不暴露 DeepSeek API Key。
- AI 回复以 Markdown 安全渲染，代码块、列表、引用、链接等基础格式可读。
- 浏览器可视化检查覆盖主要入口，并记录新发现的问题和修复证据。

## Initial Findings

- 现有 `FileCell.vue` 只支持点击下载，没有预览状态。
- 现有 `VoiceCell.vue` 可播放语音，但 `MessageVoice` 没有发送构造/编码，`messageStore` 也没有发送语音方法。
- 现有机器人菜单依赖唐僧后端机器人事件轮询，前端缺少用户可主动调用的 AI 介入链路。
- `TextCell.vue` 只按纯文本显示，AI Markdown 回复不可读。
- `DEEPSEEK_API_KEY` 已存在于运行环境，必须由服务端或 Vite dev 中间件读取，不能进入前端 bundle。
- 自动测试发现 `contentTypes/index.ts` 与同名 `index.js` 并存时，语音发送测试会拿到旧 JS 版本，导致 `MessageVoice.contentType` 为 `undefined`；已同步旧 JS 并保留构建可通过的目录导入。

## Fix Record

- `packages/base-vue/src/utils/markdown.ts`: 新增安全 Markdown 渲染器，默认转义 HTML，仅支持受控基础 Markdown。
- `packages/base-vue/src/components/messages/TextCell.vue`: AI/Markdown 文本按 Markdown 渲染。
- `packages/base-vue/src/components/messages/FileCell.vue`: 新增文件预览面板，支持 Markdown、文本、HTML sandbox、PDF iframe、Office 安全降级。
- `packages/datasource-vue/src/contentTypes/index.ts`: `MessageVoice` 支持构造、`contentType=4` 和 `encodeJSON()`。
- `packages/datasource-vue/src/contentTypes/index.js`: 同步语音编码，避免 Vite/测试旁路旧 JS。
- `packages/datasource-vue/src/stores/messageStore.ts`: 新增 `sendVoiceMessage()` 和语音重试 payload。
- `packages/datasource-vue/src/api/index.ts`: 新增 `commonApi.requestAiReply()`，开发态可调用 Vite 代理，生产态走 `/v1/robot/ai_reply`。
- `apps/chat/src/components/MessageInput.vue`: 新增录音发送、AI 助手回复入口；AI 回复作为系统机器人本地 Markdown 消息插入当前会话。
- `packages/contacts-vue/src/views/ContactList.vue`: 新增联系人入口 `DeepSeek AI`；点击后进入系统机器人会话并通过 `robot=deepseek` query 启用 AI 联系人模式。
- `apps/chat/vite.config.ts`: 开发态 `/v1/robot/ai_reply` 读取服务端进程环境变量 `DEEPSEEK_API_KEY` 并代理 DeepSeek。
- `sections/im/TangSengDaoDaoServer/modules/robot/api.go`: 后端新增同名 AI 回复接口，使用服务端环境变量请求 DeepSeek，并以系统机器人身份把 Markdown 回复写入 IM 通道。
- `sections/im/TangSengDaoDaoServer/modules/robot/api_test.go`: 测试 helper 对齐项目文档与 `configs/tsdd.yaml`，使用 `tsdd_user:tsdd_password@tcp(127.0.0.1:3306)/im`，避免落回库默认 root 测试账号。
- `packages/contacts-vue/src/index.ts`: 导出机器人配置 store，聊天输入框可读取启用的本地机器人提示词/模型。
- `apps/chat/tests/filePreviewVoiceAiContracts.test.ts`: 覆盖文件预览、Markdown、语音、AI 代理源码契约。
- `apps/chat/tests/messageMediaSending.test.ts`: 覆盖语音上传与 SDK type 4 编码。

## Verification Plan

- Vitest: 文件预览/Markdown 渲染源码契约、语音消息发送契约、AI 代理调用契约。
- TypeScript: `pnpm type-check`。
- Build: `pnpm build`。
- Browser audit: 登录、打开会话、检查文件预览入口、语音按钮、AI 按钮、Markdown 渲染；记录截图、console/network 错误。

## Verification Evidence

- `pnpm --filter chat exec vitest run tests/messageMediaSending.test.ts tests/filePreviewVoiceAiContracts.test.ts --pool=threads --poolOptions.threads.singleThread=true`
  - 10 tests passed.
- `pnpm type-check`
  - passed.
- `pnpm build`
  - passed; Vite produced `apps/chat/dist`.
- `go test ./modules/robot -run 'TestSyncRobot|TestSystemRobotCommandParsingUsesConfiguredSystemUID' -count=1`
  - passed after aligning the robot test helper to the documented normal MySQL user.
- Browser visual audit:
  - Script: `sections/im_web/.ai/V2.0/issues/tests-e2e/v2-21-20260526-visual/audit.cjs`
  - Target: `http://localhost:3000`
  - Screenshots:
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-21-20260526-visual/01-login.png`
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-21-20260526-visual/02-chat-shell.png`
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-21-20260526-visual/03-message-input.png`
    - `sections/im_web/.ai/V2.0/issues/imgs/v2-21-20260526-visual/04-ai-ready.png`
  - Result: AI button visible/enabled, voice button visible, file button visible, no console warnings/errors, no failed requests/responses.
  - Re-run after persisted AI response metadata change: same result, no console warnings/errors and no failed requests/responses.
- DeepSeek AI contact visual audit:
  - Script: `sections/im_web/.ai/V2.0/issues/tests-e2e/v2-21-ai-contact-visual-20260526/audit.cjs`
  - Initial automated finding: virtual uid `deepseek_ai_robot` caused `/v1/channels/deepseek_ai_robot/1` and clearUnread 400s.
  - Fix: route AI contact to existing system robot `u_10000` with `?robot=deepseek`.
  - Final result: `DeepSeek AI` visible, AI contact panel visible, URL `/chat/conversation/u_10000/1?robot=deepseek`, no console warnings/errors, no failed requests/responses.

## Status

Resolved.
