# [ISSUE-006] 实现识别系统智能体并在智能体页显示智能体

**状态**：Open
**创建时间**：2026-06-08
**标签**：feature, agent, clowder, directory

---

## 问题描述

系统内置智能体、Clowder AI 联系人、已连接猫猫/智能体需要被识别为智能体实体，并在智能体页展示状态、能力、入口和不可用原因。

---

## 复现步骤

1. 打开智能体页。
2. 检查系统账号、Clowder AI、猫猫联系人是否出现。
3. 打开会话列表，检查智能体会话是否和普通用户/群聊区分。

---

## 相关代码

`sections/im_web` 参考位置：

```text
sections/im_web/apps/chat/src/components/MessageInput.vue:102-113
- 识别 Clowder AI 联系人和 Clowder cat 直聊。

sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts:122-134
- normalizeAgentDirectory：区分 available/unavailable/preferred/lastActive。

sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts:675-714
- loadAgentDirectory：按 conversation ref 加载智能体目录。

sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts:716-901
- cat directory、roleTemplates、connectedCatContacts 归一化。

sections/im_web/packages/contacts-vue/src/views/ContactList.vue:16-25, 222
- 联系人页把 Clowder 猫猫联系人纳入展示。
```

---

## 根因分析

如果只依赖普通 contact/group store，会漏掉系统智能体和 Clowder 虚拟联系人。需要建立统一 agent identity 规则：系统账号、robot category、Clowder connector、cat contact id 都应进入智能体目录。

---

## 问题列表（Q&A 迭代）

### Q1: 智能体页显示普通机器人吗？
**A1**: 应显示系统/AI/Clowder 机器人，但需要标注来源和可用状态。

### Q2: 不可用智能体是否显示？
**A2**: 可显示，但必须有 unavailable state 和原因。

---

## 修复记录

待修复。

---

## 测试结果

建议新增 agent directory normalizer 测试和智能体页 smoke。

---

## 关闭备注

关闭前需验证系统智能体、Clowder AI、已连接猫猫均可见。
