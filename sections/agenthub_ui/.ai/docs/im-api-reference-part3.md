# IM 后端接口参考 — Clowder 域

> 配套：[im-api-reference.md §0-§1](./im-api-reference.md)、[im-api-reference-part2.md §2-§6](./im-api-reference-part2.md)
> 源文件：`sections/im/TangSengDaoDaoServer/modules/clowder/api.go` + `sections/clowder-ai/packages/api/src/routes/*`
> 反向代理：`TangSeng/clowder` 模块 `c.config.APIBaseURL` → `clowder-ai/packages/api` (`:3004`)

## 5. Clowder 域

### 5.1 状态与目录

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/clowder/status` | 是 | 连接状态（enabled / configured / reachable / state / version / featureFlags） |
| GET | `/v1/clowder/conversation` | 是 | 某会话的完整状态（agents / binding / permission / focus） |
| GET | `/v1/clowder/conversation/agents` | 是 | 某会话的 agent 目录（preferred / lastActive） |
| GET | `/v1/clowder/cats` | 是 | Cat 目录（带 templates / clientDefaults / skillCatalog） |
| GET | `/v1/clowder/local-auth/capabilities` | 是 | 本地 OAuth 能力（Claude/Codex 哪个已登录） |

**`GET /v1/clowder/status`** 响应：

```json
{
 "enabled": true,
 "configured": true,
 "reachable": true,
 "version": "3.0",
 "state": "ready",
 "featureFlags": { "imWebClowder": true },
 "connectorId": "im-web"
}
```

**`GET /v1/clowder/cats`** 响应（`CatDirectoryResponse`）：

```json
{
 "agents": [ { "catId": ".", "displayName": "cat-PM", "mentionPatterns": ["@pm"], "available": true } ],
 "templates": [
 { "roleTemplateId": "rt-arch", "catId": "tpl-1", "displayName": "布偶猫（架构师）", "cloneable": true }
 ],
 "clientDefaults": {
 "anthropic": { "defaultModel": "claude-sonnet-4-6", "models": ["claude-opus-4-7[1m]", "claude-sonnet-4-6"] },
 "openai": { "defaultModel": "gpt-5.2-codex", "models": ["gpt-5.2-codex"] }
 },
 "skillCatalog": {
 "codex": [ { "name": "code-review", "mounted": true } ],
 "claude": [ { "name": "code-review", "mounted": true } ]
 }
}
```

### 5.2 Cat CRUD

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/clowder/cats/connect` | 是 | 连接/启用一个已有 Cat |
| POST | `/v1/clowder/cats` | 是 | 创建 Cat（并连接） |
| DELETE | `/v1/clowder/cats/:catId` | 是 | 删除 Cat 连接 |

**`POST /v1/clowder/cats`** 请求体（`createCatRequest`）：

```json
{
 "name": "cat-PM",
 "alias": "pm",
 "roleTemplateId": "rt-arch",
 "clientId": "anthropic", // openai | anthropic
 "platform": "claude-code", // codex | claude-code
 "authType": "api_key", // api_key | oauth
 "accountRef": "sk-ant-..",
 "defaultModel": "claude-sonnet-4-6",
 "personality": "负责拆解需求、派发任务",
 "capabilities": ["code-review", "summarize"]
}
```

### 5.3 会话绑定 / 焦点

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/clowder/conversation/bind` | 是 | 把 channel ↔ thread 绑定 |
| POST | `/v1/clowder/conversation/focus` | 是 | 设置 focus cat（`catId` 可空） |
| POST | `/v1/clowder/conversation/focus/clear` | 是 | 清 focus |
| POST | `/v1/clowder/conversation/message` | 是 | 发消息给 cat（流式/普通） |

**`POST /v1/clowder/conversation/bind`** 请求体（`conversationRefRequest`）：

```json
{
 "channelId": "g-uuid",
 "channelType": 2, // 1=单聊 2=群
 "threadId": "thread-uuid",
 "title": "AgentHub 项目群"
}
```

**`POST /v1/clowder/conversation/message`** 请求体：

```json
{
 "channelId": "g-uuid",
 "channelType": 2,
 "text": "@cat-PM 帮我拆解需求",
 "directCatId": "cat-pm",
 "targetCatIds": ["cat-pm", "cat-worker-a"],
 "promptContext": "项目背景：.."
}
```

### 5.4 群 Cats 同步

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/clowder/group/cats/sync` | 是 | 同步群里的 cats 列表 + prompt |
| GET | `/v1/clowder/group/cats` | 是 | 查群里 cats |

**`POST /v1/clowder/group/cats/sync`** 请求体（`groupCatSyncRequest`）：

```json
{
 "groupId": "g-uuid",
 "groupName": "AgentHub 项目群",
 "catIds": ["cat-pm", "cat-worker-a"],
 "cats": [ { "catId": ".", "displayName": ".", "mentionPatterns": ["@pm"] } ],
 "prompt": "项目目标：..",
 "proactiveReplies": false,
 "autoReplyMode": "mentions_only" // off | mentions_only | soft_mentions
}
```

### 5.5 项目群

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/clowder/project-groups/ensure` | 是 | 复用/创建项目群（与 PM 直聊） |
| GET | `/v1/clowder/project-groups/active` | 是 | 查 active 项目群 |
| POST | `/v1/clowder/project-groups/:bindingId/thread` | 是 | 改 binding 的 projectThreadId |

**`POST /v1/clowder/project-groups/ensure`** 请求体（`projectGroupEnsureRequest`）：

```json
{
 "projectName": "todolist-static-page",
 "workspaceId": "ws-uuid",
 "pmDirectChannelId": "single-uuid",
 "pmDirectChannelType": 1,
 "pmDirectThreadId": "thread-uuid",
 "projectThreadId": "thread-uuid-2",
 "pmMemberId": "m-pm",
 "pmDisplayName": "cat-PM",
 "userMemberIds": ["uid-B"],
 "catMemberIds": ["cat-pm", "cat-worker-a", "cat-worker-b"],
 "createdBy": "pm"
}
```

### 5.6 协调（Coordination）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/clowder/coordinator/coordination` | 是 | 创建 coordination（PM 派任务） |
| GET | `/v1/clowder/coordinator/coordination/:coordinationId` | 是 | 查 coordination |
| PATCH | `/v1/clowder/coordinator/coordination/:coordinationId` | 是 | 更新（subtasks / status / aggregateSummary） |
| POST | `/v1/clowder/coordinator/coordination/:coordinationId/cancel` | 是 | 取消 |
| GET | `/v1/clowder/coordinator/kickoff/:coordinationId` | 是 | 拿 kickoff 卡片 |
| GET | `/v1/clowder/coordinator/kickoffs` | 是 | 列出最近 kickoff |
| POST | `/v1/clowder/coordinator/kickoff/:coordinationId/dismiss` | 是 | 关闭 kickoff 卡片 |

**`POST /v1/clowder/coordinator/coordination`** 请求体（`ClowderCreateCoordinationRequest`）：

```json
{
 "coordinationId": "c-uuid",
 "threadId": "thread-uuid",
 "sourceMessageId": "m-uuid",
 "createdBy": "cat-pm",
 "goal": "写一个 todolist 静态页，30 分钟内完成",
 "assumptions": ["使用 Vue 3", "不依赖后端"],
 "subtasks": [
 { "title": "搭骨架", "targetCatId": "cat-worker-a", "dependsOn": [] },
 { "title": "写样式", "targetCatId": "cat-worker-b", "dependsOn": ["s1"] },
 { "title": "汇总", "targetCatId": "cat-summarizer", "dependsOn": ["s2"] }
 ],
 "targetCatIds": ["cat-pm", "cat-worker-a", "cat-worker-b", "cat-summarizer"],
 "dispatchMode": "parallel", // parallel | serial | mixed
 "status": "planning",
 "idempotencyKey": "client-uuid"
}
```

### 5.7 任务（Kanban）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/clowder/thread/:threadId/tasks` | 是 | 任务列表（4 态） |
| GET | `/v1/clowder/thread/:threadId/coordinations` | 是 | thread 下的 coordinations |
| GET | `/v1/clowder/thread/:threadId/artifacts` | 是 | 产物列表 |
| POST | `/v1/clowder/thread/:threadId/artifacts` | 是 | 上传产物 |
| GET | `/v1/clowder/thread/:threadId/workspaces` | 是 | 关联工作区 |
| GET | `/v1/clowder/thread/:threadId/workspace-binding` | 是 | 工作区绑定 |
| PUT | `/v1/clowder/thread/:threadId/workspace-binding` | 是 | 改工作区绑定 |

> V2-10 计划要求 `POST /v1/clowder/tasks/:id/transition` 与 `POST /v1/clowder/tasks/:id/assign`，当前 im 后端是统一走 `PATCH /v1/clowder/coordinator/coordination/:id` 更新 subtask status。落地时建议前端封装 `transitionTask(taskId, status)` 走 PATCH coordination。

### 5.8 部署（Deployment）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/clowder/conversation/deployment-request` | 是 | 创建部署请求 |
| PATCH | `/v1/clowder/conversation/deployment-request/:id` | 是 | 补字段（target / environment） |
| GET | `/v1/clowder/conversation/deployment-request/active` | 是 | 当前 active 部署请求 |
| GET | `/v1/clowder/conversation/deployment-request/:id` | 是 | 部署请求详情 |
| POST | `/v1/clowder/conversation/deployment-action` | 是 | confirm / cancel |
| GET | `/v1/clowder/deployments/:id` | 是 | 部署状态 |
| GET | `/v1/clowder/deployments/:id/logs` | 是 | 部署日志 |

**`POST /v1/clowder/conversation/deployment-action`** 请求体：

```json
{
 "channelId": "g-uuid",
 "channelType": 2,
 "deploymentRequestId": "dr-uuid",
 "action": "confirm", // confirm | cancel
 "actionId": "a-uuid",
 "target": "/path/to/project",
 "environment": "preview",
 "workspaceId": "ws-uuid"
}
```

### 5.9 Maomi 工作区

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/clowder/maomi-workspaces/root` | 是 | 当前工作区根目录 |
| POST | `/v1/clowder/maomi-workspaces/propose` | 是 | 提议一个新工作区（基于 intent） |
| POST | `/v1/clowder/maomi-workspaces` | 是 | 创建工作区 |
| GET | `/v1/clowder/maomi-workspaces` | 是 | 列出我的工作区 |
| GET | `/v1/clowder/maomi-workspaces/:workspaceId` | 是 | 工作区详情 |
| POST | `/v1/clowder/maomi-workspaces/:workspaceId/archive` | 是 | 归档工作区 |
| GET | `/v1/clowder/workspace/validate` | 是 | 校验路径 |

### 5.10 线程（Thread / TSD）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/clowder/threads` | 是 | 创建线程（TSDI 抽象） |
| POST | `/api/im-web/clowder/outbound` | 否 | im-web 出站回调（clowder 域推送） |

## 6. 错误码与状态机

### 6.1 Coordination 状态机
`planning → dispatching → running → aggregating → succeeded | failed | cancelled`

### 6.2 Deployment 状态机
`needs_fields → pending_confirmation → confirmed → queued → running → succeeded | failed | cancelled`

### 6.3 Task 状态机
`todo → doing → blocked → done`，可 `failed` / `cancelled` 终态。

### 6.4 Cat 状态
- `enabled/configured/reachable/state`（`state`：`disabled` | `unconfigured` | `connecting` | `ready` | `denied` | `error`）。
- `binding`：`active` | `disabled` | `orphaned` | `failed`。

### 6.5 常见错误码
- `400` 字段校验失败。
- `401` token 失效或缺失。
- `403` 权限不足（非项目成员/非群主）。
- `404` 资源不存在。
- `409` 重复创建（如手机号已存在）。
- `502` Clowder 3004 不可用。
- `kickout` ws 事件：被另一端登录踢出。

## 7. 端到端一致性时间表（V2-16 关键事件）

| 事件 | im 后端事件 | agenthub_ui 期望行为 |
|---|---|---|
| 消息发送 | `event.message` | 收消息 → 渲染 + 未读 +1 |
| 已读 | `event.message.readed` | 收消息回执 → 状态 → 已读 |
| 撤回 | `event.revoke` | 消息卡片 → 提示"对方撤回了一条消息" |
| 编辑 | `event.message.edit` | 消息文本刷新 + 角标"已编辑" |
| Reaction | `event.reaction` | 卡片角标加 emoji + 列表 |
| Typing | `event.typing` | 输入框上方"对方正在输入…" |
| 好友申请 | `friend.apply` | 好友请求页红点 +1 |
| 群邀请 | `event.group.invite` | 待处理邀请页红点 |
| 群公告 | `event.group.update` | 群信息页公告刷新 |
| 踢出 | `event.group.remove` / `event.kickout` | 会话消失 + overlay |
| Clowder 流式 | `clowder.outbound` (ws) | 流式 markdown 渲染 |
| 部署状态变化 | `deployment.status` | deployment card 状态机推进 |
| 任务卡移动 | `coordination.subtask.update` | kanban 跨列同步 |
