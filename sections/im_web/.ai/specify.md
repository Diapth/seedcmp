# Feature Specification: TangSengDaoDaoWeb Vue 3 重构规范说明

**Feature Branch**: `vue3-im-refactor`  
**Created**: 2026-05-21  
**Status**: Draft  
**Input**: 根据 `sections/im/TangSengDaoDaoWeb` 的 React 代码架构，完整重构为 Vue 3 版本，并完成与 `TangSengDaoDaoServer` 及 `WuKongIM` 网关的基础 IM 通信会话适配。

## Clarifications

### Session 2026-05-21
- Q: Out-of-Scope 模块的具体排除边界？ → A: 完全排除。不实现 WebRTC 实时音视频、朋友圈 (Moments) 及钱包红包，在极简 UI 菜单上彻底隐藏对应入口。
- Q: 极简风格下的加载与空数据状态规范？ → A: 骨架屏流式加载。使用与会话/联系人项高度一致的纯灰底扁平骨架屏进行渐隐渐现加载；空数据时使用轻量线稿风格的标准空状态图标与文本。
- Q: 多端登录冲突与强退界面的极简交互规范？ → A: 置灰微遮罩+极简浮窗。页面不跳转，界面瞬间覆盖一层极轻薄半透明灰色遮罩，中心弹出一像素描边极简通知框提示被踢下线，提供单键“重新登录”按钮跳转回登录页。

---

## 1. 整体架构与子包 Vue 3 映射关系

重构版本必须严格遵守原版 React 前端的 Monorepo 模块化管理方式，建立高度对齐的子包目录体系：

```
React (原版 Web)                             Vue 3 (重构版 Web)
├── packages/tsdaodaobase                 --> └── packages/tsdaodaobase-vue
│   ├── src/Service/APIClient.ts          │   ├── src/Service/APIClient.ts (基于 Axios 拦截器)
│   ├── src/Service/Const.ts              │   ├── src/Service/Const.ts (消息类型码与枚举定义)
│   └── src/App.tsx & module.tsx          │   └── src/App.ts & module.ts (BaseModule 初始化与事件总线)
├── packages/tsdaodaologin                --> └── packages/tsdaodaologin-vue
│   └── src/login_vm.tsx & login.tsx      │   └── src/stores/login.ts (Pinia 驱动的扫码及验证码登录状态机)
├── packages/tsdaodaocontacts             --> └── packages/tsdaodaocontacts-vue
│   └── src/contacts.tsx                  │   └── src/Pages/Contacts (拼音检索联系人名册及好友申请)
└── packages/tsdaodaodatasource           --> └── packages/tsdaodaodatasource-vue
    └── src/datasource.ts & conversation.ts   └── src/stores/datasource.ts (会话、消息缓存 Pinia 数据源)
```

- **视觉与 UI 组件一致性**: 原版使用 `@douyinfe/semi-ui` 风格组件，重构版本 Vue 3 采用 `Arco Design Vue` 组件库，配合极简主义单色色卡（浅色模式白 `#FFFFFF`/灰 `#F7F7F9`；深色模式炭黑 `#121212`/灰 `#1E1E1E`）以及一像素极细发丝描边（Hairline Border），呈现 100% 纯净、克制、无视觉噪音的扁平极简主义排版美学。
- **响应式数据流**: 取代 React 冗余手动更新机制，使用 **Pinia** 集中调度，将全局会话、消息与联系人缓存绑定为 Vue 响应式状态。

---

## 2. User Scenarios & Testing *(mandatory)*

### User Story 1 - 基础即时通信与会话保障 (Priority: P1)

用户使用手机号或扫码登录后，系统无缝建立与 WuKongIM 网关的 WebSocket 长连接，实现消息收发、免打扰置顶、会话扩展同步、草稿多端对齐以及自适应断线重连。

**Why this priority**: 核心 IM 通信是整个前端平台的基石，长连接与消息分发必须 100% 稳健，保证实时通信体验。

**Independent Test**: 可通过两名测试用户（如 13800138000 与 18337488675）登录互发消息，并在模拟弱网断线后，测试其消息自动重连补发及离线未读数对齐。

**Acceptance Scenarios**:

1. **Given** 用户在登录界面输入手机号 `008613800138000` 与测试验证码 `123456`，**When** 点击登录按钮，**Then** 系统鉴权成功，自动建立 WebSocket 并展示最近会话列表。
2. **Given** 处于聊天界面且网络断开，**When** 再次恢复网络连接，**Then** 客户端在 3 秒内完成自适应重连，并调用 `/conversation/sync` 补全离线期间的所有未读消息，同时通过 `/conversation/syncack` 同步会话确认点。
3. **Given** 用户在会话输入框键入内容但未发送就切走会话，**When** 触发组件失焦，**Then** 系统高亮显示红色的 `[草稿]` 标识与内容，且立即发起 `POST /conversations/:channel_id/:channel_type/extra`，在 `draft` 字段中持久化该草稿；当重新登入或增量同步时，调用 `/conversation/extra/sync` 将多端草稿无缝拉回。
4. **Given** 用户接收到离线消息并点击会话面板，**When** 双击或者右键清除未读时，**Then** 系统发起请求标记已读，并触发 `PUT /coversation/clearUnread` 清空未读数计数（API 路径拼写必须为 typo 兼容路径 `coversation`）。

---

### User Story 2 - 通讯录与好友申请管理 (Priority: P2)

用户在通讯录面板可以流畅检索拼音 A-Z 分组的好友，并对“新朋友”发起的好友申请进行实时同意、拒绝操作，即时同步好友关系。

**Why this priority**: 联系人名册是建立单聊和群聊的必备前置条件。

**Independent Test**: 使用测试号搜索未知 UID 用户并发送好友申请，对方应能即时在“新朋友”列表中接收通知并点击“同意”，随后双方名册自动刷新。

**Acceptance Scenarios**:

1. **Given** 用户进入通讯录模块，**When** 收到他人的好友申请，**Then** 系统增量同步提醒项并解析 `friendRequest` CMD，在新朋友菜单展示红色未读气泡计数。
2. **Given** 用户打开“新朋友”申请列表，**When** 点击“同意”按钮，**Then** 系统必须提取申请列表中携带的 `token`（非 apply_id），发起 `POST /friend/sure` 好友确认请求，同意成功后即时调用 `GET /friend/sync?api_version=1` 增量刷新本地好友缓存。
3. **Given** 好友名册处于打开状态，**When** 好友更改头像或昵称产生 CMD 消息，**Then** 系统捕获 `userAvatarUpdate`，无需刷新页面直接响应式更替头像与名册节点。

---

### User Story 3 - 群聊创建与设置管辖 (Priority: P2)

用户可在主页发起群聊，在群设置侧边栏完成群公告编辑、群二维码展示，并对群成员进行禁言或拉黑等管理操作。

**Why this priority**: 满足多人群组通信的基本业务需求，提供完整的群成员权限控制。

**Independent Test**: 多选好友发起群聊，点击右上角设置图标拉出群抽屉，测试编辑群公告并保存，检查其他群成员是否即时收到频道公告更新通知。

**Acceptance Scenarios**:

1. **Given** 用户点击主菜单“发起群聊”，**When** 多选数名联系人并确认，**Then** 调用 `/group/create` 创建群聊，自动在最近会话中插入并激活该群聊会话。
2. **Given** 进入群聊，**When** 点击右上角设置图标，**Then** 自右侧划出极简群设置抽屉，拉取群资料。当多选群成员并点击“移除群成员”时，系统 MUST 发送 `DELETE /v1/groups/:group_no/members`，且请求体内的参数键为 `members`（UID 数组）。
3. **Given** 群主或管理员在设置抽屉内，**When** 任免群管理员时，发送 `POST/DELETE /v1/groups/:group_no/managers`，且请求体必须封装为纯粹的 UID 字符串数组 `["uid1", "uid2"]`。
4. **Given** 群管理员对违规群成员进行禁言限制，**When** 选择禁言时长，**Then** 触发 `POST /v1/groups/:group_no/forbidden_with_member`，且请求体入参必须严格为 `{ "member_uid": "uid", "action": 1, "key": 3 }`（其中 action: 1禁言/0解禁，key 为时长枚举值）。
5. **Given** 用户在设置面板修改群属性（如免打扰、置顶、保存通讯录），**When** 点击开关，**Then** 发送 `PUT /v1/groups/:group_no/setting` 并提交 `{ "mute": 1, "top": 1, "save": 1 }`，同时完整兼容原项目 `show_nick`、`receipt`、`screenshot`、`revoke_remind` 等属性配置。

---

## 3. Edge Cases

- **弱网与断网临界状态**: 处于发送状态时正巧断网，消息气泡旁需显示旋转 Loading；若 10 秒后仍未收到 WuKongIM 送达回执，状态标记为红色感叹号（发送失败），支持点击一键重发。
- **撤回失效边界**: 发出超过 2 分钟的消息，“撤回”右键选项自动失效，不再允许用户发起撤回请求。
- **会话异常清理**: 当遇到服务器下发 `conversationDeleted` 指令时，系统必须即时清除内存中的对应会话，防止残留会话产生脏数据。
- **多端登录冲突与强退 (Kickout)**: 当收到系统踢出命令或鉴权失效，Web 页面不直接重定向，而是在聊天主界面覆盖一层半透明灰色微遮罩，主板中心弹出一像素极细发丝描边通知浮窗，提示“您的账号已在其他终端登录下线”，提供显式“重新登录”跳转按钮。

---

## 4. Functional Requirements *(mandatory)*

- **FR-001**: 系统 MUST 支持手机号与扫码 UUID 轮询两种登录方式，并在本地统一校验 `123456` 短信验证码。
- **FR-002**: 鉴权成功后，MUST 与 `ws://127.0.0.1:5200` 建立 WebSocket 长连接，并使用 token 进行首包握手校验。
- **FR-003**: 客户端 MUST 保持每 30 秒的自适应心跳，并在连续 3 次未收到 Pong 回执时触发指数退避自动重连。
- **FR-004**: 最近会话与草稿同步 MUST 通过 `POST /conversations/:channel_id/:channel_type/extra` 与 `/conversation/extra/sync` 增量对齐；清除未读数接口路径 MUST 兼容 typo 拼写为 `coversation/clearUnread`。
- **FR-005**: 消息气泡 MUST 完美支持文本与表情选择器、拖拽/粘贴发送图片及文件、2分钟内消息撤回与右键引用回复。
- **FR-006**: 联系人列表同步 MUST 采用 `GET /v1/friend/sync` 增量拉取（参数含 api_version=1）；好友申请同意接口 MUST 发送申请 `token`。
- **FR-007**: 移除群成员 MUST 发送 `members` 数组参数；任免群管理员请求体 MUST 使用单层 UID 字符串数组形式；群内单兵禁言入参 MUST 严格使用 `member_uid`, `action`, `key` 传递。
- **FR-008**: 消息和 CMD 监听（包含 `addMessageListener`、`addCMDListener`）均 MUST 在 `datasource-vue` 包顶级 Store 中集中注册与挂载，消除多实例监听。
- **FR-009**: 系统在页面首屏及列表（如会话、联系人）载入时，MUST 渲染与列表项结构高度一致的扁平化纯灰底骨架屏（Skeleton Screen）进行渐隐渐现加载；列表为空时，MUST 使用轻量单色线稿风格的标准空状态图标与文字进行无干扰提示。

---

## 5. Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 客户端登录后，WebSocket 连接及长连接鉴权握手必须在 **`1.5 秒`** 内完成并达到就绪状态。
- **SC-002**: 弱网恢复或自适应重连后，离线会话投影与未读数对齐在 **`2 秒`** 内同步渲染完毕。
- **SC-003**: 即使在 5000 行超长聊天历史高频滚动时，列表渲染帧率仍必须维持在 **`58 FPS`** 以上，保证无卡顿掉帧。

---

## 6. Out of Scope (排除范围)

为了集中精力构建卓越、清爽的极简即时通讯体验，以下庞大模块明确排除在本阶段 Vue 3 重构范围之外，并在前端所有 UI 入口和设置项中进行隐藏：
- **音视频呼叫**: 不实现 WebRTC 实时音视频单聊/群聊通话模块。
- **朋友圈 (Moments)**: 不重构原前端朋友圈的动态发布、评论、点赞等 UI。
- **钱包与红包**: 彻底移除红包收发、零钱充值提现等支付及金融类交互。
