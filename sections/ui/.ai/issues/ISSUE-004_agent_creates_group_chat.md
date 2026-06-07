# [ISSUE-004] 实现智能体创建群聊

**状态**：Open
**创建时间**：2026-06-08
**标签**：feature, clowder, group, agent

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

待修复。

---

## 测试结果

建议覆盖确认卡、取消、确认创建、复用群、打开群和 thread 绑定。

---

## 关闭备注

关闭前需完成一次 PM 直聊触发项目群创建的端到端 smoke。
