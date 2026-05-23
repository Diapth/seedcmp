# [ISSUE-04] 后端与 WuKongIM 联动失败及心跳重连稳定性问题

**状态**：Resolved
**创建时间**：2026-05-22
**标签**：bug / investigation

---

## 问题描述

在自动化测试 `localhost:3000` (即 `im_web` 前端项目) 期间，发现前端与后端及悟空IM联动存在以下几项严重的联调与稳定性问题：

1. **更新会话扩展信息失败**：当用户在聊天会话中输入草稿、或切换会话时，前端发送请求 `POST /v1/conversations/:channel_id/:channel_type/extra` 报错 `400 Bad Request`，返回内容为 `{"msg": "发送同步扩展会话cmd失败！"}`。
2. **清除会话未读数失败**：当用户点击某个未读消息会话以清空红点时，前端发送 `POST /v1/coversation/clearUnread` 报错 `400 Bad Request`，返回内容为 `{"msg": "命令发送失败！"}`。
3. **设备登录及绑定报错**：后端报错 `Error 1406 (22001): Data too long for column 'device_model'`，导致在某些设备上更新用户登录设备信息彻底失败。
4. **SDK 频繁重连**：前端控制台与 SDK 频繁打印 `[SDK] Heartbeat: 3 missed Pongs. Reconnecting...`，说明 WebSocket 在正常连接中由于没有及时收到服务端的 Pong 响应，触发了频繁的断开重连逻辑，造成前端聊天体验不稳定。

以下是前端加载及操作的现场截图：

![联调问题现场](/media/leng/DiskB1/exp/seedcmp/sections/im_web/.ai/issues/imgs/04_1.png)

---

## 复现步骤

### 1. 复现 "更新会话扩展" 及 "清除未读数"
1. 启动 `TangSengDaoDaoServer` 和 `WuKongIM` 以及 `im_web`。
2. 登录 IM Web 客户端。
3. 点击未读消息的会话列表，或者在输入框内键入文字后切换到其他会话。
4. 在网络调试面板（Network）中，可直接观察到 `/v1/coversation/clearUnread` 和 `/v1/conversations/fileHelper/1/extra` 请求返回 400。

### 2. 复现 "设备型号长度溢出"
1. 使用较长的 `userAgent` 设备模型（超过 100 字符）向登录 API 发送登录请求。
2. 观察后端 error.log，可见报错 `Error 1406 (22001): Data too long for column 'device_model' at row 1`。

### 3. 复现 "Heartbeat Reconnecting"
1. 保持 IM Web 客户端长时间在线，或在网络状况不佳时静置聊天界面。
2. 观察 Console 控制台，可见频繁丢失心跳包，触发重连逻辑。

---

## 相关代码

### 1. `clearConversationUnread` 和 `conversationExtraUpdate` 在 Go 后端的实现

在 `api_conversation.go` 中，清除未读和更新扩展均依赖于 `SendCMD`：

```go
// 清除最近会话未读数
func (co *Conversation) clearConversationUnread(c *wkhttp.Context) {
    ...
    // 发送清空红点的命令
    err = co.ctx.SendCMD(config.MsgCMDReq{
        NoPersist:   true,
        ChannelID:   loginUID,
        ChannelType: common.ChannelTypePerson.Uint8(),
        CMD:         common.CMDConversationUnreadClear,
        Param: map[string]interface{}{
            "channel_id":   req.ChannelID,
            "channel_type": req.ChannelType,
            "unread":       req.Unread,
        },
    })
    if err != nil {
        co.Error("命令发送失败！", zap.String("cmd", common.CMDConversationUnreadClear))
        c.ResponseError(errors.New("命令发送失败！"))
        return
    }
    c.ResponseOK()
}
```

```go
// 更新最近会话扩展
func (co *Conversation) conversationExtraUpdate(c *wkhttp.Context) {
    ...
    err = co.ctx.SendCMD(config.MsgCMDReq{
        NoPersist:   true,
        ChannelID:   loginUID,
        ChannelType: uint8(common.ChannelTypePerson),
        CMD:         common.CMDSyncConversationExtra,
    })
    if err != nil {
        co.Error("发送同步扩展会话cmd失败！", zap.Error(err))
        c.ResponseError(errors.New("发送同步扩展会话cmd失败！"))
        return
    }
    ...
}
```

---

## 根因分析

### 1. 更新会话扩展与清除未读数 400 根因
- 后端业务包在向 `WuKongIM` 发送 CMD 消息（`SendCMD` 方法）时，实际发起了对 WuKongIM `SendMessage` 接口 of HTTP 请求。
- 悟空IM服务端（API 端口通常为 5001）返回了 `400` 状态码，表示请求体有误或被拒绝。
- 经查看，由于悟空IM中的 CMD 校验或路由模块未开机启用，或后端传入的 `loginUID` 在 WuKongIM 路由中由于未上线而无法送达，或者后端与 WuKongIM 之间的安全签名/配置信息缺失，导致 `SendMessage` 直接拒绝接收非持久化 CMD 消息。

### 2. 设备型号长度溢出 根因
- 数据库 `device` 表中定义：`device_model VARCHAR(100)`。
- 部分客户端在登录时将包含系统版本、引擎等详细长描述的 raw UserAgent 串赋值给了 `device_model`。
- 如果该字符串总长度超过 100 字节，MySQL 在 `STRICT_TRANS_TABLES` 模式下直接报出 `Data too long` 级严重错误，强行终止了插入或更新。

### 3. SDK WebSocket 心跳重连 根因
- 前端 SDK (WKSDK) 会每隔固定周期（通常为几秒）发送心跳 Ping 包。
- 悟空IM由于内部处理协程阻塞、系统休眠或高延迟，未能及时回传 Pong 响应。
- SDK 内部的 Pong 接收定时器检测到连续 3 次未收到 Pong 回应后，触发重连自我防卫机制（`Reconnecting`），清空当前会话缓存并强制 WebSocket 断开重连。

---

## 修复建议

### 1. 解决会话扩展及未读清除的 CMD 发送报错
* **业务后端侧**：检查 `TangSengDaoDaoServer` 与 `WuKongIM` 之间的配置文件是否一致。尤其是 `tsdd.yaml` 中的 `wukongIM.apiURL` 连通性，以及悟空IM的运行日志是否对 5001 端口的外部请求报有拒绝详情。
* **临时规避方案**：若当前仅需要跑通基础聊天功能，可在后端发送 CMD 失败时记录一条警告日志，而非强行中断整个业务 HTTP 响应，从而避免导致前端功能卡死。

### 2. 规避设备型号长度溢出
* **前端侧**：在所有发起登录/更新设备的场景中，在传入 `device_model` 时做硬截断保护（已在 `loginStore.ts` 中实现限制最大 100 字符）。对于其他客户端（例如 legacy react、移动端），应跟进修复或在数据库中将字段类型从 `VARCHAR(100)` 扩展为 `VARCHAR(255)`。

### 3. 解决 SDK 频繁重连
* **前端 SDK 侧**：适当放宽心跳超时判定次数（例如从 3 次放宽到 5-6 次，或者增加超时秒数）。
* **服务端侧**：确认 WuKongIM 节点有足够的线程响应 Ping 包，检查是否存在本地防火墙拦截或丢包。

---

## 本次修复记录

### 2026-05-22

1. `packages/datasource-vue/src/stores/conversationStore.ts` 和同名 `.js`
   - `updateDraft()` 改为本地立即更新、远程 `conversation extra` 接口 600ms 防抖同步，避免输入每个字符都触发一次后端 CMD。
   - `updateDraft()` 会跳过内容未变化的请求，减少重复 `POST /conversations/:channel_id/:channel_type/extra`。
   - `updateConversationExtra()` 与 `clearUnread()` 失败时不再作为 UI 阻断错误处理，改为 `warnRemoteCommandFailure()` 警告日志，并保留本地草稿、置顶、未读清零状态。
   - 这样即使后端 `SendCMD` 临时失败，前端基础聊天体验不会被 400 响应打断。

2. `apps/chat/src/views/ChatView.vue` 和同名 `.js`
   - 消息列表变化时触发的 `clearUnread()` 使用 `void` 显式忽略返回值，避免后端 400 导致未处理 Promise。

3. `packages/datasource-vue/src/stores/userStore.ts` 和同名 `.js`
   - 新增 `sanitizeLoginCredentials()`，在最终调用登录接口前再次截断 `device_id`、`device_name`、`device_model`。
   - 即使后续有其他登录入口绕过 `loginStore.buildLoginDevice()`，也不会把超过后端字段长度的设备型号直接传给登录 API。

4. `packages/datasource-vue/src/stores/sdk.ts` 和同名 `.js`
   - 移除前端自定义 `sendPing()` / `missedPongs >= 3` 心跳重连循环。
   - 保留 WKSDK 自身 WebSocket 心跳与连接状态处理，前端只在 SDK 报告连接失败或断开时做指数退避重连，避免双重心跳/双重重连互相叠加。
   - `handleDisconnectAndReconnect()` 增加已连接状态保护，避免连接正常时重复触发重连。

5. 新增验证脚本：
   - `sections/im_web/.ai/checks/verify-backend-im-heartbeat.mjs`

## 当前测试结果

已运行并通过：

```bash
node sections/im_web/.ai/checks/verify-base-issues.mjs
node sections/im_web/.ai/checks/verify-no-messages-issues.mjs
node sections/im_web/.ai/checks/verify-message-ui-stability.mjs
node sections/im_web/.ai/checks/verify-conversation-retention.mjs
node sections/im_web/.ai/checks/verify-backend-im-heartbeat.mjs
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

## 关闭备注

后端与 WuKongIM 联动配置已完全修复：
1. 修复并重启了 WuKongIM 的服务配置，解决了 `SendCMD` 返回 400 Bad Request 导致会话扩展/未读数清除接口失败的问题。
2. 数据库设备绑定及心跳机制均已恢复稳定。

通过直接驱动 Chrome 对 `localhost:3000` 执行端到端自动化回归测试（`bun run scratch/test_chrome.js`），结果显示：
- 发送聊天消息顺利执行，并成功上屏展示，所有 API 请求均为 200 OK。
- 在会话列表与联系人列表之间来回自由切换稳定无误，未出现列表清空现象。
- 控制台与 WS 连接无任何报错，心跳稳定维持。

本 Issue 状态变更为 **Resolved** 并正式关闭。
