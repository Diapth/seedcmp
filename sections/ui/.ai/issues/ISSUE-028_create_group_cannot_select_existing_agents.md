# [ISSUE-028] 发起群聊时不能选择已有智能体

**状态**：Resolved
**创建时间**：2026-06-09
**标签**：bug / clowder / group / agent / membership / desktop
**AI修复模式**：Direct Fix
**计划路径**：N/A
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

在“发起群聊”页面，联系人选择区只展示普通联系人/系统联系人，不能选择已有智能体作为初始群成员。用户因此无法在建群时直接把 Codex、Claude、DeepSeek 等已连接智能体拉进群聊，只能先创建普通群，再尝试通过群成员页补加智能体。

用户截图证据：

- 页面标题为“发起群聊”。
- 群聊名称输入框下方为“选择联系人”。
- 候选列表仅显示“系统账号”“文件传输助手”等普通联系人。
- 列表中没有已存在智能体候选，也没有“智能体/联系人”分组或筛选入口。

这与产品预期不一致：群聊是多智能体协作的主要入口，发起群聊时应能直接选择已有智能体建群。

---

## 复现步骤

1. 启动 `sections/ui`，登录已有智能体配置/已连接智能体的账号。
2. 进入通讯录，点击发起群聊入口。
3. 打开“发起群聊”页面。
4. 查看“选择联系人”列表。
5. 尝试选择已有智能体作为群成员并创建群聊。

实际：

1. 只能看到普通联系人/系统联系人。
2. 已有智能体不在候选列表中。
3. 无法在建群时把智能体作为初始成员加入群聊。

预期：

1. 发起群聊页面同时展示可加入的普通联系人和已有智能体。
2. 智能体候选应带有可识别的名称、头像、alias/平台标识。
3. 选择智能体后，确认按钮计数应包含智能体。
4. 建群成功后，群成员列表、`@` 候选、智能体路由和项目看板都能识别这些智能体成员。

---

## 相关代码

```text
sections/ui/pages/group/create.vue
- 当前只遍历 contactStore.contacts 渲染候选。
- selectedFriends 只保存普通联系人 id。
- handleCreate 只把 selectedFriends 作为 memberIds 传给 groupStore.createNativeGroup。
- 没有引入 useAgentStore，也没有把 agentStore.agents 合并进建群候选。
- 建群成功后没有调用 convStore.addAgentMember 初始化智能体成员。

sections/ui/pages/group/members.vue
- availableContacts 已经把 agentStore.agents 合并进可添加候选。
- 智能体候选使用 id: `agent:${agent.id}`、agentId、inviteType: 'agent'、alias。
- handleAddConfirm 遇到 agent: 前缀时调用 convStore.addAgentMember(groupId, agent)。
- 可作为 create.vue 的候选建模参考。

sections/ui/stores/group.js
- createNativeGroup 只调用 nativeImService.createGroup({ name, members: memberIds })。
- 目前只适合创建原生 IM 群和普通成员，未区分 agentIds。

sections/ui/stores/conversation.js
- addAgentMember(convId, agent) 已经可以把智能体转换为群成员模型。
- createAgentMember 会写入 isAgent、agentId、alias 等字段。
```

---

## 根因分析

待调查。初步判断是“发起群聊”和“群内添加成员”走了两套候选来源：

1. `pages/group/create.vue` 只读取 `contactStore.contacts`，因此已连接智能体不会进入初始建群候选。
2. `pages/group/members.vue` 已经补齐了 `agentStore.agents -> agent:` 候选 -> `convStore.addAgentMember` 的逻辑，但没有复用到创建群聊页面。
3. `groupStore.createNativeGroup` 目前只接收普通 `memberIds`。如果智能体不是原生 IM 用户，直接传给 native createGroup 可能无效，需要在创建原生群后再建立 Clowder agent membership。
4. 建群后的群成员、mention candidates、project board 和 agent routing 依赖 `isAgent/agentId/alias` 等字段；若只把智能体 id 当普通联系人传入，后续 `@` 和路由可能仍不可用。

---

## 问题列表（Q&A 迭代）

### Q1: 这和 ISSUE-005“实现在智能体中添加智能体”是不是同一个问题？
**A1**: 不是。`ISSUE-005` 解决的是群聊已经存在后，从群成员页补加智能体。本 issue 关注创建群聊的初始选人阶段，用户应能一次性选择普通联系人和已有智能体建群。

### Q2: 建群接口是否应该直接接收智能体 id？
**A2**: 需要区分普通 IM 成员和 Clowder 智能体成员。普通联系人继续进入 native `members`；智能体应以 agent membership 方式在群创建成功后写入 `conversationStore`/Clowder group cats，避免把非 IM 用户 id 误传给原生群接口。

### Q3: 空联系人但有智能体时页面应该怎么展示？
**A3**: 不应显示“暂无可选择的好友”。只要存在可用智能体，就应该展示智能体候选；空态文案也应覆盖“暂无可选择的联系人或智能体”。

---

## 代码方案补充（基于源码对照）

### 现有差异

1. `sections/ui/pages/group/create.vue` 只读取 `contactStore.contacts`，选择数组叫 `selectedFriends`，并把全部选择透传给 `groupStore.createNativeGroup({ memberIds })`。
2. `sections/ui/pages/group/members.vue` 已经实现了更接近目标的候选模型：
   - 普通联系人：`inviteType: 'contact'`
   - 智能体：`id: agent:${agent.id}`、`agentId`、`inviteType: 'agent'`、`alias`
   - 确认时遇到 `agent:` 调 `convStore.addAgentMember(groupId, agent)`。
3. `sections/ui/services/native-im/agent-state.js` 的 `createAgentMember(agent)` 会产出 `isAgent / agentId / alias`，这正是群成员页、`@` 候选和项目看板需要的字段。
4. TangSengDaoDaoWeb 原生实现只把联系人 uid 作为群成员传给后端：
   - `packages/tsdaodaodatasource/src/datasource.ts` 的 `createChannel(uids)` 仅 `POST group/create { members: uids }`。
   - 原生 `GroupSave` / `OrganizationalGroupNew` 都从联系人选择组件取 `item.id/uid` 建群。
   这说明 Clowder 智能体不是 TangSeng 原生群成员概念，不能把 `agent:${id}` 直接塞进 `members`。

### 建议代码组织

1. 抽一个共享 helper，避免 `create.vue` 和 `members.vue` 继续复制候选逻辑：

```text
sections/ui/services/native-im/group-member-candidates.js
- buildSelectableGroupMembers({ contacts, agents, existingMembers? })
- splitSelectedGroupMembers(selectedIds, selectableMembers)
- normalizeAgentCandidate(agent)
```

2. `pages/group/create.vue` 改为：
   - `selectedFriends` 改名为 `selectedMemberIds`。
   - 列表数据从 `contactStore.contacts` 改为 `selectableMembers`。
   - 空态判断从 `contactStore.contacts.length` 改为 `selectableMembers.length`。
   - UI 上用 `inviteType` 给智能体加“智能体”标签和 `alias/platform` 副标题。
3. `handleCreate` 应先拆分选择：
   - `contactIds` 传给 `groupStore.createNativeGroup({ name, memberIds: contactIds })`。
   - `agentIds` 在建群成功后逐个 `convStore.addAgentMember(groupId, agent)`。
4. 如果后端 `POST clowder/group/cats/sync` 可用，应在 `nativeImService` 增加 `syncGroupCats({ groupId, groupName, catIds })`，并在建群成功后调用，确保刷新后 Clowder membership 不丢。
5. 若用户只选智能体且没有普通联系人：
   - 原生 TangSeng `group/create` 仍至少需要当前用户作为 owner，后端通常会自动包含登录用户。
   - 前端不应传空 `members` 后就假定成功；计划阶段要确认 `nativeImService.createGroup({ members: [] })` 是否允许，否则需要后端支持“创建仅 owner + cats 的项目群/普通群”。

### 边界意见

1. `agent:${id}` 只用于前端选择列表去重，不能作为 TangSeng uid 传给 `group/create` 或 `groups/:id/members`。
2. 本地 `convStore.addAgentMember` 只能解决当前 session 的显示和 `@` 候选，不能替代后端 Clowder group cats 同步。
3. 原生群成员和 Clowder cat membership 是两张表/两种语义：普通成员影响 IM 群权限，cat membership 影响智能体路由和项目看板。
4. 不建议把“创建群聊时选智能体”写死在页面组件里；后续项目群确认卡、群成员添加页、项目看板补猫都会复用同一套候选/拆分逻辑。

---

## 修复建议

1. 在 `pages/group/create.vue` 引入 `useAgentStore`，将普通联系人和 `agentStore.agents` 统一转换为 `selectableMembers`。
2. 候选项增加 `inviteType: 'contact' | 'agent'`，智能体使用稳定前缀 id，例如 `agent:${agent.id}`，避免与联系人 id 冲突。
3. UI 上区分智能体候选：展示智能体名称、alias/平台标识，必要时增加“智能体”角标。
4. `selectedFriends` 改名为更通用的 `selectedMemberIds` 或等价字段，确认按钮计数包含普通联系人和智能体。
5. `handleCreate` 中拆分选择结果：
   - 普通联系人 id 传入 `groupStore.createNativeGroup({ name, memberIds })`。
   - 智能体 id 在群创建成功后调用 `convStore.addAgentMember(groupId, agent)`。
6. 如果后端已有 Clowder group cat membership API，应同步调用对应接口，确保刷新后智能体成员仍存在。
7. 创建完成后立即验证群成员列表、聊天输入框 `@` 候选和智能体资料面板都能识别初始智能体成员。

---

## 验收标准

- 发起群聊页面能看到已有智能体候选。
- 可同时选择普通联系人和多个智能体。
- 确认按钮计数包含所有已选候选。
- 只选择智能体时也允许创建群聊，除非产品明确要求至少一个普通联系人。
- 建群成功后跳转到新群聊，群成员列表中能看到刚才选择的智能体。
- 在新群聊输入 `@` 可以出现这些智能体。
- 智能体成员应保留 `isAgent`、`agentId`、`alias` 等字段，不能退化为普通联系人。
- 刷新或重新进入群聊后，智能体成员不丢失。
- 桌面 H5 和移动群聊创建页视口都不出现布局错位。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充自动化/手工验收：

1. `agentStore.agents` 有数据、`contactStore.contacts` 为空时，发起群聊页面仍显示智能体候选。
2. 同时选择 1 个联系人和 2 个智能体创建群聊，确认按钮显示 `确定(3)`。
3. 创建后打开群成员页，普通联系人与智能体成员都存在。
4. 在聊天输入框输入 `@`，新加入智能体出现在候选中。
5. 刷新页面或重新同步群成员后，智能体成员仍能恢复。

---

## 修复记录

2026-06-10 修复：

1. 新增 `services/native-im/group-member-candidates.js`，统一普通联系人与智能体建群候选模型。
2. `pages/group/create.vue` 改为展示“联系人 + 智能体”混合候选，智能体行展示“智能体”角标与 alias/platform 副信息。
3. 建群提交前拆分候选：普通联系人继续进入原生 `group/create.members`，智能体不再以 `agent:*` 传给 TangSeng 原生群接口。
4. 新增 `nativeImService.syncGroupCats` 与 `groupStore.syncGroupCatsForGroup`，建群成功后调用 `POST clowder/group/cats/sync` 持久化 Clowder group cats。
5. 建群成功后本地调用 `convStore.addAgentMember(groupId, agent)`，让当前会话立即识别智能体成员和后续 `@` 路由字段。

TDD Red 记录：

1. 先补 `group-member-candidates` 行为测试，首次运行失败于 `ERR_MODULE_NOT_FOUND`，证明创建页缺少可复用的混合候选/拆分模型。
2. 再补 `native service syncs clowder group cats without sending agents as native members`，首次运行失败于 `service.syncGroupCats is not a function`，证明 Clowder group cats 同步 API 未接入。

---

## 测试结果

自动化验证：

```bash
cd sections/ui && npm run test:native-im
# 67/67 pass

cd sections/ui && npm run build:h5
# exit 0；仅有既有 uni-app / Sass deprecation warning

cd sections/ui && npm run test:smoke
# sections/ui smoke test passed
```

浏览器验收：

- 证据目录：`sections/ui/.ai/tests/ISSUE-028-20260610025200/`
- 桌面截图：`desktop-1440x900-create-candidates.png`、`desktop-1440x900-after-create.png`
- 移动截图：`mobile-375x844-create-candidates.png`、`mobile-375x844-after-create.png`
- 请求断言：`request-log.json`
- 控制台/网络断言：`browser-console.json`、`network-errors.json`
- 汇总结果：`result.json`

Playwright 覆盖：

1. 桌面 `1440x900` 与移动 `375x844` 均打开 `#/pages/group/create`。
2. 候选列表同时出现智能体与普通联系人，选择后按钮显示 `确定(2)`。
3. `group/create` 请求只包含普通联系人 `members`，不包含 `agent:*`。
4. `clowder/group/cats/sync` 请求包含所选智能体 `catIds`。
5. 创建后跳转到聊天页，桌面/移动均无横向溢出、无 error 级 console、无 4xx/5xx 网络响应。

---

## 关闭备注

已完成发起群聊初始选择智能体能力。刷新后智能体成员持久化依赖 `clowder/group/cats/sync` 后端返回与后续群成员页同步链路；当前浏览器验收已覆盖创建提交与跳转链路。
