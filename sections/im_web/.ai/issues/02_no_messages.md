# 无法收到好友消息

已确认好友给我发送消息，但无法收到，而且无法获取到历史聊天记录

---

## 根因分析

本问题实际包含两段链路：

1. **历史聊天记录无法拉取**
   - 老前端 `Convert.toMessage()` 直接把 `message/channel/sync` 返回的 `payload` 当对象处理：
     ```ts
     const contentObj = msgMap["payload"]
     contentType = contentObj.type
     ```
   - 当前新前端 `messageStore.ts` 里把 `item.payload` 当成 base64 或 JSON 字符串解析：
     ```ts
     content = item.payload ? JSON.parse(atob(item.payload)) : {};
     ```
   - 但后端实际返回的 `payload` 是对象，`atob(object)` 会抛错，fallback 又 `JSON.parse(object)`，仍然抛错，导致整次 `syncMessages()` 中断，所以历史消息列表为空。

2. **刷新页面后无法实时收到好友消息**
   - 登录成功时会调用 `sdkStore.initializeSDK()` 建立 WebSocket。
   - 但刷新页面后，`userStore` 只从 `StorageService` 恢复 `token/currentUser`，没有重新初始化 SDK。
   - 因此用户看起来仍是登录状态，HTTP 接口可调用，但 WKSDK 没有重新连接，实时消息 listener 收不到好友发来的消息。

另补一个实时消息展示细节：老前端会忽略 `message.header.noPersist` 的消息，新前端 listener 之前没有过滤，可能把不应展示的非持久消息放进列表。

## 修复记录（2026-05-22）

已完成以下修复：

1. `packages/datasource-vue/src/stores/messageStore.ts` 和同名 `.js`
   - 新增 `normalizeSyncedPayload()`，兼容对象 payload、普通 JSON 字符串、base64 JSON 字符串。
   - 历史同步时过滤 `is_deleted === 1` 的消息，和老前端一致。
   - 兼容 `message_idstr/message_id`，并保留 `message_extra` 里的撤回、已读等扩展信息。

2. `packages/datasource-vue/src/stores/userStore.ts` 和同名 `.js`
   - 从本地 storage 恢复登录态后，立即调用 `sdkStore.initializeSDK(currentUser.value.uid, storedToken)`。
   - 这样刷新页面或重新打开应用后，SDK 会恢复 WebSocket 连接，实时消息 listener 能继续工作。

3. `packages/datasource-vue/src/stores/sdk.ts` 和同名 `.js`
   - `initializeSDK()` 增加同 uid/token 下的幂等保护，避免恢复登录态、页面挂载等路径重复初始化。
   - 保留上一轮修复的 `users/${uid}/im` 地址，确保走 `/v1/` baseURL。

4. `packages/datasource-vue/src/cmd/index.ts` 和同名 `.js`
   - 实时消息 listener 增加 `message.header?.noPersist` 过滤，避免展示非持久化消息。

5. 新增验证脚本：
   - `sections/im_web/.ai/checks/verify-no-messages-issues.mjs` 用于检查本问题相关的关键修复点。

## 当前测试结果

已运行并通过：

```bash
node sections/im_web/.ai/checks/verify-no-messages-issues.mjs
# no-messages issue checks passed
```

```bash
corepack pnpm -r exec vue-tsc --noEmit
# exit 0
```

```bash
./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# exit 0
```

备注：构建过程中仍有 Vite CJS API deprecation 提示和 chunk size warning，但不影响构建通过。

---

# 再次遇到问题

有聊天消息的气泡了，但是没有具体内容

![](imgs/02_1.png)
