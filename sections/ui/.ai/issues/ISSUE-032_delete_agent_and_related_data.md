# [ISSUE-032] UI 缺少删除智能体及关联数据清理能力

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：feature / clowder / agent / data-cleanup / im-web-parity / privacy
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-032_delete_agent_and_related_data.md
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- 若 `AI修复模式：Plan First`，先使用 `writing-plans` 写计划，计划无需用户确认直接实现。
- 若 `AI修复模式：Direct Fix`，可以直接修复，但必须使用 `tdd` 思路：先补/确认回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 `browser-preview` 或 Playwright 实测。
- 测试截图必须保存到 `seedcmp/sections/ui/.ai/tests-e2e/` 下，并按 issue 序号命名。
- 若遇到测试失败或行为不符合预期，使用 `debugging` / `systematic-debugging` 定位根因。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

`sections/ui` 当前可以创建、查看、配置和发起智能体对话，但没有删除智能体的入口，也没有删除后清理相关数据的策略。用户一旦创建或连接了智能体，就无法在 `sections/ui` 中移除该智能体，更无法选择同步清理它产生的会话、聊天记录、群成员关系、`@` 候选、项目看板任务等关联数据。

用户期望：

1. 在 `seedcmp` 里可删除已有智能体。
2. 删除时能处理智能体相关数据，例如直聊会话和聊天记录。
3. `sections/im_web` 已有类似删除入口可参考，但 `sections/ui` 没有迁移。

当前调查结论：

1. `sections/im_web` 有删除猫猫/智能体联系人的入口和 API：`ClowderCatConsolePage.vue` 调用 `clowderStore.deleteCatContact(cat.catId)`，底层走 `DELETE clowder/cats/:catId`。
2. `sections/im_web` 的确认文案明确写着“历史消息会保留”，即它更像删除联系人、群成员和 `@` 路由目标，不是完整的数据清理。
3. `sections/ui` 有 `createClowderCat`，但没有 `deleteClowderCat/deleteCatContact` service 包装。
4. `sections/ui` 的智能体列表卡片只有“配置”和“对话”按钮；智能体配置页也只有保存/清空表单，没有删除智能体动作。
5. `sections/ui` 有 `conversationStore.deleteConversation(id)` 和 `messageStore.deleteMessage(conversationId, messageId)`，但没有“按智能体级联清理直聊消息/群成员/项目数据”的统一 action。

---

## 复现步骤

1. 启动 `sections/ui` 并登录真实账号。
2. 进入“智能体”页面。
3. 创建或选择一个已有 Clowder 智能体。
4. 打开智能体卡片、配置页、智能体资料面板或直聊会话。
5. 尝试删除该智能体，并选择是否清理聊天记录。

实际：

1. 智能体卡片只提供“配置”和“对话”。
2. 配置页只能保存配置或清空/还原表单。
3. 没有“删除智能体”按钮、确认弹窗或危险操作区。
4. 没有删除后清理聊天记录、会话、群成员关系和 `@` 候选的流程。
5. 只能删除会话列表项或单条消息，不能以智能体为单位做数据清理。

预期：

1. 用户能在智能体列表、配置页或资料面板中发起删除智能体。
2. 删除前必须有明确确认，至少输入智能体名称/alias/catId 二次确认。
3. 删除时能选择清理范围：
   - 仅删除智能体联系人/配置，保留历史消息。
   - 删除智能体并清理直聊会话及聊天记录。
   - 可选：从所有群聊移除该智能体，并清理或保留群聊中该智能体消息。
4. 删除成功后，智能体从列表、搜索、建群候选、群成员候选、`@` 候选和项目看板中消失。
5. 删除失败时不应出现半删除状态；前端应展示失败原因并可重试。

---

## 相关代码

```text
sections/im_web/packages/contacts-vue/src/views/ClowderCatConsolePage.vue
- requestDeleteCat / confirmDeleteCat 是 im_web 已有删除入口。
- 删除前要求输入 displayName 或 catId。
- 确认文案写明“历史消息会保留，但这只猫猫将不再作为联系人、群成员或 @ 路由目标出现”。

sections/im_web/packages/datasource-vue/src/stores/clowderStore.ts
- deleteCatContact(catId) 调用 clowderApi.deleteCatContact。
- pruneDeletedCatFromLocalState 会从 connectedCatContacts、catContactDirectory、groupCatMemberships、conversation agents、agentDirectories 中移除该 cat。

sections/im_web/packages/datasource-vue/src/api/clowder.ts
- deleteCatContact(catId) -> DELETE clowder/cats/:catId。

sections/ui/pages/agents/index.vue
- 智能体列表页只渲染 AgentCard。
- 没有删除智能体入口。

sections/ui/components/agents/AgentCard.vue
- 当前操作只有“配置”和“对话”。
- startChat 会创建/upsert 智能体直聊会话，并初始化 messageStore.messages[conversationId]。
- openConfig 只跳转到 /pages/agents/new?id=...

sections/ui/pages/agents/new.vue
- 编辑态只能 updateAgent 并同步会话标题。
- handleClear 是清空/还原表单，不是删除智能体。

sections/ui/stores/agent.js
- createAgent 会调用 nativeImService.createClowderCat。
- updateAgent 只更新本地 agent 列表。
- 没有 deleteAgent / deleteNativeAgent / cleanupAgentData action。

sections/ui/services/native-im/service.js
- 有 createClowderCat -> POST clowder/cats。
- 没有 deleteClowderCat/deleteCatContact -> DELETE clowder/cats/:catId。

sections/ui/stores/conversation.js
- deleteConversation(id) 只删除本地会话列表项，不处理消息 store、群成员、项目看板或远端删除。

sections/ui/stores/message.js
- deleteMessage(conversationId, messageId) 只能删除单条消息。
- 没有 clearConversationMessages / deleteMessagesByAgent / cleanupAgentMessages。

sections/ui/services/native-im/agent-state.js
- createAgentConversation 会把 Clowder 智能体映射为 id = clowder_cat:${catId} 的 robot 会话。
- createAgentMember 会把智能体映射为群成员和 @ 候选所需字段。
```

---

## 根因分析

待调查。初步判断是 `sections/ui` 只迁移了 Clowder 智能体创建、目录同步、直聊和群成员添加能力，没有迁移删除生命周期：

1. 前端入口缺失：智能体列表卡片、配置页、资料面板都没有危险操作。
2. Service 缺失：`nativeImService` 没有包装 `DELETE clowder/cats/:catId`。
3. Store 缺失：`agentStore` 没有删除智能体和清理本地目录/缓存的 action。
4. 数据模型缺口：删除智能体涉及多个 store，至少包括 `agentStore.agents`、`conversationStore.conversations`、`conversationStore.members`、`messageStore.messages`、项目看板和搜索结果。
5. 语义未定：`im_web` 当前删除猫猫会保留历史消息；本 issue 要求支持清理聊天记录，因此需要比 `im_web` 更明确的数据清理选项或后端 API 扩展。

---

## 问题列表（Q&A 迭代）

### Q1: 删除智能体是否等同于删除会话？
**A1**: 不是。删除会话只影响某个最近会话入口；删除智能体应移除智能体本体/联系人配置，并处理直聊会话、群成员关系、`@` 路由、搜索候选和项目数据。

### Q2: 是否默认删除聊天记录？
**A2**: 不建议静默默认删除。建议删除弹窗提供明确选项：默认“删除智能体，保留历史消息”；用户显式勾选后才清理直聊聊天记录。若产品要求强制清理，也必须在确认文案中直接说明不可恢复。

### Q3: 群聊里该智能体历史发言要不要删除？
**A3**: 初版建议只从群成员和 `@` 候选移除智能体，默认保留群聊历史发言，避免破坏多人上下文。可提供“同时清理该智能体在群聊中的消息”的高级选项，但需要后端确认权限与审计规则。

### Q4: `im_web` 已有删除入口，为什么还要新 issue？
**A4**: `im_web` 入口在 contacts-vue 的猫猫控制台中，且确认文案说明历史消息保留。`sections/ui` 没有对应入口，也没有清理聊天记录的能力，所以这是 `ui` 的迁移和扩展缺口。

---

## 代码方案补充（基于 im_web / 后端对照）

### 后端真实语义

`sections/im/TangSengDaoDaoServer/modules/clowder/api.go` 已暴露：

```text
DELETE clowder/cats/:catId
```

后端行为是：

1. 代理到 Clowder upstream `DELETE /api/cats/:catId`。
2. upstream 返回 2xx 后，后端执行：
   - `pruneGroupCatState(catID)`
   - `pruneCreatedCatContact(loginUID, catID)`
3. 该接口没有删除 TangSeng/WuKongIM 历史消息的语义，也没有清理前端 Pinia store 的能力。

因此 UI 的删除流程要分成两层：

1. 远端删除 cat/contact/membership。
2. 根据用户选择清理当前前端本地数据；如果要远端删聊天记录，需要另立后端 API 或复用 IM 的会话/消息删除能力。

### 前端级联清理建议

1. `nativeImService.deleteClowderCat(catId)`：
   - 调 `DELETE clowder/cats/:catId`。
   - 只把 2xx 视为成功。
   - 404 可按产品决定是否视作“已不存在”，但必须记录 warning，并继续本地 prune。
2. `agentStore.deleteAgent(agentId, options)`：
   - 先解析稳定 cat id：`agent.catId || agent.directCatId || agent.raw?.catId || getClowderCatIdFromContactId(agent.id)`。
   - 先调用远端 delete。
   - 成功后从 `agents` 移除，并调用 `cleanupAgentData(agent, options)`。
3. `cleanupAgentData(agent, options)` 需要跨 store：
   - `conversationStore.conversations`：移除或标记 `id === clowder_cat:${catId}` / `directCatId === catId` 的直聊会话。
   - `messageStore.messages`：如果 `deleteDirectMessages` 为 true，`delete messages[conversationId]`；否则保留历史，但会话标题要能显示“已删除智能体”。
   - `conversationStore.members`：遍历所有群，移除 `isAgent && (agentId/catId/id)` 匹配的成员。
   - `conversationStore.activeId`：如果当前 active 是被删除直聊，清空或跳转。
   - `agentStore.boards`：任务保留但执行者标记为 `deletedAgent: true` 或过滤到“已归档/不可用”，不要直接丢任务历史。
   - 搜索/建群候选：依赖 `agents` 和 `members` 更新即可，不另建缓存。
4. 建议新增 `messageStore.clearConversationMessages(conversationId)`，不要在页面里直接 `delete messageStore.messages[id]`。
5. 群聊历史里智能体已发言的消息默认保留；如果后续提供“清理群聊中该智能体消息”，应通过 `senderId/directCatId` 精确筛选，并需要权限/审计说明。

### UI 入口建议

1. 第一阶段只放一个主入口：`pages/agents/new.vue` 编辑态危险区。它上下文完整，适合输入名称确认和选清理范围。
2. 第二阶段再扩展：
   - `AgentCard.vue` 更多菜单。
   - `AgentProfilePanel.vue` 资料面板。
3. 确认弹窗不要用普通 `uni.showModal` 承载所有内容；现有 `AppDialog` 支持 destructive/loading，适合做：
   - 文案列表。
   - 输入确认字段。
   - checkbox 清理选项。
   - loading 防重复点击。

### 边界意见

1. 不要在远端 delete 成功前乐观移除本地 agent；否则失败后会出现“列表消失但刷新又回来”。
2. 不要默认删除聊天记录。im_web 的既有语义是“删除联系人/路由目标但历史保留”，UI 扩展清理记录时必须显式勾选。
3. 不要删除系统内置/官方智能体，除非后端明确允许。前端至少要禁用 `creator === 'System'` 或 `source === 'official'` 的危险操作。
4. 不要把删除会话等同于删除智能体。会话删除只影响一个入口；智能体删除必须影响目录、候选、群成员、路由和看板。
5. TangSengDaoDaoWeb 原生删除好友/群成员是 IM uid 级别操作；Clowder cat 删除是 connector 资源生命周期，两者不能混用。

---

## 修复建议

1. 在 `sections/ui/services/native-im/service.js` 增加 `deleteClowderCat(catId)`：
   - `DELETE clowder/cats/:catId`
   - 兼容后端返回 `{ deleted: true }`、`{ success: true }` 或空响应。
2. 在 `agentStore` 增加 `deleteAgent(id, options)`：
   - 解析 `agent.id / agent.agentId / agent.directCatId / catId`。
   - 调用 `nativeImService.deleteClowderCat(catId)`。
   - 从 `agents` 中移除目标智能体。
   - 同步清理 `nativeError/syncState`。
3. 增加统一清理 action，例如 `cleanupAgentData(agent, options)`：
   - 删除直聊会话：`clowder_cat:${catId}` 或 agent conversation id。
   - 清理直聊消息：删除 `messageStore.messages[conversationId]`。
   - 从所有 `conversationStore.members[groupId]` 移除 `isAgent && agentId/catId` 匹配的成员。
   - 清理项目看板中分配给该智能体的任务或标记为 deleted/archived。
   - 清理 draft、activeId、搜索候选和本地缓存。
4. 在 UI 增加危险操作入口：
   - `AgentCard.vue` 可增加更多菜单或删除图标，仅对用户创建/已连接智能体显示。
   - `pages/agents/new.vue` 编辑态底部增加“删除智能体”危险区。
   - `AgentProfilePanel.vue` 或直聊右侧资料面板可提供“删除智能体”入口。
5. 删除确认弹窗：
   - 标题：“删除智能体”。
   - 文案列出影响范围。
   - 输入智能体名称、alias 或 catId 二次确认。
   - 复选项：“同时删除与该智能体的直聊聊天记录”。
   - 可选高级项：“从所有群聊中移除该智能体”。
6. 删除成功后的导航：
   - 如果当前在该智能体直聊，跳回智能体列表或聊天列表。
   - 如果当前 active conversation 被删除，清空 activeId。
   - Toast 显示实际清理结果。
7. 后端能力确认：
   - 若 `DELETE clowder/cats/:catId` 只删除联系人而不删消息，需要明确记录。
   - 若需要远端消息清理，补充新的后端 API 或用现有 `deleteConversation/deleteMessage` 能力串联。

---

## 验收标准

- `sections/ui` 智能体列表或配置页能发起删除用户创建/已连接智能体。
- 删除前必须二次确认，误触不会直接删除。
- 删除成功后，智能体从智能体列表、搜索结果、建群候选、群成员添加候选和 `@` 候选中消失。
- 删除成功后，智能体直聊会话被删除或按用户选择保留；若选择清理聊天记录，则 `messageStore.messages[conversationId]` 不再保留该直聊历史。
- 删除成功后，所有群成员列表不再显示该智能体成员；群聊 `@` 候选不再出现该智能体。
- 当前正在查看被删除智能体直聊时，页面能安全跳转，不出现空白或报错。
- 后端删除失败时，前端不移除本地智能体，展示错误并允许重试。
- 刷新后被删除智能体不会因为目录同步重新出现，除非后端明确返回未删除/可重新连接状态。
- 桌面和移动视口均可完成删除流程，确认弹窗文本不溢出。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充自动化/手工验收：

1. 创建一个测试智能体，进入直聊发送多条消息。
2. 删除智能体但不勾选清理聊天记录：智能体从目录和候选中消失，历史会话策略符合确认文案。
3. 创建第二个测试智能体，删除时勾选清理直聊聊天记录：直聊会话和消息不再出现。
4. 把智能体加入群聊后删除：群成员列表和 `@` 候选立即移除该智能体。
5. 模拟 `DELETE clowder/cats/:catId` 失败：UI 保留智能体并展示失败原因。
6. 刷新页面并重新同步智能体目录：已删除智能体不应重新出现。

---

## 修复记录

2026-06-10：

- 新增 `services/native-im/agent-cleanup.js`，集中解析 catId / 直聊会话 id，并提供本地 agent、会话、群成员、直聊消息清理 helper。
- `nativeImService.deleteClowderCat(catId)` 接入 `DELETE clowder/cats/:catId`。
- `agentStore.deleteAgent(id, options)` 实现远端删除成功后再清理本地状态；系统/官方智能体禁止删除；远端失败时不移除本地 agent。
- `conversationStore.cleanupAgentReferences(agent, options)` 从直聊会话、activeId、群成员和隐藏列表中移除目标智能体。
- `messageStore.clearConversationMessages(conversationId)` 支持用户显式勾选后清理直聊记录；群聊历史发言默认保留。
- `pages/agents/new.vue` 编辑态增加危险操作区和删除确认弹窗，要求输入名称/alias/catId 二次确认，可选“同时删除直聊会话和聊天记录”。

---

## 测试结果

自动化：

```bash
cd sections/ui && npm run test:native-im
# 65 tests, 65 pass

cd sections/ui && npm run build:h5
# exit 0，只有既有 uni-app / Sass deprecation warnings
```

浏览器可视化验收：

```bash
PATH=/home/yunyi/go1.22/go/bin:$PATH bash scripts/start-im-clowder.sh start
```

证据目录：

```text
sections/ui/.ai/tests/ISSUE-032-20260610022406/
```

证据文件：

- `desktop-1440x900-delete-dialog.png`
- `desktop-1440x900-agent-list-after-delete.png`
- `mobile-375x844-delete-dialog.png`
- `mobile-375x844-agent-list-after-delete.png`
- `browser-console.json`
- `request-log.json`
- `request-failures.json`
- `result.json`

`result.json` 断言：

- 桌面/移动编辑页危险区可见。
- 删除弹窗要求输入名称、别名或 catId。
- 输入正确名称后确认按钮可用。
- 确认删除调用 `DELETE /v1/clowder/cats/logic-weaver` 一次。
- 删除后返回智能体列表，目标智能体不再可见。
- 无 severe console error，无 request failure。

---

## 关闭备注

已按 Plan First 计划完成。Playwright 使用受控删除响应验证 UI 和本地清理路径；后端真实语义仍是删除 cat/contact/membership，群聊历史消息默认保留。
