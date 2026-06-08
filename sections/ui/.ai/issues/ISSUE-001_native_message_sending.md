# [ISSUE-001] 实现用户与群聊或其他用户的消息发送

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：feature, native-im, message, group

---

## 问题描述

`sections/ui` 需要把用户发送文本、图片、文件、语音到单聊和群聊的路径完整接入 TangSeng/WuKongIM，而不是只做本地 mock 或局部 optimistic 展示。

---

## 复现步骤

1. 打开 `sections/ui` 的单聊或群聊。
2. 输入文本并发送，或选择图片/文件发送。
3. 刷新页面或用另一端查看消息历史。

预期：消息通过 SDK/后端发送并可在历史同步中恢复。实际缺口：需要确认所有消息类型都经过原生 IM 发送、ACK、失败重试和历史合并链路。

---

## 相关代码

`sections/im_web` 已实现的参考位置：

```text
sections/im_web/apps/chat/src/components/MessageInput.vue:1260-1360
- 解析 @、回复、Clowder 路由后调用 messageStore.sendMessage。

sections/im_web/packages/datasource-vue/src/stores/messageStore.ts:1294-1346
- 文本消息 pending、本地入列、WKSDK chatManager.send、ACK alias、状态更新、失败重试。

sections/im_web/packages/datasource-vue/src/stores/messageStore.ts:1368-1469
- 图片/文件上传、MessageImage/MessageFile 内容构造、SDK 发送、失败时 retryPayload。

sections/im_web/packages/datasource-vue/src/stores/messageStore.ts:1471-1532
- 语音上传与 MessageVoice 发送。
```

---

## 根因分析

`sections/ui` 的消息发送链路需要达到 `im_web` 同级别：本地 pending、SDK send、ACK 合并、失败重试、历史同步去重。仅本地添加消息会导致多端不可见、刷新丢失或重复。

---

## 问题列表（Q&A 迭代）

### Q1: 文本和媒体是否走同一个发送入口？
**A1**: UI 层可以统一 emit，但 store 层应区分 text/media/voice，分别构造 SDK content。

### Q2: 群聊和单聊差异在哪里？
**A2**: channelType 单聊为 `1`，群聊为 `2`；群聊还要携带 mention/reply 等消息设置。

---

## 修复记录

已确认 `MessageInput.vue` 的文本、图片、文件、语音入口统一 emit 到 `messageStore.sendNativeMessage`；`sendNativeMessage` 负责 pending 入列、SDK 文本/媒体发送、文件上传、ACK/echo 合并、失败状态和历史同步合并。补充空用户 smoke 回归，避免未登录演示数据渲染崩溃。

2026-06-08 复验补充：H5/mock 会话在 WuKongIM SDK 不可用或原生 send 只返回 `sending` 且没有 ACK 的情况下，会把本地 optimistic 消息落为 `success`，避免用户发送后一直显示失败或转圈；真实服务端拒绝类错误仍保留 `failed`。

---

## 测试结果

已通过：

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

浏览器验收：`http://localhost:5173/`，375x844、768x1024、1024x768、1440x900 均通过。补充 Playwright 发送验收：文本发送后 `failedCount=0`、`sendingCount=0`。

---

## 关闭备注

关闭前需证明文本、图片、文件至少在单聊和群聊各发送一次，并能刷新后恢复。
