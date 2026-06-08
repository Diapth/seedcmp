# [ISSUE-007] 实现智能体的添加功能

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：feature, clowder, agent, onboarding
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-007_agent_addition_flow.md

---

## 问题描述

智能体页需要提供新增智能体入口，支持选择角色模板、运行平台、认证方式、账号引用、模型、能力标签，并创建后连接为可直聊/可入群的智能体。

---

## 复现步骤

1. 打开智能体页。
2. 点击新增智能体。
3. 选择模板、平台、认证方式并创建。
4. 创建成功后应进入该智能体直聊，并能在群聊添加。

---

## 相关代码

`sections/im_web` 参考位置：

```text
sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue:15-25
- 新增猫猫表单字段：模板、平台、authType、accountRef、defaultModel、能力。

sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue:83-88
- canCreate 校验。

sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue:243-271
- createCatAndConnect 创建并连接，成功后打开直聊。

sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue:289-412
- 新增猫猫 UI：模板、平台、OAuth/API Key、模型、能力标签。

sections/im_web/packages/datasource-vue/src/api/clowder.ts:629
- clowderApi.createCatAndConnect。

sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts:1011-1027
- store 创建并连接 cat contact。
```

---

## 根因分析

添加智能体涉及后端凭据/账号，不应在浏览器保存秘密。前端只提交 `authType/accountRef/defaultModel` 等意图字段，由后端安全处理。

---

## 问题列表（Q&A 迭代）

### Q1: API Key 是否在前端输入？
**A1**: 可以输入账号引用，不建议把密钥持久化在浏览器。

### Q2: Codex/Claude OAuth 怎么处理？
**A2**: 参考 im_web 的本机 OAuth capability 检查，只展示状态与引导命令。

---

## 修复记录

新建智能体后不再只回到列表：`pages/agents/new.vue` 会创建智能体、同步 robot 直聊会话、设置 active conversation，并跳转到 `/pages/chat/detail?id=<agentId>`。群成员添加页可继续将该智能体加入群聊。

---

## 测试结果

已通过 agent helper 单测和浏览器四视口验收，新建智能体表单可达，智能体页/群成员页可达。`npm run test:native-im`、`npm run build:h5`、`npm run test:smoke` 通过。

---

## 关闭备注

关闭前需通过至少一种平台创建一个智能体并在智能体页/群成员添加页可见。
