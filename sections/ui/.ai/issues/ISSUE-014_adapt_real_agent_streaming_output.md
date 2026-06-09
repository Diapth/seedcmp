# [ISSUE-014] 适配智能体真实流式输出

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：feature, bug, clowder, streaming, markdown

---

## 问题描述

`sections/ui` 需要适配智能体真实流式输出，而不是只依赖本地模拟的 `createClowderMarkdownStreamEvents`。当后端 Clowder AI 产生 chunk/delta/final 或等价事件时，前端应把它们合并为同一条智能体回复消息，并正确渲染 Markdown。

结合新的交互要求，流式输出前的 thinking 状态不再作为独立消息展示，而是由 `ISSUE-013` 中的用户消息 reaction 表示。

---

## 复现步骤

1. 启动 `sections/ui` 并连接 Clowder AI 后端。
2. 打开智能体直聊，发送会产生较长回复的问题，例如“用 Markdown 表格列出当前任务”。
3. 观察回复是否按后端真实流式事件逐段更新。
4. 等待 final 到达后，检查最终是否只保留一条完整 Markdown 回复。
5. 刷新或重新进入会话，检查 final 回复是否不重复、不残留半截 chunk。

实际风险：当前页面可能只启动本地模拟流，真实后端流式事件没有接入；或 chunk 被当成多条普通消息插入；或 placeholder 显示为独立“正在思考...”气泡。

预期：真实流式事件驱动同一条智能体回复持续更新，最终固化为一条消息。

---

## 相关代码

```text
sections/ui/services/native-im/message-state.js
- normalizeAgentReplyEvent 支持 phase/stage/event/status/type、delta/contentDelta/content_delta。
- mergeAgentReplyEventIntoList 使用 streamKey 合并 placeholder/chunk/final。
- createClowderMarkdownStreamEvents 当前是本地模拟流，应只作为 mock/demo 兜底。

sections/ui/stores/message.js
- receiveAgentReplyEvent 是真实流式事件进入 message store 的目标入口。
- startClowderMarkdownStream 当前用于本地模拟，需要避免真实后端场景重复生成 mock 流。

sections/ui/services/native-im/service.js
- sendClowderConversationMessage 当前只发送请求并返回投递结果，还需要确认真实 stream 事件来源，例如 SSE、WebSocket、轮询或 bridge outbound hook。

sections/ui/pages/chat/index.vue
sections/ui/pages/chat/detail.vue
- handleSendMessage 当前在 shouldStartLocalClowderStream 时启动本地流，真实后端接入后需要按环境能力切换。

sections/ui/.ai/issues/ISSUE-002_clowder_markdown_streaming.md
- 已关闭的 Markdown 流式合并经验，可作为回归标准参考。

sections/ui/.ai/issues/ISSUE-008_agent_streaming_and_file_reply.md
- 已关闭的智能体流式与文件回复经验，可作为结构化附件 final 阶段参考。
```

---

## 根因分析

当前已有流式合并工具，但事件来源仍可能停留在本地模拟。真实 Clowder 输出需要完整链路：

1. 发送用户 prompt 后获得可关联的 request/thread/message identity。
2. 前端订阅或接收后端智能体 stream 事件。
3. 每个事件归一化为 `streamKey/phase/delta/content/files/sender`。
4. message store 按 `streamKey` 合并成同一条回复。
5. final 到达后清理 streaming 状态，并保证历史恢复时只有最终 durable 消息。

---

## 问题列表（Q&A 迭代）

### Q1: 是否还能保留本地模拟流？
**A1**: 可以保留为 mock/demo 兜底，但真实 Clowder 后端可用时必须使用真实事件，不能同时启动 mock 流导致重复回复。

### Q2: placeholder 阶段如何处理？
**A2**: 不再显示独立“正在思考...”消息。placeholder/start 只用于内部建立 stream 状态，用户可见的收到状态由用户消息上的 reaction 表示。

### Q3: final 里有文件或附件怎么办？
**A3**: 沿用 `mergeAgentReplyEventIntoList` 的 generated files 支持，把文件映射为 IM 文件卡片或同条消息附件，不把路径仅写进 Markdown。

---

## 验收标准

- 真实后端 stream chunk 到达时，同一条智能体消息逐段更新。
- final 到达后，该消息状态变为 `success`，`streaming=false`。
- placeholder/start 不再创建独立 thinking 文本气泡。
- mock 流只在后端不可用或明确 demo 场景启用，真实后端场景不重复回复。
- Markdown 表格、代码块、链接在流式和 final 后均正常渲染。
- 刷新、重连、重新进入会话后，只保留最终 durable 回复，不残留 chunk 或重复 final。
- 如果 final 携带文件，文件以可点击/预览的文件卡片展示。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充单测/集成测试：

1. 真实 stream event fixture：placeholder/chunk/chunk/final 合并为一条消息。
2. placeholder 不创建可见 thinking 消息。
3. mock stream 与真实 stream 不会同时启动。
4. final 后刷新恢复不重复。

---

## 修复记录

### 2026-06-08

已完成以下修复：

1. `sections/ui/services/native-im/normalizers.js`
   - 支持把 `type=1000/event=clowder_stream` 等真实后端 stream 系统事件归一化为可合并的 Markdown 文本流。
   - 支持 `stream_key/streamKey/stream_id/platform_message_id` 和 `phase/status/stage` 等字段。
   - 对 `delta/contentDelta/content_delta` 使用不 trim 的读取方式，保留流式片段中的有效空格。

2. `sections/ui/services/native-im/message-state.js`
   - native stream chunk 支持 delta 累积，final 到达后用完整内容覆盖并设置 `streaming=false`。
   - durable final stream 在缺少 `streamPhase` 时按完成态处理，避免刷新/历史合并后回到 sending。

3. `sections/ui/tests/native-im.test.mjs`
   - 增加真实 Clowder stream 系统事件归一化测试。
   - 增加多 chunk delta 累积并由 final 覆盖的回归测试。
   - 增加 durable final stream 历史合并保持完成态的回归测试。

---

## 测试结果

```bash
npm run test:native-im
# pass 35, fail 0

npm run build:h5
# DONE Build complete

npm run test:smoke
# sections/ui smoke test passed
```

浏览器可视化验证：

```text
URL: http://localhost:5173/#/pages/chat/index
截图:
/tmp/issue-012-014-03-streaming-markdown.png
/tmp/issue-012-014-04-final-history-preserved.png
sections/ui/.ai/tests-e2e/ISSUE-012-014-agent-history-reaction-stream/03-streaming-markdown-merged.png
sections/ui/.ai/tests-e2e/ISSUE-012-014-agent-history-reaction-stream/04-final-history-preserved.png
```

验证结果：Markdown 流式内容可见，final 后只保留一条智能体回复；脚本内同时验证真实 stream delta `真实` + `流式` 合并为 `真实流式`。受限于本地未接真实 Clowder/TangSeng 后端，本次浏览器验证使用本地可控事件注入。

---

## 关闭备注

已通过浏览器可视化验证。真实后端环境上线前仍建议补一轮真实 Clowder AI 长回复流式验收。
