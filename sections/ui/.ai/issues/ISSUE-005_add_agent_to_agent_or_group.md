# [ISSUE-005] 实现在智能体中添加智能体

**状态**：Open
**创建时间**：2026-06-08
**标签**：feature, clowder, agent, membership

---

## 问题描述

用户需要能把已有智能体/猫猫添加到某个智能体协作上下文或群聊中，使其成为可 @、可路由、可显示的成员。

---

## 复现步骤

1. 打开群聊成员页或智能体协作配置页。
2. 选择一个已连接智能体。
3. 添加后返回聊天输入框，输入 `@` 应能看到该智能体。

---

## 相关代码

`sections/im_web` 参考位置：

```text
sections/im_web/apps/chat/src/views/GroupMemberList.vue:59-62
- 从 connectedCatContacts 计算可添加到当前群的猫猫。

sections/im_web/apps/chat/src/views/GroupMemberList.vue:86-98
- 加载群成员、猫猫目录和群猫状态。

sections/im_web/apps/chat/src/views/GroupMemberList.vue:128-137
- handleAddCatMember 调用 clowderStore.addGroupCat。

sections/im_web/apps/chat/src/views/GroupMemberList.vue:232-249
- UI select + 添加按钮。

sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts:1225-1292
- loadGroupCats / addGroupCat，持久化 group cat membership 和 prompt。
```

---

## 根因分析

智能体添加不是普通联系人添加。它还要更新 Clowder group prompt、auto-reply mode、mention candidates 和 agent directory，否则 UI 虽显示成员但无法路由。

---

## 问题列表（Q&A 迭代）

### Q1: “智能体中添加智能体”落在哪个模型？
**A1**: 可先落到“群聊添加智能体成员”，后续再扩展为智能体协作/团队配置。

### Q2: 添加后是否立即可 @？
**A2**: 必须立即刷新 mention candidates，不能等下一次页面刷新。

---

## 修复记录

待修复。

---

## 测试结果

建议增加 group member 页面、输入框 @ 候选、Clowder prompt 更新测试。

---

## 关闭备注

关闭前需验证添加、移除、刷新后成员仍存在。
