# [ISSUE-001] 实现用户与群聊或其他用户的消息发送

**状态**：Open
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

待修复。

---

## 测试结果

建议新增：

```bash
npm run test:native-im
npm run test:smoke
npm run build:h5
```

---

## 关闭备注

关闭前需证明文本、图片、文件至少在单聊和群聊各发送一次，并能刷新后恢复。
