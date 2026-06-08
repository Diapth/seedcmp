# [ISSUE-015] 真实多智能体项目群未完整同步到双账号与看板

**状态**：Open
**创建时间**：2026-06-08
**标签**：bug / investigation / multi-agent / group-chat
**AI修复模式**：Plan First
**计划路径**：sections/ui/.ai/plans/ISSUE-015_real_multi_agent_project_group_not_synced.md
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

---

## 问题描述

使用 `sections/ui` 在 `http://localhost:5173/` 进行双账号验收时，普通群聊功能通过；但真实多智能体项目群链路失败。

验收账号：

1. `13733632709` / `123456`
2. `18337488675` / `123456`

本次证据目录：

`seedcmp/sections/ui/.ai/tests/ui-group-multi-agent-20260608154418/`

关键结论：

1. 普通群 `UI群聊验收-154418` 可由 `13733632709` 创建，两个账号均可见，H5 双向收发消息通过。
2. 项目群 `UI多智能体验收-154418` 的 `ensureProjectGroup` 和 `group/cats/sync` API 返回成功，但实际群成员只包含 `13733632709` 与 `clowder_ai`，缺少 `18337488675`。
3. 项目群不出现在两个账号的 `group/my` 返回中；H5 中只有 `13733632709` 能看到项目群，`18337488675` 搜索不到。
4. 项目群右侧群信息没有 `智能体看板` 入口；`13733632709` 在项目群里发送 `@coordinator @codex` 消息后，`18337488675` 不能收到。
5. 多智能体协作相关 API 仍不可用：`POST /v1/clowder/coordinator/coordination` 和 `GET /v1/clowder/thread/:threadId/tasks` 均返回 404。

相关截图：

1. `03-b-normal-after-send.png`、`04-a-normal-after-receive-b.png`
2. `05-a-normal-after-send.png`、`06-b-normal-after-receive-a.png`
3. `08-a-project-conversation-not-found.png`
4. `07-b-project-group.png`、`10-b-project-after-send.png`、`11-a-project-after-receive.png`

---

## 复现步骤

1. 启动 `sections/ui` H5，并打开 `http://localhost:5173/`。
2. 使用 API 登录 `13733632709` 和 `18337488675`。
3. 使用 `13733632709` 调用 `POST /v1/group/create` 创建普通群，members 传入 `18337488675` 的 uid。
4. 两个账号分别登录 H5，打开普通群，互发消息。
5. 使用 `13733632709` 调用 `POST /v1/clowder/project-groups/ensure` 创建项目群，`userMemberIds` 传入两个真人 uid，`catMemberIds` 传入 `coordinator`、`codex`。
6. 调用 `POST /v1/clowder/group/cats/sync` 绑定项目群猫猫。
7. 检查 `groups/:groupNo/membersync`、`group/my`、H5 会话列表、右侧群信息和多智能体看板入口。
8. 调用 `POST /v1/clowder/coordinator/coordination` 与 `GET /v1/clowder/thread/:threadId/tasks`。

---

## 相关代码

```go
// sections/im/TangSengDaoDaoServer/modules/clowder/api.go
// ensureProjectGroup 记录了 req.UserMemberIDs，但创建项目群时没有把它传给 createProjectGroup。
// createProjectGroup 和 ensureProjectGroupMembers 都只使用 userID + pmMemberID。
```

```vue
<!-- sections/ui/components/chat/GroupInfoPanel.vue -->
<button v-if="agentBoard" class="action-row board-action" @click="$emit('open-board', agentBoard)">
  <text class="action-text flex-1">智能体看板</text>
</button>
```

```js
// sections/ui/components/chat/GroupInfoPanel.vue
const agentBoard = computed(() => {
  return agentStore.boards.find((board) => board.groupId === props.group.id) || null;
});

// sections/ui/components/chat/RightWorkspace.vue
const agentBoard = computed(() => {
  if (props.conversation.type !== 'group') return null;
  return agentStore.boards.find((board) => board.groupId === props.conversation.id) || null;
});
```

---

## 根因分析

初步根因有三层：

1. TangSeng 项目群创建路径没有把 `req.UserMemberIDs` 落入真实群成员表。`ensureProjectGroup` 返回的 binding 中包含两个真人 uid，但 `groups/:groupNo/membersync` 实际只返回创建者 `989ec1fc79664ede9ff9008831d76337` 和机器人 `clowder_ai`。
2. `sections/ui` 的智能体看板入口仍依赖 `agentStore.boards` 中静态 `groupId` 匹配；真实后端项目群没有动态 board/task 数据，所以右侧群信息不出现 `智能体看板`。
3. 运行中的 Clowder upstream 未提供 coordinator 和 thread tasks 路由，导致 TangSeng 代理返回 404：`Route POST:/api/coordinator/coordination not found`、`Route GET:/api/threads/ui-project-thread-154418/tasks not found`。

---

## 问题列表（Q&A 迭代）

### Q1: 普通群聊是否也失败？
**A1**: 否。普通群 `UI群聊验收-154418` API 成员包含两个真人账号，H5 两端均可见，`B发群聊验收 20260608154418` 和 `A回群聊验收 20260608154418` 均完成双向接收。

### Q2: 项目群 API 已经返回成功，为什么仍判失败？
**A2**: 因为 `ensureProjectGroup` 成功只说明 binding 被创建；实际验收要求项目群可被两个真人账号使用，并展示多智能体协作能力。本轮 `membersync`、`group/my`、H5 会话列表、看板入口和项目群消息互通均未满足。

### Q3: 是否是测试请求缺字段导致？
**A3**: 不是。本轮请求包含 `projectName`、`pmDirectChannelId`、`pmDirectChannelType`、`pmDirectThreadId`、`projectThreadId`、`pmMemberId`、`userMemberIds`、`catMemberIds`；`ensureProjectGroup` 返回 200，且 binding 内确实记录了两个真人 uid。

---

## 修复建议

1. 后端项目群创建/复用时把 `req.UserMemberIDs` 传入真实群成员维护逻辑，并确保 `group_member`、WuKongIM channel subscribers、`group/my` 对所有真人成员一致。
2. `sections/ui` 为真实项目群接入动态 Clowder group cats / binding / coordination / thread tasks 数据，不再只依赖 `agentStore.boards` 的静态 groupId。
3. 对齐运行中的 Clowder API 版本，确保 `/api/coordinator/coordination` 与 `/api/threads/:threadId/tasks` 已注册，或在 UI/API 中提供明确的不可用状态。
4. 增加双账号 Playwright 回归：普通群双向收发、项目群双账号可见、项目群多智能体入口、coordination/tasks 可读。

---

## 测试结果

```bash
cd /home/leng/.codex/skills/playwright-skill \
  && TARGET_URL='http://localhost:5173' \
     API_BASE='http://localhost:3000/v1' \
     REPO_ROOT='/media/leng/DiskB1/exp/seedcmp' \
     node run.js /tmp/playwright-test-sections-ui-group-multi-agent.js

# exit 1
# PASS: 普通群 API 创建/成员同步、H5 双账号可见、H5 双向消息互通
# FAIL: 项目群成员缺少 18337488675、group/my 不可见、A 端 H5 不可见、无智能体看板入口、coordination/tasks 404
```

---

## 关闭备注

待修复后复测同一链路：两个账号均能进入真实项目群，项目群中可见多智能体看板/任务，`@coordinator @codex` 后可触发并展示真实 coordination/tasks，且项目群消息可在两个真人账号之间互通。
