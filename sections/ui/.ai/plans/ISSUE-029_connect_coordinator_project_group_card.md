# ISSUE-029 协调者项目群确认卡实施计划

**Issue**：`sections/ui/.ai/issues/ISSUE-029_connect_coordinator_project_group_card.md`
**Goal**：在协调者/PM 直聊中生成项目群确认卡，用户确认后通过真实 Clowder project group 后端创建或复用项目群、同步智能体成员并投递原始任务。
**AI修复模式**：Plan First
**前端验证**：Yes，必须覆盖桌面 Web viewport 和移动端 viewport。
**非目标**：不把普通建群页面改造成项目群入口；不绕过 `clowder/project-groups/ensure` 伪造本地群。

---

## 现象与根因

`sections/ui` 目前只有普通建群和本地项目看板兜底，没有迁移 `sections/im_web` 的 `isProjectStartRequest`、项目群确认卡、`ensureProjectGroup` 编排和卡片状态机。结果是协调者直聊里表达“创建项目群/分工执行”后不会出现确认卡，也不会创建真实 project group binding。

## 受影响模块

- `sections/ui/services/native-im/service.js`
- `sections/ui/services/native-im/project-group.js`（新增）
- `sections/ui/stores/message.js`
- `sections/ui/stores/conversation.js`
- `sections/ui/pages/chat/index.vue`
- `sections/ui/pages/chat/detail.vue`
- `sections/ui/components/chat/MessageBubble.vue`
- `sections/ui/components/chat/CoordinatorProjectGroupCard.vue`（新增）
- `sections/ui/tests/native-im.test.mjs`

参考：

- `sections/im_web/apps/chat/src/utils/clowderProjectGroup.ts`
- `sections/im_web/apps/chat/src/components/MessageInput.vue`
- `sections/im_web/apps/chat/src/components/MessageList.vue`
- `sections/im_web/packages/datasource-vue/src/api/clowder.ts`
- `sections/im/TangSengDaoDaoServer/modules/clowder/api.go`

## 推荐设计

卡片作为聊天消息进入 `messageStore`。为了兼容 `im_web` 和普通消息渲染，消息内容采用 `content.type = 1`，并在 `content.metadata.project_group_confirmation = true` 下存放卡片字段。页面发送消息后只负责识别“协调者直聊 + 项目启动意图”并插入 `pending_confirmation` 卡；用户点击确认后由 store action 调用真实后端：

1. `ensureProjectGroup(payload)` 创建或复用项目群。
2. `syncGroupCats(payload)` 同步 cat membership，并用 `fetchGroupCats` 或返回值补齐前端群成员。
3. `sendClowderConversationMessage(...)` 把原始任务投递到项目群。
4. upsert 群会话与 agent members。
5. 将同一张卡更新为 `created/reused/failed/cancelled`。

幂等键使用 `project-group-card:${sourceMessageId || clientMsgNo}`，重复点击只更新同一条卡。必备字段包括 `projectGroupStatus/status`、`projectName`、`sourceText`、`sourceMessageId/clientMsgNo`、`targetCatIds`、`workerCatIds`、`workspaceId`、`pmDirectChannelId`、`pmDirectChannelType`、`pmDirectThreadId`；成功后补 `projectGroupNo`、`projectGroupName`、`projectBindingId`、`projectThreadId`、`projectHandoff`、`reused`。

## 阶段计划

### Phase 1：服务与意图识别红绿测试

**Files**

- Create: `sections/ui/services/native-im/project-group.js`
- Modify: `sections/ui/services/native-im/service.js`
- Test: `sections/ui/tests/native-im.test.mjs`

**TDD**

1. 新增失败测试：
   - `detects coordinator project group start requests`
   - `native service posts ensure project group and sync group cats`
2. 运行 `npm run test:native-im`，确认上述测试因函数/API 缺失失败。
3. 实现 `isProjectStartRequest`、`resolveProjectGroupName`、`ensureProjectGroup`、`syncGroupCats`、`fetchGroupCats`、`updateProjectGroupThread`。
4. 再跑 `npm run test:native-im`。

**阶段提交示例**：`接入项目群服务与意图识别`

### Phase 2：卡片消息状态机

**Files**

- Modify: `sections/ui/stores/message.js`
- Create or modify tests in `sections/ui/tests/native-im.test.mjs`

**TDD**

1. 新增失败测试：
   - `upserts one project group confirmation card per source message`
   - `updates project group card status without duplicating`
   - `marks project group card failed when sync fails`
2. 实现 `createProjectGroupConfirmation`、`updateProjectGroupConfirmation`、`ensureProjectGroupFromCard` 的 store 层最小逻辑。
3. 确认重复 `cardId` 不追加多张卡。

**阶段提交示例**：`实现项目群确认卡状态机`

### Phase 3：桌面/移动发送链路与组件

**Files**

- Create: `sections/ui/components/chat/CoordinatorProjectGroupCard.vue`
- Modify: `sections/ui/components/chat/MessageBubble.vue`
- Modify: `sections/ui/pages/chat/index.vue`
- Modify: `sections/ui/pages/chat/detail.vue`

**TDD / 实现**

1. 先补消息渲染/状态归一单测，确认 `project_group_confirmation` 被识别。
2. 桌面和移动 `handleSendMessage` 发送成功后调用同一个 action 生成确认卡。
3. 卡片按钮支持确认、取消、重试、打开项目群。
4. 按钮高度不低于 44px，移动端 375px 不溢出。

**阶段提交示例**：`渲染协调者项目群确认卡`

### Phase 4：真实编排与视觉验收

**Verification**

```bash
cd sections/ui && npm run test:native-im
cd sections/ui && npm run build:h5
PATH=/home/yunyi/go1.22/go/bin:$PATH bash scripts/start-im-clowder.sh start
```

Playwright/browser 证据保存到：

```text
sections/ui/.ai/tests/ISSUE-029-<timestamp>/
```

必须保存：

- `desktop-1440x900-confirm-card.png`
- `desktop-1440x900-created-card.png`
- `mobile-375x844-confirm-card.png`
- `mobile-375x844-created-card.png`
- `browser-console.json`
- `request-log.json`
- `result.json`

**阶段提交示例**：`完成项目群确认卡浏览器验收`

## 风险与回滚

- `syncGroupCats` 失败时不得静默跳转，卡片进入 `failed` 并保留重试入口。
- 若后端 kickoff 已返回卡片，前端本地识别只做兜底，避免重复卡。
- 回滚时可移除卡片触发逻辑，保留 service wrapper 不影响普通 IM。

## Done

- ISSUE-029 文档状态更新为 `Resolved`。
- 证据目录写入 issue 文档。
- 自动化测试、H5 build、桌面和移动 Playwright 证据均通过。
- 完成中文 commit。
