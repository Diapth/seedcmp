# [ISSUE-002] 实现 Clowder AI 回复的 Markdown 流式输出和流式转换

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：feature, clowder, streaming, markdown

---

## 问题描述

Clowder AI 回复需要支持 thinking/placeholder、chunk、final 三阶段展示，并把 Markdown 内容转换成安全 HTML。流式过程应更新同一条可见消息，最终只保留一条 durable 回复。

---

## 复现步骤

1. 打开 Clowder AI 或猫猫会话。
2. 发送会产生长回复的问题，例如“列出当前团队成员并用表格展示”。
3. 观察回复过程中是否逐字/分段更新，最终是否渲染 Markdown 表格。

---

## 相关代码

`sections/im_web` 参考位置：

```text
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts:320-429
- 判断 Clowder streaming placeholder，寻找可合并流式消息，合并 placeholder/chunk/final 内容。

sections/im_web/packages/datasource-vue/src/stores/messageStore.ts:519-553
- 群聊和直聊里的 Clowder 回复排序，保证人类 prompt 在 AI thinking/final 前面。

sections/im_web/packages/base-vue/src/utils/markdown.ts:1-82
- 使用 markdown-it 渲染 Markdown，包含代码块、链接安全处理。

sections/im_web/.ai/V3.0/issues/V3-18_cat_group_chat_mentions_context_media_and_markdown_it.md
- 记录了从自写解析器迁移到 markdown-it、流式合并和表格渲染的验收标准。
```

---

## 根因分析

如果把每个 chunk 当成普通消息写入列表，会产生重复消息、排序混乱、刷新后残留 thinking 行。需要使用稳定 stream key/clientMsgNo 合并，并且 final 到达后覆盖/清理 placeholder。

---

## 问题列表（Q&A 迭代）

### Q1: Markdown 是否可以手写解析？
**A1**: 不建议。`im_web` 已迁移到 `markdown-it`，应复用相同策略。

### Q2: chunk 是否持久化为多条 IM 消息？
**A2**: 不应在 UI 列表中表现为多条。IM Web V3 经验是 placeholder/chunk/final 合并为一条可见回复。

---

## 修复记录

新增 `mergeAgentReplyEventIntoList` / `normalizeAgentReplyEvent`，将 placeholder、chunk、final 按稳定 `streamKey` 合并为同一条可见 Markdown 回复；final 阶段可追加智能体生成文件卡片。`messageStore.receiveAgentReplyEvent` 接入该合并逻辑，`MessageBubble.vue` 对 Clowder/Markdown 文本使用 `markdown-it` 安全渲染。

2026-06-08 复验补充：会话列表摘要新增 Markdown 预览归一化，会去除标题、表格分隔、引用、链接/图片语法和换行，并限制为单行短摘要；长 Clowder Markdown 回复不再把左侧会话项撑成多行。

---

## 测试结果

已新增并通过 Clowder stream merge + Markdown + generated file 回归测试、长 Markdown 会话摘要单行回归测试；`npm run test:native-im`、`npm run build:h5`、`npm run test:smoke` 均通过。浏览器四视口验收确认可见摘要无换行/溢出问题。

---

## 关闭备注

关闭前需验证 Markdown 表格、代码块、链接、长流式回复均正常显示且刷新后无重复。
