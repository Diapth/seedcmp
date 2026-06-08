# [ISSUE-016] 群聊 @ 消息未高亮且会话列表缺少 [有人@我] 提示

**状态**：Open
**创建时间**：2026-06-09
**标签**：bug / group-chat / mention / h5
**AI修复模式**：Direct Fix
**计划路径**：N/A

---

## 问题描述

使用 `sections/ui` 在 `http://100.79.157.76:5173/` 验收账号 `18337488675` 与 `13733632709` 的群聊 @ 功能时，@ 消息能送达接收方，但未满足两个展示要求：

1. 聊天气泡内的 `@leng_test_updated` 没有高亮。
2. 被 @ 用户的会话列表未显示 `[有人@我]` 提示，只显示普通文本预览。

本次证据目录：

`seedcmp/sections/ui/.ai/tests/ui-group-deep-20260608160100/`

关键截图：

1. `07-a-received-at.png`
2. `08-a-list-after-at.png`

验收群：

`UI深验群-160100` (`bdf86561b2474bc182af597fe77442d3`)

---

## 复现步骤

1. 启动 `sections/ui` H5 并打开 `http://100.79.157.76:5173/`。
2. 使用 `13733632709` 与 `18337488675` 分别登录。
3. 创建或打开同时包含两个账号的群聊。
4. 由 `13733632709` 在群里发送 `@leng_test_updated AT验收 20260608160100`。
5. 在 `18337488675` 端查看消息气泡和会话列表。

---

## 相关代码

```js
// sections/ui/services/native-im/normalizers.js
const mention = raw.mention || input.mention || {};
const mentions = Array.isArray(mention.uids) ? mention.uids.map(String) : [];
```

```vue
<!-- sections/ui/components/chat/MessageBubble.vue -->
const sorted = [...mentions].sort((a, b) => a.offset - b.offset);
for (const m of sorted) {
  const start = m.offset;
  const matchText = `@${m.name}`;
  segments.push({ text: text.slice(start, start + matchText.length), mention: true });
}
```

```js
// sections/ui/pages/chat/detail.vue
mentions.push({ userId: m.id, name, offset: atIdx });
```

---

## 根因分析

本地发送时 `pages/chat/detail.vue` 解析出的 `mentions` 是 `{ userId, name, offset }` 对象数组；但从原生 IM 同步回来的消息在 `normalizers.js` 中被规整为 uid 字符串数组。`MessageBubble.vue` 渲染高亮时依赖 `name` 和 `offset`，因此同步消息无法命中高亮逻辑。

会话列表的 `[有人@我]` 提示也没有基于当前登录用户 uid 判断 mention 状态。验收文本中会话预览显示为：

```text
989ec1fc79664ede9ff9008831d76337: @lengtestupdated AT验收 20260608160100
```

但没有出现 `[有人@我]`。

---

## 问题列表（Q&A 迭代）

### Q1: @ 消息是否完全没送达？
**A1**: 不是。`@ mention delivered to A` 断言通过，失败点是气泡高亮和会话列表提醒。

### Q2: 是否只影响新建群？
**A2**: 暂未确认。当前证据来自真实 API 新建群 `UI深验群-160100`，根因位于通用消息同步和气泡渲染链路，可能影响所有真实群聊同步消息。

### Q3: 期望行为是什么？
**A3**: 被 @ 用户收到群消息后，消息气泡中的 @ 片段应高亮；会话列表应展示 `[有人@我]` 或等价提醒。

---

## 修复建议

1. 统一本地发送与 IM 同步后的 `mentions` 数据结构，至少保留 `userId`、`name`、`offset`，或在渲染前通过群成员表补全。
2. 会话摘要生成时识别当前用户是否在 mention uid 列表中，并为群会话设置 `[有人@我]` 提示状态。
3. 增加双账号回归：B @ A 后，A 端气泡高亮且会话列表出现 `[有人@我]`。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://100.79.157.76:5173' \
     API_BASE='http://100.79.157.76:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-group-deep.js

# exit 1
# PASS: @ mention delivered to A
# FAIL: @ mention highlighted in message bubble
# FAIL: conversation list shows [有人@我] mention reminder
```

---

## 关闭备注

待修复后复测：`18337488675` 被 `13733632709` 在同一群聊 @ 时，消息气泡高亮 @ 片段，且会话列表显示 `[有人@我]` 提示。
