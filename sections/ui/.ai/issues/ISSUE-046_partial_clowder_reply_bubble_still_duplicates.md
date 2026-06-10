# [ISSUE-046] 半截 Clowder 回复气泡仍会与最终回复重复

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：bug / regression / clowder / message-dedupe / ui
**AI修复模式**：Direct Fix
**计划路径**：N/A
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- Direct Fix 必须使用 TDD：先补/确认失败回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 Playwright 实测。
- 测试截图、日志和结果 JSON 必须保存到 `sections/ui/.ai/tests/ISSUE-046-<timestamp>/`。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

用户反馈“回复气泡依旧重复”。截图中同一轮 QQ 智能体回复出现两条气泡：

1. 第一条是未完成的半截回复，尾部停在“智能”附近。
2. 第二条是同一回复的完整最终内容。

这说明 ISSUE-043 中“相同内容 durable 回复去重”只覆盖了完全相同文本，未覆盖流式半截气泡被最终 durable 回复回放覆盖的场景。

---

## 复现步骤

1. 打开 Clowder 智能体直聊。
2. 触发智能体回复。
3. WebSocket / 本地流式阶段先显示半截回复。
4. 后端随后同步同一发送者、同一时间窗口内的最终 durable 回复。
5. 观察聊天区出现半截回复和完整回复两条气泡。

---

## 相关代码

```text
sections/ui/services/native-im/message-state.js
- findEquivalentClowderReplyIndex(...)
- mergeNativeMessageIntoList(...)

sections/ui/tests/native-im.test.mjs
- native clowder final durable reply replaces partial streamed bubble
```

---

## 根因分析

`findEquivalentClowderReplyIndex(...)` 原先要求 Clowder 回复的 `contentKey` 完全相等才合并：

```text
contentKey(candidate) === contentKey(incoming)
```

真实流式场景中，先到的气泡可能只有最终内容的前缀，例如：

```text
...内容涉及长期上下文接口、智能
```

最终 durable 回复则是：

```text
...内容涉及长期上下文接口、智能体消息修复、Clowder 直聊名称退化等。需要 push 吗？
```

两者 ID 不同、文本不完全相同，因此绕过去重逻辑，被追加成两条气泡。

---

## 修复记录

### 2026-06-10

已完成以下修复：

1. `sections/ui/tests/native-im.test.mjs`
   - 新增回归测试 `native clowder final durable reply replaces partial streamed bubble`。
   - 测试先喂入半截 Clowder 回复，再喂入同一发送者的最终 durable 回复，要求消息列表只保留一条最终回复。
   - TDD 红灯曾复现为 `2 !== 1`，说明旧逻辑确实保留了两条消息；修复后该测试通过。

2. `sections/ui/services/native-im/message-state.js`
   - 新增 Clowder 回复内容可比对文本归一化，去除流式光标并压缩空白。
   - 在 Clowder 专用等价判断中支持“短文本是长文本稳定前缀”的半截/最终回复合并。
   - 限定条件包括：Clowder 会话、同一非自己发送者、文本消息、48 字以上前缀、35% 以上覆盖率、10 分钟时间窗口。
   - durable 最终回复覆盖半截气泡时，将 `streaming` 明确置为 `false`，避免 UI 保持半截流式态。

---

## 测试结果

证据目录：

```text
sections/ui/.ai/tests/ISSUE-046-20260610214607/
```

已通过命令：

```bash
cd sections/ui
npm run test:native-im
npm run build:h5
node .ai/tests/ISSUE-046-20260610214607/verify-partial-duplicate-bubble.mjs
```

关键证据：

- `npm-test-native-im.log`：103 个 native-im 测试通过。
- `npm-build-h5.log`：H5 build 通过，仅有既有 uni/Sass warning。
- `playwright-verify.log`：桌面和移动端均通过，store 中只保留 1 条最终回复，DOM 中也只渲染 1 条最终回复。
- `result.json`：`pass: true`。
- `desktop-01-partial-dedupe-chat.png`：桌面 viewport 中只出现一条 QQ 回复气泡。
- `mobile-01-partial-dedupe-chat.png`：移动 viewport 中只出现一条 QQ 回复气泡，输入区无遮挡。

---

## 关闭备注

已关闭。半截 Clowder 回复与最终 durable 回复现在会在消息状态层合并为一条最终气泡，不会再因为文本不完全相等而重复渲染。
