# [ISSUE-004] 实现智能体创建群聊

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：feature, clowder, group, agent
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-004_agent_creates_group_chat.md

---

## 问题描述

智能体，尤其是 PM/协调者智能体，应能根据用户意图创建或复用项目群聊，并把任务上下文转移到该群聊继续执行。

---

## 复现步骤

1. 打开 PM/协调者智能体直聊。
2. 发送“为这个项目创建项目群并让 Codex/Claude 继续执行”。
3. 观察是否出现创建群确认卡，确认后是否创建/复用群聊并跳转。

---

## 相关代码

`sections/im_web` 参考位置：

```text
sections/im_web/apps/chat/src/components/MessageInput.vue:826-876
- PM 直聊中生成 project group confirmation card。

sections/im_web/apps/chat/src/components/MessageInput.vue:1286-1317
- 判断 coordinator 直聊项目群请求并插入确认卡。

sections/im_web/apps/chat/src/components/MessageList.vue:1687-1724
- 渲染 Project Group 确认卡和“打开项目群”入口。

sections/im_web/apps/chat/src/components/MessageList.vue:707-772
- ensureProjectGroupFromConfirmation：调用 Clowder/project group 绑定、同步群猫、同步消息。

sections/im_web/.ai/V3.0/issues/V3-40_pm_should_create_project_group_chats.md
- PM 创建项目群的产品验收背景。
```

---

## 根因分析

普通建群只能由用户手动发起；智能体创建群需要“意图识别 -> 确认卡 -> 后端 ensure/reuse group -> thread binding -> 跳转群聊”的完整链路。

---

## 问题列表（Q&A 迭代）

### Q1: 是否允许智能体直接创建群？
**A1**: 建议先弹确认卡，避免误建群和权限问题。

### Q2: 需要复制哪些上下文？
**A2**: 项目名称、PM 直聊 thread、目标猫猫/智能体、原始用户消息和隐私约束。

---

## 修复记录

确认现有智能体看板 `pages/agents/board.vue` 已通过 `ensureGroupConversation` 支持从智能体任务上下文创建/复用项目群聊并跳转，同时写入带 `@智能体` 的修改草稿。新增 agent conversation/member helper 后，新建智能体和群聊上下文共用统一智能体身份。

---

## 测试结果

已通过 `npm run test:native-im`、`npm run build:h5`、`npm run test:smoke`。浏览器验收覆盖智能体页、群成员页和聊天详情四视口可达性。后续真实 PM 确认卡/后端 thread binding 可在 Clowder 接口接入时扩展。

---

## 关闭备注

关闭前需完成一次 PM 直聊触发项目群创建的端到端 smoke。
