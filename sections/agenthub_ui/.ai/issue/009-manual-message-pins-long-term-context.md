# 009 - Manual Message Pins as Long-Term Context

**状态**：Open
**创建时间**：2026-06-08
**标签**：feature / context / memory / UX
**优先级**：P1

---

## 问题描述

AgentHub 当前已经有会话置顶和自动上下文锚点能力，但用户还不能在聊天流里手动把某条关键消息标记为“长期上下文”。这会让关键约束、决策、任务边界、设计结论在后续压缩、冷启动、跨 agent 接力时继续依赖自动检索或人工重复说明。

需要新增“手动 pin 关键消息作为长期上下文”的产品闭环：用户在消息上执行 pin 后，该消息应在当前 thread / 会话维度持久保存，并在后续 agent context assembly 中作为高优先级、可解释、可撤销的上下文来源出现。

这不是普通“收藏消息”，也不是“会话置顶”。它的核心语义是：这条消息对后续推理有长期约束力，系统应该优先带给 agent，并在 UI 上让用户知道哪些内容正在影响猫猫的上下文。

---

## 复现步骤

1. 打开一个 Clowder 项目群聊或普通聊天。
2. 找到一条包含关键约束或决策的历史消息，例如“这次不要改后端 API，只调前端 wiring”。
3. 尝试通过消息菜单将其 pin 为长期上下文。
4. 当前没有可见入口、持久状态、pin 列表或 context briefing 反馈，后续 agent 冷启动时也无法确认该消息被稳定注入。

---

## 相关代码

```text
sections/agenthub_ui/api/sync.js
  syncApi.pinMessage(data) -> POST message/pinned

sections/agenthub_ui/stores/message.js
  state.pinnedMessages exists, but no pin/unpin action or hydration path is wired.

sections/clowder-ai/docs/features/F148-hierarchical-context-transport.md
  Existing automatic anchors select top omitted messages, but there is no user-controlled durable pin source.

sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/context-transport.ts
  selectAnchors()/formatAnchors() handle automatic anchors only.
```

---

## 根因分析

当前缺的是端到端语义闭环，而不是单个按钮：

1. UI 层没有在消息上下文菜单 / 移动端长按菜单里暴露“pin 为长期上下文”。
2. Store 层虽然预留了 `pinnedMessages`，但没有 `pinMessage` / `unpinMessage` / `syncPinnedMessages` 等 action。
3. API 层只有 `POST message/pinned` 调用入口，缺少前端可依赖的读取、撤销、错误恢复和乐观更新契约说明。
4. Context 层的 F148 anchors 是自动选择的临时锚点，无法表达用户显式指定的长期约束。
5. UI 没有展示“哪些 pinned 消息正在进入上下文”，用户无法审计或撤销长期影响源。

---

## 需求建议

### 产品语义

- 用户可以在消息菜单中执行“Pin 为长期上下文”。
- 已 pin 消息在消息气泡上有轻量标识，避免和普通收藏、会话置顶混淆。
- 当前会话 / thread 有一个 pinned context 列表入口，支持查看来源、创建时间、创建人、原消息跳转和取消 pin。
- 取消 pin 后，该消息不再作为长期上下文注入，但历史消息本身不被删除。

### Context 注入规则

- Manual pins 优先级高于自动 anchors，但必须有 token 上限和条数上限。
- 建议默认每个 thread 最多注入最近更新的 5 条 manual pins；超出时 UI 明确提示“仍已保存，但本轮上下文只带入前 N 条”。
- Manual pins 应在 context briefing / navigation header 中可见，至少显示数量和展开后的消息摘要。
- 被撤回、删除或权限不可见的消息不能继续注入，应显示降级状态。

### 数据契约

建议 pinned context 记录至少包含：

```ts
type ManualContextPin = {
  id: string;
  threadId?: string;
  channelId: string;
  channelType: number;
  messageId: string;
  messageSeq?: number;
  clientMsgNo?: string;
  contentExcerpt: string;
  senderName?: string;
  pinnedBy: string;
  pinnedAt: string;
  updatedAt: string;
  status: 'active' | 'removed' | 'source_deleted' | 'permission_denied';
};
```

### 非目标

- 不做全局知识库收藏夹。
- 不把所有 pin 都永久塞进 prompt；注入必须受预算和可见性控制。
- 不让 agent 自己静默创建长期 pin；首版只支持用户显式操作，后续可再讨论“agent 建议 pin，用户确认”。

---

## 验收标准

1. 桌面右键菜单和移动端长按菜单都能 pin / unpin 支持的消息。
2. 已 pin 消息刷新页面后仍保持状态。
3. 会话内能查看 pinned context 列表，并能跳转到原消息。
4. 后续触发 Clowder agent 时，manual pins 会作为独立上下文来源进入 context assembly，且优先于自动 anchors。
5. Context briefing 或等价 UI 能显示 manual pins 的数量和摘要，用户可审计“系统给猫带了什么”。
6. 删除 / 撤回 / 无权限消息不会继续注入，并在列表中显示明确降级状态。
7. 单元测试覆盖 store action、API adapter、context selection 优先级和删除降级；H5 smoke 覆盖 pin、刷新、unpin 主路径。

---

## 问题列表（Q&A 迭代）

### Q1: 这和会话置顶有什么区别？

**A1**: 会话置顶是注意力排序；manual context pin 是 prompt / context 语义来源。两者 UI 标识和数据字段都应分离。

### Q2: 这和 F148 automatic anchors 有什么区别？

**A2**: F148 anchors 是系统从 omitted history 中自动挑出的临时高价值消息；manual pins 是用户显式声明的长期约束，应稳定保存、可审计、可撤销。

### Q3: 首版是否需要支持跨 thread pin？

**A3**: 不建议。首版限定在当前会话 / thread 内，避免权限、预算和语义边界过大。跨 thread context bridge 可作为后续独立需求。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm lint && pnpm test:unit` | Pending |
| Layer 2 Component | Message context menu pin/unpin state | Pending |
| Layer 3 Store | `pinnedMessages` hydration + optimistic update + rollback | Pending |
| Layer 5 E2E | H5 pin -> refresh -> context briefing visible -> unpin | Pending |

---

## 实施发现记录

### 2026-06-08 Task 0 - Clowder thread binding 契约

`sections/agenthub_ui/stores/clowder.js` 已有 `fetchBinding(channelId, channelType)`，通过 `clowderApi.getConversationState()` 缓存 `conversations[channelId-channelType]` 与 `bindings[channelId-channelType]`。

`sections/agenthub_ui/components/chat/RightWorkspace.vue` 已有 thread id 解析逻辑：优先读取 `binding.threadId / thread_id / projectThreadId / project_thread_id`，并在群聊项目空间 hydration 时先查 `fetchBinding()`，必要时再用 `fetchActiveProjectGroup({ projectGroupNo })` 补充项目群绑定。

Issue 009 实施沿用该契约：能解析出 thread id 时把 message pin mirror 到 Clowder manual context pins；没有绑定时只走 IM `message/pinned` 并在 pinned context panel 显示“未绑定 Clowder thread，不进入长期上下文”。

---

## 修复记录

暂无。此 issue 用于立项和实现追踪。

---

## 测试结果

```bash
# Not run: issue proposal only.
```

---

## 关闭备注

待实现后补充 PR、截图证据和 context assembly 验证记录。
