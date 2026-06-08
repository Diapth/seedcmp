# [ISSUE-008] 实现智能体的流式回复以及文件回复功能

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：feature, clowder, streaming, file
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-008_agent_streaming_and_file_reply.md

---

## 问题描述

智能体回复不仅要支持流式 Markdown 文本，还要支持结构化文件回复。文件应作为 IM 文件卡片出现，而不是仅作为 Markdown 文本中的路径。

---

## 复现步骤

1. 请求智能体生成一个文件或打包产物。
2. 观察是否先出现 thinking/streaming，再出现最终回复。
3. 最终回复中如果包含文件，应显示可下载/可预览的文件卡片。

---

## 相关代码

`sections/im_web` 参考位置：

```text
sections/im_web/apps/chat/src/components/MessageList.vue:1773-1778
- type=8 FileCell 渲染和 preview 事件。

sections/im_web/packages/datasource-vue/src/stores/messageStore.ts:1368-1469
- 用户侧文件消息上传和 MessageFile 发送，可复用文件卡片数据结构。

sections/im_web/.ai/V3.0/issues/V3-38_clowder_agent_files_not_delivered_to_web.md
- 明确要求 agent-generated files 作为 durable attachments 到达 IM Web，而不是 markdown 路径。

sections/im_web/.ai/V3.0/issues/V3-19_cat_group_multi_user_identity_mention_file_and_thinking_order_regressions.md:106-118
- 修复 Clowder 文件 rich block 缺少 browser-usable url 的经验。

sections/im_web/apps/chat/src/components/ChatSidePreview.vue:1-53
- 文件/Markdown/HTML/PDF 等右侧预览入口。
```

---

## 根因分析

智能体产物从 Clowder 到 IM Web 需要经过 connector/outbound normalization。如果只把文件路径拼进 Markdown，浏览器无法下载或预览，也无法进入 IM 的持久消息类型体系。

---

## 问题列表（Q&A 迭代）

### Q1: 文件回复是否和用户发送文件共用 type=8？
**A1**: 是，最终应落为同一种 IM 文件卡片结构，区别只在 sender 和来源 metadata。

### Q2: 流式文本和文件同时出现时怎么展示？
**A2**: 文本流式合并为一条，文件作为 final 阶段的结构化附件行或同条消息的 rich block 映射。

---

## 修复记录

`mergeAgentReplyEventIntoList` 支持 final 阶段携带 `files/attachments/generatedFiles`，并转换为 IM 文件卡片消息，保留 `generatedByAgent/source/url/previewContent` 等字段；流式文本仍合并为一条 Markdown 回复。

---

## 测试结果

已新增 generated file fixture 单测并通过；浏览器验收覆盖文件页/文件卡片入口四视口可达。`npm run test:native-im`、`npm run build:h5`、`npm run test:smoke` 通过。

---

## 关闭备注

关闭前需验证智能体生成文件能在 Web 中点击预览或下载。
