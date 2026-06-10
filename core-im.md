# Core IM - Message Hub

## 二、核心功能模块

### 2.1 IM 消息中心（Message Hub）

#### 功能描述

IM 消息中心是用户与 Agent、Agent 与 Agent 之间所有消息流转的枢纽。前端 `sections/ui` 负责会话列表、消息输入、消息气泡、附件预览、引用回复、反应、流式展示和本地发送状态；后端 `sections/im/TangSengDaoDaoServer` 以 TangSengDaoDao / WuKongIM 作为消息持久化与实时通道，并通过 `modules/clowder` 将 IM 会话桥接到 Clowder 的 thread、Agent 路由、权限、上下文和流式回复体系。

消息中心的设计原则是：

- TangSengDaoDao / WuKongIM 仍是 IM 消息、群聊、未读、回执、置顶和实时同步的权威来源。
- Clowder 仍是 Agent 注册、thread 绑定、Agent 路由、权限、调用状态、上下文 pin 和产物/部署工作流的权威来源。
- 前端不保存秘密，不复制 Clowder 内部路由逻辑，只消费 IM 后端提供的 `/v1/message/*`、`/v1/clowder/*` 与 WuKongIM SDK 事件。
- 流式 Agent 回复必须合并为同一条可见消息，避免刷新、重连或 chunk 到达时生成重复气泡。

#### 核心能力

| 能力 | 说明 | 优先级 | 当前代码依据 |
| --- | --- | --- | --- |
| 消息收发 | 支持文本、图片、文件附件、语音占位、Markdown、Agent 卡片类消息；文本走 WuKongIM/TangSeng，Clowder 直聊可走 `/v1/clowder/conversation/message` | P0 | `sections/ui/stores/message.js`、`services/native-im/service.js`、后端 `/v1/message/send` |
| 历史管理 | 按会话/线程组织消息，前端按 `conversationId` 分桶，后端按 `channelId + channelType` 同步频道消息 | P0 | `syncNativeMessages()`、`/v1/message/channel/sync`、`/v1/message/sync` |
| 上下文传递 | Clowder 会话会缓存用户成功发送的文本消息，并作为 `promptContext` 传给后端桥接；Clowder thread 侧支持 manual context pins | P0 | `rememberClowderPromptContext()`、`BuildInboundPersistMessage()`、`/v1/clowder/thread/:threadId/manual-context-pins` |
| 消息状态 | 前端统一为 `sending / success / failed / revoked / edited`；Agent 流式态为 `placeholder / chunk / final / cleanup`；产品态映射为 `queued -> streaming -> done / error / cancelled` | P0 | `normalizeStatus()`、`normalizeStreamState()`、`mergeAgentReplyEventIntoList()` |
| 实时推送 | WuKongIM SDK 负责 WebSocket 连接、消息监听、会话同步和多端同步；后端 `AddMessagesListener` 监听消息并转发给 Clowder | P0 | `wukongimjssdk` provider、`Message.Route()`、`registerClowderBridgeListener()` |
| 引用/回复 | 输入框维护 `replyTarget`，发送 payload 带 `replyRef`，气泡展示引用并支持跳转目标消息 | P1 | `reply-state.js`、`MessageInput.vue`、`MessageBubble.vue` |
| Pin 消息 | 后端支持置顶/取消置顶、置顶同步、清空置顶；群聊按群主/管理员或群配置校验权限 | P1 | `/v1/message/pinned`、`/v1/message/pinned/sync`、`db_pinned.go` |
| Reaction/ACK | 支持普通 reaction 同步；Clowder 可发送 silent `clowder_reaction`，用于把“已收到/正在处理”反馈附着到用户消息上 | P1 | `/v1/reactions`、`normalizeClowderReactionEvent()`、`BuildOutboundMessage()` |
| 富媒体/产物卡片 | 前端已有 deployment card、project group card、template cats card；Clowder outbound 支持 `richBlocks`、`media`、`metadata`，UI 需逐步映射为 artifact/preview/diff 等卡片 | P1 | `DeploymentCard.vue`、`project-group.js`、`coordinator-template-cats.js`、`OutboundPayload.RichBlocks` |

#### 消息模型

前端标准消息对象由 `normalizeMessage()` 与 `defaultMsg()` 收敛，核心字段如下：

| 字段 | 说明 |
| --- | --- |
| `id` | 前端主键，优先使用 `message_id / client_msg_no / streamKey` |
| `messageId` | TangSeng / WuKongIM 服务端消息 ID |
| `messageSeq` | 频道内消息序列，用于分页、同步、置顶 |
| `clientMsgNo` | 客户端发送去重键；流式消息可使用稳定 stream key |
| `senderId / senderName / senderAvatar` | 发送者身份；群聊用于展示成员名，Clowder 回复可用虚拟发送者 |
| `type` | 前端渲染类型，如 `text / image / file / voice / system / deployment_card` |
| `content` | 文本、Markdown 内容、图片 URL 或文件说明 |
| `url / fileName / fileSize / fileType / previewContent` | 图片/文件附件与预览字段 |
| `status` | `sending / success / failed / revoked / edited` |
| `streamKey / streaming / streamPhase` | Agent 流式消息合并字段 |
| `renderMode / isMarkdown` | Markdown 渲染标记 |
| `replyRef` | 引用消息 `{ messageId, senderName, contentPreview }` |
| `mentions / mentionAll / mentionUids` | 群聊 @ 信息 |
| `reactions` | emoji 反应聚合 |
| `raw` | 原始 payload，供兼容和调试 |

后端 Clowder inbound 归一后的 `InboundMessage` 字段如下：

| 字段 | 说明 |
| --- | --- |
| `connectorId` | 固定为 `im-web` |
| `externalChatId` | Clowder 侧会话外部 ID，格式为 `{channelType}:{channelIdOrFakeChannelId}` |
| `channelId / channelType / chatType / chatName` | TangSeng 会话身份 |
| `messageId / clientMsgNo / messageSeq` | 消息身份与去重信息 |
| `text` | 从 TangSeng payload 中提取的文本或媒体占位内容 |
| `sender` | `{ id, name }`，保留真实 IM 用户身份 |
| `attachments` | 图片/文件等媒体归一为 `{ type, url, fileName, size }` |
| `mentions` | 从 payload `mention.uids` 提取的 @ 目标 |
| `directCatId / targetCatIds` | 指定 Agent 或多 Agent 目标 |
| `promptContext` | 前端/后端传入的上下文摘要 |
| `sourceRoleSnapshot` | 群成员角色快照，用于 Clowder 权限判断 |

#### 消息类型设计

| 逻辑类型 | 前端/后端映射 | 说明 |
| --- | --- | --- |
| `text` | TangSeng `type: 1`，前端 `type: "text"` | 普通文本；可附 `markdown: true` 或 `format: "markdown"` |
| `image` | TangSeng `type: 2`，前端 `type: "image"` | 图片上传后转为远端 URL；当前前端展示使用 `content/url` |
| `file` | TangSeng `type: 8`，前端 `type: "file"` | 文件附件，包含文件名、大小、URL、预览内容 |
| `voice` | TangSeng `type: 4`，前端 `type: "voice"` | UI 已有语音卡片与录音入口，真实录音链路可后续完善 |
| `code` | `text + markdown` 的 fenced code block | 由 Markdown 渲染器展示代码块；后续可增加语法高亮标记 |
| `diff` | 建议映射为 `artifact/diff richBlock` 或 Markdown diff code block | 用于代码变更视图；当前需要补专用 Diff 组件 |
| `artifact` | `richBlocks` / `metadata` / 文件消息 / project card | 产物卡片，如代码、文档、网页、线程 artifacts |
| `deployment` | 前端 `deployment_card` | 部署状态、确认、取消、重试、日志/预览入口 |
| `preview` | 文件预览或部署预览 URL | 可用 `previewContent/contentUrl/sourceUrl` 或 iframe 预览页承载 |
| `a2a_handoff` | `system` 或 `richBlocks` 系统事件 | Agent 交接事件，建议统一为系统消息并携带 thread/invocation metadata |
| `system_info` | TangSeng `type: 99/1000`，前端 `type: "system"` | 错误、超时、取消、群事件、silent reaction 等系统通知 |

#### 状态流转

用户消息发送：

```text
local append
  -> sending
  -> success       # 后端/WuKongIM 返回成功，消息与会话摘要合并
  -> failed        # 发送、上传、SDK 或权限失败
```

Agent 回复：

```text
queued / placeholder
  -> streaming / chunk
  -> done / final
  -> error / cancelled / cleanup
```

实现要求：

- 前端发送时先乐观插入本地消息，使用 `clientMsgNo` 做去重。
- 服务端返回的同一条消息必须通过 `messageId / clientMsgNo / streamKey` 合并，不新增重复气泡。
- Clowder streaming 的 `placeholder/chunk/final` 必须使用同一 `platformMessageId` 或稳定 `client_msg_no`。
- `cleanup` 事件不应生成空消息；后端已有 `ErrOutboundNoop` 保护。
- 失败消息保留在原位置，用户可通过气泡失败态重试。

#### 实时与历史同步

Message Hub 的同步分为三层：

1. WuKongIM WebSocket：浏览器通过 `wukongimjssdk` 获取连接地址，监听新消息、命令、会话变更与消息状态。
2. TangSeng REST 同步：前端通过 `/v1/message/channel/sync` 等接口按频道拉取历史消息，刷新或重连后恢复消息列表。
3. Clowder bridge：后端 `registerClowderBridgeListener()` / `MessagesListenWithRoles()` 将 IM 消息转成 Clowder inbound；Clowder outbound 通过 `/api/im-web/clowder/outbound` 写回 TangSeng。

会话 ID 约定：

- 单聊：`channelType = 1`，真实展示会话需要使用 TangSeng fake channel 规则处理双方 UID。
- 群聊：`channelType = 2`，`channelId` 为 group no。
- Clowder external chat：`externalChatId = "{channelType}:{channelIdOrFakeChannelId}"`。
- Clowder thread binding：`connectorId + externalChatId -> threadId`。

#### 上下文与 Pin

上下文分为短期上下文和长期上下文：

- 短期上下文：前端对 Clowder 会话缓存最近成功发送的用户文本消息，发送到 Clowder 直聊时作为 `promptContext`；默认适合保留最近若干轮用户意图。
- 长期上下文：后端代理 Clowder manual context pins，支持按 thread 管理长期上下文，并可标记源消息状态。
- IM 置顶：TangSeng `/v1/message/pinned` 是 IM 层 pin，影响聊天窗口和多端同步；Clowder manual context pin 是 Agent prompt 层 pin，二者应在 UI 上区分但可以互相引用源消息。

置顶权限：

- 单聊使用 fake channel 记录置顶。
- 群聊要求群存在且未删除；非群主/管理员时需要群配置允许成员置顶。
- 达到应用配置的频道置顶上限时拒绝新增置顶。

#### 引用、回复与 @

- 输入框 `replyTarget` 只对当前会话有效，切换会话时必须清理不匹配的引用目标。
- 发送 payload 中携带 `replyRef`，消息气泡展示引用摘要并支持跳转。
- @ 选择器从群成员/Agent 候选中插入 `@name`，归一化时保留 `mentions` 与 `mentionUids`。
- Clowder 群聊路由应优先识别明确 @、`directCatId`、`targetCatIds` 和 `/ask` 等命令，避免 Agent 无触发条件地插话。

#### 前端 UI 职责

| 模块 | 职责 |
| --- | --- |
| `MessageInput.vue` | 文本输入、图片/文件入口、语音入口、引用条、@ 选择器、发送事件 |
| `MessageList.vue` | 消息列表、时间分隔、滚动到底、消息事件转发 |
| `MessageBubble.vue` | 系统消息、文本/Markdown、图片、文件、语音、引用、反应、失败/发送中状态 |
| `MessageContextMenu.vue` | 回复、复制、转发、收藏/置顶等上下文操作入口 |
| `DeploymentCard.vue` | 部署确认、状态、重试和布局变化回调 |
| `FileCard.vue` / `FilePreviewPanel.vue` | 文件消息展示、预览、下载/打开 |
| `ClowderPanel.vue` | Agent 目录、会话绑定、focus、权限和 Clowder 状态 |

#### 后端职责

| 模块 | 职责 |
| --- | --- |
| `modules/message` | 消息同步、撤回、编辑、已读、reaction、reminder、pinned、频道历史 |
| `modules/file` | 上传 URL、文件服务适配、图片/文件远端地址 |
| `modules/group` | 群成员、群权限、置顶权限、群配置 |
| `modules/clowder/normalize.go` | IM inbound payload 归一为 Clowder `InboundMessage` |
| `modules/clowder/listener.go` | 监听 TangSeng 消息并转发给 Clowder |
| `modules/clowder/outbound.go` | 将 Clowder outbound 转成 TangSeng `MsgSendReq` |
| `modules/clowder/api.go` | `/v1/clowder/*` 状态、Agent 目录、会话绑定、focus、deployment、thread artifacts、manual pins 代理 |
| `modules/common/clowder_signature.go` | Bridge 签名与服务端安全校验 |

#### 用户故事

> 作为用户，当我在对话框输入“用 React 写一个 Todo 组件”并发送，我希望指定的 Agent（如 Claude）立即收到我的消息并开始生成代码，以便我在聊天流中实时看到代码生成过程和最终结果。

验收流程：

1. 用户在 Clowder 直聊或群聊中输入请求并发送。
2. 前端立即插入本地消息，状态为 `sending`，生成 `clientMsgNo`。
3. 后端持久化成功后，前端将消息合并为 `success`，会话列表更新摘要。
4. 后端 Clowder listener 将消息归一为 `InboundMessage`，包含 sender、externalChatId、messageId、mentions 和 promptContext。
5. Clowder 根据 thread binding、Agent 目录、@/focus/权限路由给目标 Agent。
6. Agent 回复先以 ACK/reaction 或 placeholder 呈现，再以 chunk 持续更新同一条 Markdown 消息。
7. final 到达后，消息状态为 `success`，如有代码文件、部署请求或预览产物，则追加对应文件/卡片消息。
8. 用户刷新页面后，历史消息不重复；最终回复和附件可从 TangSeng 历史或 Clowder thread artifacts 恢复。

#### P0 验收标准

- 文本消息、图片、文件附件可以在单聊和群聊中发送、展示、失败重试。
- 历史消息按频道拉取，刷新/重连后没有重复消息。
- Clowder 直聊和群聊 @ Agent 能路由到正确 thread / Agent。
- Agent 流式回复在 UI 中合并为一条消息，final 后状态稳定。
- 发送消息时能携带必要上下文给 Agent，且不把密钥暴露到前端。
- WuKongIM WebSocket 与 REST 同步都可用，多端收到同一条消息。
- 错误、超时、权限拒绝、Clowder 不可用都有可见系统通知或失败态。

#### P1 验收标准

- 引用回复在发送、展示、跳转和切换会话时状态正确。
- Pin 消息支持单聊/群聊权限校验、同步和清空；Clowder manual context pin 可管理长期上下文。
- 支持 reaction/ACK，并能把 Clowder silent reaction 附着到目标用户消息。
- deployment、artifact、preview、diff、a2a_handoff 等富媒体消息有稳定的 UI fallback。
- Agent 交接、部署状态、文件产物能在消息流中保留可追溯 metadata。

#### 待补齐事项

- `code` / `diff` 目前主要依赖 Markdown，尚需专用高亮与 Diff 视图组件。
- `artifact` / `preview` 需要统一 rich block 到 UI 卡片的 schema。
- `a2a_handoff` 需要定义标准系统事件字段，避免不同 Agent 自由拼文本。
- 前端 Pin 操作入口需要和后端 `/v1/message/pinned*` 彻底接通，并区分 IM pin 与 Clowder manual context pin。
- 流式错误、取消和 queue full 需要明确映射到 `error / cancelled` 的系统消息或卡片状态。
