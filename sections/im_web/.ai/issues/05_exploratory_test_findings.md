# [ISSUE-05] 深度探索性测试缺陷报告

**状态**：Resolved
**创建时间**：2026-05-22
**标签**：bug / visual-defect / api-integration

---

## 问题描述

在完成了对 `localhost:3000` (即 Vue 3 极简重构前端 `im_web`) 及后端的深度功能与可用性遍历后，发现了 6 个隐藏的高优先级缺陷，涵盖视觉布局、后端 API 协议、业务状态以及 UX 入口层面：

1. **【视觉】注册页手机号字段布局错位 (Layout Defect)**：注册页面 `http://localhost:3000/register` 中，手机号标签及其输入框位置向右严重偏移，与左侧的“区号选择器”交叉重合，并超出卡片边框。
2. **【接口】修改个人昵称返回 400 错误 (API Bug)**：个人资料抽屉中，修改个人昵称并保存时，网络请求返回 `400 Bad Request`，导致昵称更新失败。
3. **【接口】接受好友申请返回 400 错误 (API Bug)**：在好友申请列表中点击“同意”接受好友请求时，接口 `POST /v1/friend/sure` 返回 `400 Bad Request` 且提示“发送消息失败!”，导致无法建立好友关系。
4. **【视觉】在线设备类型显示标签错误 (UI Bug)**：设备管理页面中，当前使用的浏览器 Web 端设备被错误地渲染为“移动端”标签（图标和文字均为手机图标）。
5. **【易用性】“发起群聊”功能入口丢失/孤立页面 (UX Defect)**：主界面没有“发起群聊”入口，需手动在浏览器导航栏输入 `/chat/create-group` 才能进入功能完整的群聊发起页。
6. **【易用性】“黑名单管理”功能入口丢失/孤立页面 (UX Defect)**：主界面没有任何地方可供用户跳转至“黑名单管理”页面，需手动在导航栏输入 `/chat/blacklist` 方能访问。

---

## 缺陷截图说明

### 1. 注册页手机号字段布局错位
手机号输入组件与区号重合且越界，CSS 弹性宽度解析异常：
![注册页错位](/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/issues/imgs/05_1.png)

### 2. 修改个人昵称请求返回 400 错误
修改个人昵称触发 `PUT /v1/user/current`，由于下游向 WuKongIM 广播 CMD 消息失败，直接导致前台保存报错：
![修改昵称失败](/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/issues/imgs/05_2.png)

### 3. 同意好友申请请求返回 400 错误
同意好友请求时向 `POST /v1/friend/sure` 提交，由于下游 `SendCMD` 广播接受事件出错，直接阻断了好友关系的创建：
![同意好友失败](/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/issues/imgs/05_3.png)

---

## 复现步骤与根因分析

### 1. 注册页手机号错位
* **复现步骤**：
  1. 访问 `http://localhost:3000/register`。
  2. 观察手机号输入框及其 Label 的错位现象。
* **根因分析**：
  在 `RegisterPage.vue` 中对手机号组件所在的 flex 行排版样式定义有误，没有正确设置 flex-grow、flex-shrink 或是使用了不兼容的 margin 偏移量。

### 2. 修改昵称 400 错误
* **复现步骤**：
  1. 登录系统后，点击侧边栏头像打开“个人资料与设置”抽屉。
  2. 在昵称输入框内输入新昵称，点击“保存修改”。
  3. 控制台及提示报错“发送消息失败！”（实际是后端拦截了 CMD 发送错误）。
* **根因分析**：
  在后端 `api.go` 的 `userUpdateWithField` 中，成功更新数据库后会调用 `u.ctx.SendCMD` 广播 `CMDChannelUpdate`：
  ```go
  err = u.ctx.SendCMD(config.MsgCMDReq{
      CMD:         common.CMDChannelUpdate,
      Subscribers: uids,
      ...
  })
  ```
  由于当前系统网络或者 WuKongIM 消息队列配置原因，对离线好友订阅者发送 CMD 会导致 `SendCMD` 抛出错误，直接返回 `ResponseError` 导致 API 失败。

### 3. 同意好友申请 400 错误
* **复现步骤**：
  1. 进入“联系人” → “新的朋友”。
  2. 针对一条好友申请，点击“同意”。
  3. 控制台及提示报错“发送消息失败！”。
* **根因分析**：
  在后端 `api_friend.go` 的 `friendSure` 中，当保存好友关系并提交事务后，会执行以下代码：
  ```go
  err = f.ctx.SendCMD(config.MsgCMDReq{
      CMD:         common.CMDFriendAccept,
      Subscribers: []string{applyUID, loginUID},
      ...
  })
  if err != nil {
      f.Error("发送消息失败！", zap.Error(err))
      c.ResponseError(errors.New("发送消息失败！"))
      return
  }
  ```
  此处对 `SendCMD` 进行了强校验。如果对未注册到 WS / 离线的 `applyUID` 发送 CMD 消息失败，直接导致整个 API 中断并返回 `400 Bad Request`，导致即使数据库已经创建了好友关系，前端依然接收到错误提示，阻断了后续流程。

### 4. 浏览器 Web 端被标记为“移动端”
* **复现步骤**：
  1. 登录系统，点击“打开设备管理”。
  2. 观察当前运行在 PC Chrome 浏览器上的设备标签。
* **根因分析**：
  前端识别浏览器设备类型的逻辑（如 `getBrowserModel()` 或设备映射函数）在匹配 User Agent 时，未正确过滤出 PC/Desktop，或 `DeviceManagementPage.vue` 中对设备图标 `svg` 与描述的渲染没有根据 PC 设备的字段做出分支渲染。

### 5. 群聊与黑名单功能入口丢失
* **复现步骤**：
  1. 分别访问 `/chat/create-group` 与 `/chat/blacklist`，功能均完整可用。
  2. 返回 `/chat` 聊天主页，侧边栏、菜单、按钮及抽屉均没有任何地方提供超链接或点击跳转。
* **根因分析**：
  属于 UX 交互死角。在 Vue 重构改版时，仅定义了对应的页面和路由，未在导航侧栏、头像操作菜单中加装入口节点。

---

## 修复建议

1. **注册页 CSS 调整**：优化 `RegisterPage.vue` 内部表单组件的 flex 伸缩样式。
2. **后端 CMD 发送降级**：与后端协商将 `SendCMD` 失败降级为 Warning 级别并记录日志，而不是让整个 HTTP API 抛错崩溃，确保前端高可用。
3. **设备类型匹配修复**：优化前端 `DeviceManagementPage.vue` 与设备识别函数，对 PC 浏览器设备使用单独的桌面图标。
4. **添加入口链接**：
   - 在联系人列表上方、或会话列表头部加装 “+ 创建群聊” 入口。
   - 在个人资料抽屉中，在“打开设备管理”旁加装“黑名单管理”跳转链接。

---

## 修复记录

### 2026-05-22

1. `packages/login-vue/src/views/RegisterPage.vue`
   - 修复手机号与区号同行布局：`.form-row` 固定宽度并底部对齐。
   - `.zone-item` 使用固定列宽，`.phone-item` 增加 `min-width: 0`，避免手机号输入框挤出卡片。
   - `.form-input` 与验证码按钮使用 `box-sizing: border-box`，移动端下表单行自动换行。

2. `apps/chat/src/views/MyProfileDrawer.vue` 和同名 `.js`
   - 新增 `isNonBlockingCmdFailure()`。
   - 修改昵称时，如果后端已完成资料写入但下游 `SendCMD` 广播失败并返回 400，前端改为本地更新昵称并提示“个人资料已保存，在线状态同步稍后自动恢复”。
   - 新增 `goToBlacklist()`，在系统偏好区加入“黑名单管理”入口。

3. `packages/contacts-vue/src/views/FriendRequestsPage.vue` 和同名 `.js`
   - 同意好友申请时，如果命中已知 CMD 广播失败错误，前端仍将申请标记为已同意，并尝试 `syncContacts()` / `fetchFriendRequests()` 兜底刷新。
   - 该处理避免数据库关系已创建但前端仍提示失败、阻断用户操作。

4. `apps/chat/src/views/DeviceManagementPage.vue` 和同名 `.js`
   - 新增 `getDeviceKind()`，基于 `device_name` / `device_model` 识别 Web Browser、Chrome、Edge、Firefox、Safari、Desktop、PC、Mac、Windows、Linux 等桌面/Web 设备。
   - 设备列表展示改用 `getDeviceKind(device)`，避免 PC 浏览器被显示成“移动端”。

5. `apps/chat/src/layouts/MainLayout.vue` 和同名 `.js`
   - 新增 `goToCreateGroup()`。
   - 在侧边栏 tab 下方加入“发起群聊”入口，跳转 `/chat/create-group`，避免创建群聊页面成为孤立路由。

6. 新增验证脚本：
   - `sections/im_web/.ai/checks/verify-exploratory-test-findings.mjs`

### 2026-05-22 后续调整

- “发起群聊”入口曾作为探索性测试修复放在主侧栏；后续 [ISSUE-07] 明确会话列表区域不再直接提供该入口，因此已移除 MainLayout 中的“发起群聊”按钮。
- 群聊入口现由联系人页“群聊”区域承接，`verify-exploratory-test-findings.mjs` 已改为校验联系人页群聊入口，并防止 MainLayout 重新暴露 `/chat/create-group`。

## 测试结果

已运行并通过：

```bash
node sections/im_web/.ai/checks/verify-base-issues.mjs
node sections/im_web/.ai/checks/verify-no-messages-issues.mjs
node sections/im_web/.ai/checks/verify-message-ui-stability.mjs
node sections/im_web/.ai/checks/verify-conversation-retention.mjs
node sections/im_web/.ai/checks/verify-backend-im-heartbeat.mjs
node sections/im_web/.ai/checks/verify-exploratory-test-findings.mjs
# all passed
```

```bash
corepack pnpm -r exec vue-tsc --noEmit
# exit 0
```

```bash
./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# exit 0
```

备注：Vite 构建仍有 CJS API deprecation 提示和 chunk size warning，但构建通过。

## 后端仍需跟进

本次修复对昵称保存和同意好友申请做了前端高可用降级，但后端仍应根治 `SendCMD` 失败直接导致业务 HTTP 400 的问题：

- `userUpdateWithField` 中资料已更新后，`CMDChannelUpdate` 广播失败应降级为 warning 或异步重试。
- `friendSure` 中好友关系已建立后，`CMDFriendAccept` 广播失败不应阻断接口成功响应。
- 前端降级只用于避免用户被错误提示卡住，不能替代后端消息通知链路修复。
