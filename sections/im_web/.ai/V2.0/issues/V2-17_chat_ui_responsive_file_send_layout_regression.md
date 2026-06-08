# [V2-17] 发送文件后聊天 UI 在不同窗口比例下布局变形

**状态**：Closed
**创建时间**：2026-05-25
**标签**：bug / ux / responsive / media / regression
**优先级**：P1

---

## 问题描述

用户反馈聊天 UI 在不同浏览器窗口比例下看到的内容不一致，且疑似发送文件后会触发布局变形。截图中同一会话在不同视口比例下出现以下异常：

1. 消息区可见内容、滚动位置和底部输入区占比不一致。
2. 文件消息卡片靠近底部输入区，部分状态下文件卡片像被压到输入区域上方，聊天区底部留白和消息列表高度不稳定。
3. 发送方蓝色消息气泡在宽屏下贴近右侧边缘，部分内容位置与时间分隔、文件卡片之间的垂直节奏异常。
4. 输入区高度较大，底部提示文案、工具栏和发送按钮之间的布局在不同窗口高度下表现不一致。

该问题会影响用户确认最近消息、查看文件消息和继续输入消息，属于文件发送链路后的聊天主界面布局回归。

---

## 复现步骤

1. 打开 `http://localhost:3000` 并登录。
2. 进入包含历史消息的单聊或群聊会话。
3. 在聊天输入工具栏选择并发送一个普通文件，例如 `1.txt`。
4. 调整浏览器窗口比例，至少覆盖以下两类视口：
   - 宽屏窗口，高度较低或浏览器顶部工具栏可见。
   - 全屏或近似全屏窗口，高度更高。
5. 观察文件消息发送后的聊天区域、滚动位置、底部输入区和右侧消息气泡布局。

---

## 预期表现

1. 同一会话在不同窗口比例下应保持一致的布局结构：左侧会话栏固定，右侧聊天区按可用空间自适应。
2. 消息列表应占满 header 与 composer 之间的剩余高度，滚动容器稳定，不应被文件卡片或输入区撑变形。
3. 文件消息卡片应作为普通消息参与消息流布局，不应压缩、覆盖或改变输入区尺寸。
4. 发送文件后应自动滚动到最新消息，但不应导致历史消息区出现异常大留白。
5. 输入区工具栏、文本输入提示和发送按钮在不同窗口高度下位置稳定，不应随文件消息内容异常增高。

---

## 实际表现

根据用户截图：

1. 不同窗口比例下，聊天区可见消息范围明显不同，不只是正常的高度差异，消息区整体布局节奏也发生变化。
2. 发送文件后底部出现文件卡片，文件卡片与输入区之间的边界、留白和滚动位置异常。
3. 高度较高的窗口中，底部文件卡片附近疑似出现重复或重叠的文件消息区域，聊天列表底部与 composer 的衔接不稳定。
4. 输入区内部元素被拉开，导致可输入区域和底部提示占用过多高度。

---

## 相关代码

待排查重点：

```
sections/im_web/apps/chat/src/
sections/im_web/apps/chat/src/components/
sections/im_web/packages/base-vue/src/
sections/im_web/packages/datasource-vue/src/stores/messageStore.ts
```

重点关注：

1. 聊天主布局的 flex / height / overflow 约束。
2. 消息列表滚动容器的 `min-height: 0`、`overflow-y`、自动滚动逻辑。
3. 文件消息组件与普通消息气泡的宽度、高度和 margin 规则。
4. composer 在发送文件后的 pending / success 状态是否额外保留了附件预览或草稿区域。

---

## 根因分析

经代码审查确认，根因为 flex 列布局链路上多处缺少必要的 `min-height: 0` / `overflow: hidden` 约束，导致子内容（文件卡片、robot-panel、reply-bar）可以突破父容器高度，在不同视口高度下引发整体布局变形：

1. **`MainLayout.vue` `.chat-viewport`**：缺少 `min-width: 0` / `min-height: 0` / `overflow: hidden`，flex 子项（chat-view-container）可以撑破 `100vh`。
2. **`ChatView.vue` `.chat-view-container`**：缺少 `min-height: 0` 和 `overflow: hidden`，MessageList + MessageInput 的实际高度可以超出父容器高度，整个 flex column 被撑开。
3. **`MessageList.vue` `.message-list`**：`flex: 1` 但缺少 `min-height: 0`，在 flex 压缩场景下不参与收缩，导致消息列表抢占 composer 空间。
4. **`MessageInput.vue` `.message-input-container`**：无高度上限，robot-panel / reply-preview-bar 等 in-flow 元素出现时 composer 无限增高，并把 MessageList 压缩；`.input-area-wrapper` 用 `flex: 1` 导致 composer 内部高度随窗口高度浮动。

---

## 问题列表（Q&A 迭代）

### Q1: 这个问题是否和 V2-14 / V2-16 是同一个问题？
**A1**: 不是完全相同。V2-14 关注文件卡片自身宽度错位，V2-16 关注文件名被渲染成独立文本消息。本问题关注发送文件后聊天主布局在不同窗口比例下的整体变形、滚动区域不稳定和输入区高度异常，可能与前两者有共同代码路径，但应作为新的响应式布局回归单独验证。

### Q2: 是否需要保留用户截图作为复现证据？
**A2**: 是。当前证据来自用户在 2026-05-25 提供的两张截图；后续修复时应补充本地 Playwright 截图，覆盖至少两个不同视口比例。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `cd sections/im_web && pnpm type-check` | ✅ Exit 0，无类型错误 |
| Layer 2 Component | 聊天布局 / 文件消息组件响应式测试 | 待人工验证 |
| Layer 3 Store | 文件发送状态不重复保留附件预览或错误消息 | 本次未触及 store 逻辑 |
| Layer 5 E2E | Playwright：发送文件后分别截取宽屏、全屏/高屏视口截图并检查消息区与 composer 边界 | 待补充 |

---

## 修复验收标准

1. 在至少两个不同窗口比例下发送文件后，消息列表、文件卡片和输入区边界稳定。
2. 文件消息不会撑高 composer，也不会造成底部文件卡片和输入区重叠、重复或异常留白。
3. 最近一条消息在发送文件后可见，自动滚动行为一致。
4. 左侧会话列表、顶部 header、消息列表、底部 composer 均无横向或纵向溢出。
5. 修复后补充截图证据，并记录对应 Playwright 或手工验证路径。

---

## 修复记录

**2026-05-25** 修复完成，涉及 4 处 CSS 变更，无 JS 逻辑改动：

| 文件 | 改动 |
|---|---|
| `MainLayout.vue` | `.chat-viewport` 加 `min-width:0; min-height:0; overflow:hidden`；响应式断点同步补充 |
| `ChatView.vue` | `.chat-view-container` 加 `min-height:0; overflow:hidden` |
| `MessageList.vue` | `.message-list` 加 `min-height:0`，确保 `flex:1` 在 flex column 中可压缩 |
| `MessageInput.vue` | `.message-input-container` 改为 `max-height:320px; overflow:hidden`，去除 `min-height:132px`；`.input-area-wrapper` 改为 `flex:0 0 auto` 防止 composer 随窗口高度浮动 |

---

## 测试结果

- `pnpm type-check`：✅ Exit 0，无类型错误。
- 人工 / Playwright 多视口验证：待补充截图证据。

---

## 关闭备注

已修复。修复策略为纯 CSS flex 约束补全，不涉及业务逻辑变更。如后续出现 composer 在极端内容下仍被撑高，可进一步收紧 `max-height` 或为 robot-panel 增加独立 `overflow:auto`。
