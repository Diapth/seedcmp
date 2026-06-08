# [ISSUE-003] 实现群聊和单人聊天会话的时间显示

**状态**：Resolved
**创建时间**：2026-06-08
**标签**：feature, ui, conversation, time

---

## 问题描述

单聊和群聊需要在会话列表展示最近消息时间，在消息列表按时间间隔插入时间分割。时间显示必须兼容秒级/毫秒级 timestamp。

---

## 复现步骤

1. 打开会话列表。
2. 查看单聊、群聊、智能体会话右侧时间。
3. 进入会话，查看跨 5 分钟或跨天消息是否显示时间分割。

---

## 相关代码

`sections/im_web` 参考位置：

```text
sections/im_web/apps/chat/src/views/ConversationList.vue:444
- 会话列表使用 formatConversationTime(conv.last_msg_time)。

sections/im_web/apps/chat/src/components/MessageList.vue:269-273
- shouldShowTime：首条消息显示时间，后续相差超过 300 秒显示时间。

sections/im_web/apps/chat/src/components/MessageList.vue:1641
- TimeCell 插入消息时间分割。

sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts:475, 536, 917-974
- conversation last_msg_time 规范化、排序和收到新消息后的更新时间。
```

---

## 根因分析

时间显示缺失通常来自两个问题：一是 store 未把后端 `last_msg_time/timestamp` 标准化，二是 UI 只显示消息内容没有插入时间分割组件。

---

## 问题列表（Q&A 迭代）

### Q1: 时间单位用秒还是毫秒？
**A1**: 后端常见为秒，浏览器 Date 常用毫秒；需要统一工具函数自动识别并格式化。

### Q2: 群聊和单聊时间规则是否不同？
**A2**: 不同的是 sender 展示，时间分割规则可共用。

---

## 修复记录

新增 `normalizeTimestampMs` 并复用到聊天/会话时间格式化，秒级和毫秒级 timestamp 都会正确显示；消息时间分割阈值按 issue 调整为 5 分钟。浏览器验收同时覆盖消息列表时间分割不会出现 1970 年错误。

---

## 测试结果

已新增秒/毫秒时间格式化和 5 分钟分割测试；`npm run test:native-im` 通过。`npm run build:h5`、`npm run test:smoke` 和四视口浏览器验收通过。

---

## 关闭备注

关闭前需验证列表时间、消息分割时间、跨天格式和空时间兜底。
