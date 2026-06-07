# IM 后端接口参考 — 群 / 消息 / 频道

> 配套：[im-api-reference.md §0-§1](./im-api-reference.md) 用户域
> 源文件：`sections/im/TangSengDaoDaoServer/modules/{group,message,channel,file}/*.go`

## 2. 群域（Group Module）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/group/create` | 是 | 创建群 |
| GET | `/v1/group/my` | 是 | 我保存的群（我创建的 + 我加入的） |
| GET | `/v1/group/forbidden_times` | 是 | 禁言时长枚举（5min/1h/12h/24h） |
| POST | `/v1/groups/:group_no/members` | 是 | 加成员 |
| DELETE | `/v1/groups/:group_no/members` | 是 | 踢人 |
| POST | `/v1/groups/:group_no/members_delete` | 是 | 踢人（同上，路径别名） |
| GET | `/v1/groups/:group_no/members` | 是 | 成员列表 |
| GET | `/v1/groups/:group_no/membersync` | 是 | 增量同步成员 |
| GET | `/v1/groups/:group_no` | 是 | 群信息 |
| PUT | `/v1/groups/:group_no/setting` | 是 | 改群设置（公告/禁言/加群方式） |
| PUT | `/v1/groups/:group_no` | 是 | 改群信息（群名/群头像/群描述） |
| PUT | `/v1/groups/:group_no/members/:uid` | 是 | 改成员（群昵称/角色/禁言时长） |
| POST | `/v1/groups/:group_no/exit` | 是 | 退群 |
| POST | `/v1/groups/:group_no/managers` | 是 | 加管理员 |
| DELETE | `/v1/groups/:group_no/managers` | 是 | 移除管理员 |
| POST | `/v1/groups/:group_no/forbidden/:on` | 是 | 全员禁言（`on=1`/`0`） |
| GET | `/v1/groups/:group_no/qrcode` | 是 | 群二维码 |
| POST | `/v1/groups/:group_no/transfer/:to_uid` | 是 | 群主转让 |
| POST | `/v1/groups/:group_no/member/invite` | 是 | 邀请成员（生成 invite_no） |
| GET | `/v1/groups/:group_no/member/h5confirm` | 否 | H5 邀请确认页 |
| POST | `/v1/groups/:group_no/blacklist/:action` | 是 | 群黑名单（`action=add`/`remove`） |
| POST | `/v1/groups/:group_no/forbidden_with_member` | 是 | 禁言/解禁指定成员 |
| POST | `/v1/groups/:group_no/avatar` | 是 | 上传群头像 |
| DELETE | `/v1/groups/:group_no/disband` | 是 | 解散群（仅群主） |
| GET | `/v1/groups/:group_no/avatar` | 否 | 群头像 |
| GET | `/v1/groups/:group_no/detail` | 否 | 群详情 |
| GET | `/v1/groups/:group_no/scanjoin` | 否 | 扫码进群 |
| GET | `/v1/group/invites/:invite_no` | 否 | 邀请详情 |
| POST | `/v1/group/invite/sure` | 否 | 确认邀请 |

**`POST /v1/group/create`** 请求体：

```json
{
 "name": "AgentHub 产品研发群",
 "group_no": "", // 留空自动生成
 "members": ["uid-A", "uid-C"],
 "avatar": "",
 "description": "测试群"
}
```

**`PUT /v1/groups/:group_no/setting`** 请求体（部分）：

```json
{
 "notice": "新公告内容 > 200 字应折叠",
 "forbidden": 0,
 "join_type": 0, // 0=自由加入 1=需审核 2=禁止
 "invite_perm": 1, // 0=仅群主 1=成员可邀请
 "mute_all": 0
}
```

## 3. 消息域（Message Module）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/message/send` | 是 | 代发消息（系统/机器人） |
| POST | `/v1/message/sync` | 是 | 写模式同步（历史） |
| POST | `/v1/message/syncack/:last_message_seq` | 是 | 同步回执 |
| POST | `/v1/message/channel/sync` | 是 | 同步某频道消息（读模式主用） |
| POST | `/v1/message/extra/sync` | 是 | 同步消息扩展（已读/撤回/reaction） |
| POST | `/v1/message/readed` | 是 | 消息已读 |
| POST | `/v1/message/revoke` | 是 | 撤回（默认 120s 内） |
| POST | `/v1/message/edit` | 是 | 编辑 |
| POST | `/v1/message/typing` | 是 | typing 提示 |
| POST | `/v1/message/search` | 是 | 消息搜索（关键字 + 频道范围） |
| POST | `/v1/message/offset` | 是 | 清除某频道消息（标记已清） |
| DELETE | `/v1/message` | 是 | 删除单条 |
| DELETE | `/v1/message/mutual` | 是 | 双向删除 |
| PUT | `/v1/message/voicereaded` | 是 | 语音已读 |
| GET | `/v1/message/sync/sensitivewords` | 是 | 同步敏感词 |
| GET | `/v1/message/prohibit_words/sync` | 是 | 同步违禁词 |
| POST | `/v1/message/pinned` | 是 | 置顶 |
| POST | `/v1/message/pinned/sync` | 是 | 同步置顶 |
| POST | `/v1/message/pinned/clear` | 是 | 清置顶 |
| POST | `/v1/message/reminder/sync` | 是 | 同步提醒 |
| POST | `/v1/message/reminder/done` | 是 | 提醒已完成 |
| GET | `/v1/messages/:message_id/receipt` | 是 | 消息回执列表（已读/未读） |
| POST | `/v1/reactions` | 是 | 添加/取消 emoji reaction（toggle） |
| POST | `/v1/reaction/sync` | 是 | 同步 reaction |

**`POST /v1/message/send`** 请求体：

```json
{
 "channel_id": "g-uuid",
 "channel_type": 2, // 1=单聊 2=群
 "type": 1, // 1=text 2=image 3=voice 4=video 5=file 6=location 7=card 8=merge_forward 9=reply
 "payload": { "text": "hello", "mentions": ["uid-A"] },
 "client_msg_no": "client-uuid",
 "no_persist": false
}
```

**`POST /v1/message/revoke`** 请求体：

```json
{ "channel_id": "g-uuid", "channel_type": 2, "message_id": "m-uuid" }
```

**`POST /v1/reactions`** 请求体（toggle）：

```json
{ "channel_id": "g-uuid", "channel_type": 2, "message_id": "m-uuid", "emoji": "👍" }
```

**流式输出（与 Clowder 联动）**：
- im 消息通道走 ws `event.message` + `event.typing`。
- 智能体流式输出不是 `/v1/message/send`，而是 `POST /v1/clowder/conversation/message`（见 [im-api-reference.md §5](./im-api-reference.md#5-clowder-域)）。
- im 后端会把 Clowder 流回的消息转写为普通消息（带 `from_uid=<cat-id>`、`type=1`、payload.text 按 chunk 累加）。

### 3.1 最近会话域（Conversation Module）

> 补充来源：`TangSengDaoDaoWeb/packages/tsdaodaodatasource/src/module.ts`、`conversation.ts`、`datasource.ts`，以及 `sections/im/TangSengDaoDaoServer/modules/message/swagger/conversation.yaml`、`api_conversation.go`。

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/conversation/sync` | 是 | 同步最近会话列表；Web 启动和重连后主用 |
| POST | `/v1/conversation/syncack` | 是 | 最近会话同步回执 |
| POST | `/v1/conversation/extra/sync` | 是 | 同步最近会话扩展（草稿、浏览位置、保持位置） |
| POST | `/v1/conversations/:channel_id/:channel_type/extra` | 是 | 更新某会话扩展 |
| DELETE | `/v1/conversations/:channel_id/:channel_type` | 是 | 删除最近会话入口，不删除消息 |
| PUT | `/v1/coversation/clearUnread` | 是 | 清空/设置最近会话未读数；历史拼写兼容路径 |

> 注意：`coversation` 是 TangSeng 历史拼写，后端注释也标记为待迁移兼容路径。Web 源码仍调用 `PUT /v1/coversation/clearUnread`，测试与前端适配不能擅自改成 `conversation`。

**`POST /v1/conversation/sync`** 请求体：

```json
{
 "version": 0,
 "last_msg_seqs": "uid-a:1:20|g-uuid:2:88",
 "msg_count": 1,
 "device_uuid": "browser-device-id"
}
```

**`POST /v1/conversation/sync`** 响应：

```json
{
 "uid": "41232e72...",
 "conversations": [
  {
   "channel_id": "uid-b",
   "channel_type": 1,
   "unread": 2,
   "stick": 0,
   "mute": 0,
   "timestamp": 1780800000000,
   "last_message": { "message_id": 123, "payload": { "content": "hello" } }
  }
 ],
 "users": [],
 "groups": []
}
```

**`POST /v1/conversation/extra/sync`** 请求体：

```json
{ "version": 0 }
```

**`POST /v1/conversations/:channel_id/:channel_type/extra`** 请求体：

```json
{
 "browse_to": 101,
 "keep_message_seq": 98,
 "keep_offset_y": 240,
 "draft": "未发送草稿"
}
```

**`PUT /v1/coversation/clearUnread`** 请求体：

```json
{
 "channel_id": "uid-b",
 "channel_type": 1,
 "unread": 0,
 "message_seq": 0
}
```

### 3.2 搜索域（Search Module）

> 补充来源：`TangSengDaoDaoWeb/packages/tsdaodaobase/src/Components/GlobalSearch/vm.ts`、`sections/im/TangSengDaoDaoServer/modules/search/swagger/api.yaml`。

| Method | Path | Auth | 说明 |
|---|---|---|---|
| POST | `/v1/search/global` | 是 | 全局搜索好友、群、消息；可限制在某个 channel 内只搜消息 |

**`POST /v1/search/global`** 请求体：

```json
{
 "keyword": "需求",
 "page": 1,
 "limit": 20,
 "content_type": [1, 5],
 "only_message": 0,
 "channel_id": "g-uuid",
 "channel_type": 2,
 "from_uid": "uid-a",
 "start_time": 1780700000000,
 "end_time": 1780800000000
}
```

**响应结构**：

```json
{
 "friends": [
  { "channel_id": "uid-a", "channel_type": 1, "channel_name": "测试员A", "channel_remark": "" }
 ],
 "groups": [],
 "messages": [
  {
   "message_id": 123,
   "message_seq": 9,
   "client_msg_no": "client-uuid",
   "from_uid": "uid-a",
   "payload": { "content": "需求评审" },
   "channel": { "channel_id": "g-uuid", "channel_type": 2 }
  }
 ]
}
```

**网络探测注意事项**：
- 该接口会先调用 WuKongIM 消息搜索能力；当前 `172.18.58.156:3000` 环境实测在非空 `keyword` 下仍可能返回 `400 {"msg":"查询悟空IM消息错误"}`。
- 这表示路由和鉴权已通，但搜索下游或索引能力不可用；API 网络测试应把它标记为 `backend-dependent` 警告，而不是把空关键字健康检查当作通过标准。

## 4. 频道（Channel Module）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/channel/state` | 是 | 拿频道状态（max_seq 等） |
| GET | `/v1/channels/:channel_id/:channel_type` | 是 | 频道信息 |
| POST | `/v1/channels/:channel_id/:channel_type/message/autodelete` | 是 | 设置消息定时删除 |
| POST | `/v1/channels/:channel_id/:channel_type/message/clear` | 是 | 清空频道消息 |

## 5. 文件域（File Module）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/file/upload` | 是 | 拿上传地址（直传 OSS/MinIO/七牛/SeaweedFS） |
| POST | `/v1/file/upload` | 是 | 服务端代理上传（multipart） |
| GET | `/v1/file/preview/*path` | 否 | 拉取文件（流式响应） |

> V2 issue：当前文件上传**未做扩展名白名单**；`uploadFile` 接收任意文件；预览按 mime 兜底渲染。修复方向见 [V2-issue-solutions.md §13](./V2-issue-solutions.md#13-v2-13-文件预览4-个-fail)。

## 6. 群相关补充

- `group_no`：im 后端群号格式为 `g-` + uuid，im_web `chatType=2`（group）的 channelId 即 groupNo。
- 公告：超过 200 字前端应折叠（V2-06-07 计划要求）。
- 群主转让：原群主在转让后**仍**是成员；新群主可独立退群。
- 解散群：群主在群内任何人都能解散，解散后 im 推 `event.group.disband` 给所有成员。

## 7. TangSengDaoDaoWeb 前端依赖补充接口

> 补充来源：`TangSengDaoDaoWeb/packages/tsdaodaodatasource/src/datasource.ts`、`packages/tsdaodaocontacts/src/Organizational/GroupNew/index.tsx`。本地 `sections/im/TangSengDaoDaoServer/modules/` 当前未发现 `favorite`、`sticker`、`organization` 模块目录，只发现 `common/sql/common-20230203-01.sql` 中声明了 `favorite`、`sticker` 模块开关。因此这些接口应作为前端兼容依赖记录，并在网络测试里单独标记为“前端依赖 / 本地后端未确认”，不能误判为已由当前 Go 模块实现。

### 7.1 收藏（Favorite）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/favorite/my` | 是 | 我的收藏列表；Web 源码带 `page_index` / `page_size` 查询参数 |
| POST | `/v1/favorites` | 是 | 收藏一条消息内容 |
| DELETE | `/v1/favorites/:id` | 是 | 删除收藏 |

**`POST /v1/favorites`** 请求体：

```json
{
 "type": 1,
 "unique_key": 123456,
 "author_name": "测试员A",
 "author_uid": "uid-a",
 "payload": { "content": "收藏内容" }
}
```

### 7.2 贴纸 / 表情包（Sticker）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/sticker/user/category` | 是 | 我的贴纸分类 |
| GET | `/v1/sticker/user/sticker` | 是 | 某分类下的贴纸，查询参数 `category` |

### 7.3 组织架构（Organization）

| Method | Path | Auth | 说明 |
|---|---|---|---|
| GET | `/v1/organization/joined` | 是 | 当前用户加入的组织列表 |
| GET | `/v1/organizations/:org_id/department` | 是 | 组织部门树和员工列表 |

**`GET /v1/organizations/:org_id/department`** 响应结构（前端期望）：

```json
{
 "departments": [
  { "department_id": "dept-1", "name": "研发部", "parent_id": "" }
 ],
 "employees": [
  { "employee_id": "emp-1", "employee_name": "测试员A", "uid": "uid-a" }
 ]
}
```
