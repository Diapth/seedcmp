# ISSUE-032 删除智能体及关联数据清理实施计划

**Issue**：`sections/ui/.ai/issues/ISSUE-032_delete_agent_and_related_data.md`
**Goal**：为 `sections/ui` 增加删除 Clowder 智能体入口、远端 `DELETE clowder/cats/:catId` 调用和本地会话/消息/群成员清理策略。
**AI修复模式**：Plan First
**前端验证**：Yes，必须覆盖桌面 Web viewport 和移动端 viewport。
**非目标**：不默认删除群聊历史发言；不在远端 delete 成功前乐观移除本地智能体。

---

## 现象与根因

`sections/ui` 迁移了创建、配置、直聊和群成员添加，但没有迁移 `im_web` 的 `deleteCatContact` 生命周期。缺少 service、store cleanup 和危险操作 UI。

## 受影响模块

- `sections/ui/services/native-im/service.js`
- `sections/ui/stores/agent.js`
- `sections/ui/stores/conversation.js`
- `sections/ui/stores/message.js`
- `sections/ui/pages/agents/new.vue`
- `sections/ui/components/agents/AgentCard.vue`（可选第二入口）
- `sections/ui/tests/native-im.test.mjs`

参考：

- `sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue`
- `sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts`
- `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`

## 推荐设计

第一阶段只在 `pages/agents/new.vue` 编辑态增加危险区。用户输入智能体名称、alias 或 catId 才能确认，可勾选“同时删除直聊会话和聊天记录”。默认语义与 `im_web` 对齐：删除联系人/路由目标，历史消息保留；用户显式勾选后才清理直聊消息。

Store action：

```text
agentStore.deleteAgent(agentId, options)
  -> resolve catId
  -> nativeImService.deleteClowderCat(catId)
  -> remove agent from agentStore.agents
  -> conversationStore.cleanupAgentReferences(agent, options)
  -> messageStore.clearConversationMessages(conversationId) if selected
```

系统/官方智能体禁用删除。

## 阶段计划

### Phase 1：service 与 cleanup 红绿测试

**Files**

- Modify: `sections/ui/services/native-im/service.js`
- Modify: `sections/ui/stores/agent.js`
- Modify: `sections/ui/stores/conversation.js`
- Modify: `sections/ui/stores/message.js`
- Test: `sections/ui/tests/native-im.test.mjs`

**TDD**

1. 新增失败测试：
   - `native service deletes clowder cat contact`
   - `agent store does not prune local agent when remote delete fails`
   - `agent cleanup removes direct conversation and group agent members`
   - `message store clears direct messages only when requested`
2. 运行 `npm run test:native-im`，确认缺失失败。
3. 实现：
   - `nativeImService.deleteClowderCat(catId)`
   - `messageStore.clearConversationMessages(conversationId)`
   - `conversationStore.cleanupAgentReferences(agent, options)`
   - `agentStore.deleteAgent(agentId, options)`
4. 再跑 `npm run test:native-im`。

**阶段提交示例**：`实现智能体删除与本地清理`

### Phase 2：危险区 UI 与导航

**Files**

- Modify: `sections/ui/pages/agents/new.vue`
- Optionally modify: `sections/ui/components/agents/AgentCard.vue`

**TDD / Implementation**

1. 编辑态底部新增危险区：
   - 删除按钮
   - 影响范围说明
   - 确认输入
   - 清理直聊记录 checkbox
   - loading 和失败状态
2. 禁止删除系统/官方智能体。
3. 删除成功后跳回智能体列表；若当前 active conversation 被删除，清空 activeId。
4. 删除失败保留本地智能体并展示错误。

**阶段提交示例**：`增加智能体删除确认入口`

### Phase 3：浏览器验证与证据

**Verification**

```bash
cd sections/ui && npm run test:native-im
cd sections/ui && npm run build:h5
PATH=/home/yunyi/go1.22/go/bin:$PATH bash scripts/start-im-clowder.sh start
```

证据目录：

```text
sections/ui/.ai/tests/ISSUE-032-<timestamp>/
```

必须保存：

- `desktop-1440x900-delete-dialog.png`
- `desktop-1440x900-agent-list-after-delete.png`
- `mobile-375x844-delete-dialog.png`
- `mobile-375x844-agent-list-after-delete.png`
- `browser-console.json`
- `request-log.json`
- `result.json`

**阶段提交示例**：`完成智能体删除浏览器验收`

## 风险与回滚

- 404 可按“远端已不存在”继续 prune，但必须记录 warning；非 2xx 不 prune。
- 群聊历史默认保留，避免破坏多人上下文。
- 回滚可移除危险区入口和 store action，service wrapper 本身无副作用。

## Done

- 智能体可删除且误触有二次确认。
- 删除后从列表、建群候选、群成员和 `@` 候选消失。
- 可选清理直聊消息。
- ISSUE-032 文档更新为 `Resolved`，含证据路径和验证命令。
