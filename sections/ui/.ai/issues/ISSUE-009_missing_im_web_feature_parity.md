# [ISSUE-009] 参考 sections/im_web 补充 sections/ui 仍缺失的功能

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：investigation, feature, parity, im-web
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-009_missing_im_web_feature_parity.md

---

## 问题描述

除本轮列出的 8 项外，`sections/ui` 还需要对齐 `sections/im_web` 的核心 IM 与 Clowder 能力，避免 UI 版本只有页面外观而缺少行为。

---

## 复现步骤

1. 对照 `sections/im_web` 打开聊天、群聊、联系人、智能体、文件预览。
2. 在 `sections/ui` 中执行同样流程。
3. 记录无法完成或刷新后丢失的能力。

---

## 相关代码

可重点参考：

```text
sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts
- 会话同步、草稿、置顶、免打扰、未读、删除/隐藏、群聊补偿。

sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
- 消息同步、去重、pending/ACK、媒体、语音、Clowder 流式合并。

sections/im_web/packages/datasource-vue/src/stores/groupStore.ts
- 群信息、群成员、管理员、禁言、退出/解散。

sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
- Clowder 状态、agent directory、cat directory、group cats、project group、deployment request。

sections/im_web/apps/chat/src/components/MessageInput.vue
- 输入框 @、回复、媒体、语音、AI/Clowder 路由、项目群确认卡。

sections/im_web/apps/chat/src/components/MessageList.vue
- 多类型消息、时间分割、上下文菜单、项目群/部署卡、图片/文件预览。

sections/im_web/packages/base-vue/src/utils/markdown.ts
- markdown-it 渲染。
```

---

## 根因分析

`sections/ui` 是 uni-app 版本，需要补的不只是组件，还包括后端 API、SDK listener、store ownership、消息类型、Clowder connector 状态和 browser/APP 兼容处理。

---

## 问题列表（Q&A 迭代）

### Q1: 哪些能力优先级最高？
**A1**: 消息发送/同步、群聊、Clowder 流式、智能体添加和文件回复应优先。

### Q2: 是否完全复制 im_web？
**A2**: 不应逐字复制；应迁移行为模型和接口边界，UI 保持 uni-app 实现。

---

## 修复记录

补齐本轮 parity 闭环：新增 `sections/ui/.ai/tests/test-plan.md`，覆盖 native IM、Clowder streaming/Markdown、时间显示、智能体添加/入群、文件回复和四视口浏览器验收。空用户 visual smoke 崩溃作为 ISSUE-010 记录并修复。

---

## 测试结果

已建立 `.ai/tests/test-plan.md`；`npm run test:native-im`、`npm run build:h5`、`npm run test:smoke` 均通过；Playwright 验收覆盖 375x844、768x1024、1024x768、1440x900，截图输出到 `seedcmp/sections/ui/.ai/tests/sections-ui-*.png`。

---

## 关闭备注

关闭前需形成 `sections/ui` 与 `sections/im_web` 的能力映射表，标注已实现、合并实现、延期和移除项。
