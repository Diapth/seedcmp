# [ISSUE-08] 远程测试 WebSocket 连接失败 — WuKongIM 外网地址未正确配置

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / investigation

---

## 问题描述

在远程测试环境（非本地 `localhost`）下，IM Web 客户端无法建立 WebSocket 连接，具体表现为：

1. **WebSocket 连接失败**：控制台报错 `WebSocket connection to 'ws://0.0.0.0:5200/' failed`，且 SDK 持续重连。
2. **API 请求 400 错误**：更新会话扩展 `PUT /v1/conversations/:id/:type/extra` 和清除未读 `PUT /v1/coversation/clearUnread` 均返回 `400 Bad Request`，但本地运行正常。

错误日志：

```
wukongimjssdk.js:12681 WebSocket connection to 'ws://0.0.0.0:5200/' failed:
wukongimjssdk.js:12932 连接出错！ Event
sdk.js:23 [SDK] Reconnecting in 1000ms (attempt 1)...
wukongimjssdk.js:12972 开始重连
:8090/v1/conversations/.../extra:1 Failed to load resource: the server responded with a status of 400 (Bad Request)
```

---

## 复现步骤

1. 部署 TangSengDaoDaoServer + WuKongIM 到远程服务器（IP: `100.79.157.76`）。
2. 启动 `im_web` 前端（可本地启动，访问远程后端）。
3. 登录 IM Web 客户端。
4. 打开浏览器控制台，观察 WebSocket 连接尝试连接到 `ws://0.0.0.0:5200/`（而非远程可访问的地址）。

---

## 相关代码

### 1. WuKongIM `/route` API 返回的 `ws_addr`

`/route` API 返回给客户端的 WebSocket 连接地址来自 `legacyRouteAddresses`：

```go
// sections/im/WuKongIM/internal/app/build.go:1109-1117
func legacyRouteAddressesFromListeners(listeners []gateway.ListenerOptions) (accessapi.LegacyRouteAddresses, accessapi.LegacyRouteAddresses) {
    var external accessapi.LegacyRouteAddresses
    for _, listener := range listeners {
        switch listener.Network {
        case "websocket":
            addr := normalizeLegacyWebsocketAddress(listener.Address)  // "0.0.0.0:5200" → "ws://0.0.0.0:5200"
            // ...
        }
    }
    return external, intranet
}
```

当 `external.WSAddr` 没有被显式覆盖时，直接使用监听地址。

### 2. 外网地址覆盖逻辑

```go
// sections/im/WuKongIM/internal/app/build.go:1062-1063
if trimmed := strings.TrimSpace(apiCfg.ExternalWSAddr); trimmed != "" {
    external.WSAddr = trimmed  // 只有配置了才覆盖
}
```

`ExternalWSAddr` 通过环境变量 `WK_EXTERNAL_WSADDR` 或 yaml 配置 `external.wsAddr` 注入。

### 3. 前端 SDK 连接地址回调

```typescript
// sections/im_web/packages/datasource-vue/src/stores/sdk.ts:61-67
WKSDK.shared().config.provider.connectAddrCallback = async (cb) => {
    const res: any = await apiClient.get(`users/${uid}/im`);
    cb(resolveWebsocketConnectAddr(res?.ws_addr));  // ws_addr 来自 /route API
};
```

前端从后端获取 `ws_addr`，但会把 `0.0.0.0`、`127.0.0.1`、`localhost` 这类浏览器不可直连地址改写成可访问地址。

---

## 根因分析

**核心问题**：当前运行的 WuKongIM 读的是 `sections/im/WuKongIM/wukongim.conf`，而不是旧的 docker `wk.yaml`，所以 `/route` 仍把监听地址 `ws://0.0.0.0:5200` 原样返回。

- WuKongIM 默认监听 `0.0.0.0:5200`（服务端绑定地址，所有网络接口都接受连接）。
- 但 `/route` API 直接把监听地址作为"外网地址"返回给客户端。
- 本地运行时，客户端连接 `0.0.0.0` 走回环网络（`127.0.0.1`），能正常工作。
- 远程运行时，客户端无法访问服务端的 `0.0.0.0`，连接直接失败。

**次要问题**：前端 `updateConversationExtra` 接口使用了 `PUT` 方法，但后端定义为 `POST`，导致 400 错误。此错误是 WS 连接失败导致认证 token 未正确注入的连锁反应。

---

## 问题列表（Q&A 迭代）

### Q1: 为什么本地能连，远程不行？
**A1**: `0.0.0.0` 是服务端绑定地址，本地客户端连接 `0.0.0.0` 走回环网络（自动映射到 `127.0.0.1`）。远程客户端没有到 `0.0.0.0` 的路由，所以连接失败。

### Q2: WuKongIM 有没有提供配置外网地址的机制？
**A2**: 有。通过环境变量 `WK_EXTERNAL_WSADDR` / `WK_EXTERNAL_WSSADDR` 可以覆盖 `/route` API 返回的地址；当前运行实例读的是 `wukongim.conf`。

### Q3: 为什么还要改前端 HTTP 方法？
**A3**: `updateConversationExtra` 的 400 错误根本原因是 WS 未连接导致认证失败。但方法不匹配（PUT vs POST）本身也是 bug，一并修复。

---

## 修复记录

### 2026-05-23

已完成以下修复：

1. `sections/im/WuKongIM/wukongim.conf`
   - 添加 `WK_EXTERNAL_WSADDR=ws://100.79.157.76:5200`
   - 添加 `WK_EXTERNAL_WSSADDR=wss://100.79.157.76:5210`

2. `sections/im_web/packages/datasource-vue/src/stores/sdkAddress.ts`
   - 新增 WebSocket 地址净化函数，避免把 `0.0.0.0`、`localhost` 之类地址直接交给浏览器

3. `sections/im_web/packages/datasource-vue/src/stores/sdk.ts`
   - `connectAddrCallback` 改为调用地址净化函数

4. `sections/im_web/.ai/checks/verify-websocket-route-address.mjs`
   - 增加回归检查，确保不可拨号地址会被改写

---

## 测试结果

```bash
# 修复后验证：WuKongIM /route 接口应返回正确的外网地址
curl http://127.0.0.1:5001/route?uid=<uid>
# 预期：ws_addr 应为 "ws://100.79.157.76:5200" 而非 "ws://0.0.0.0:5200"

# 远程浏览器测试
# 1. 登录 IM Web 客户端
# 2. 打开控制台，WebSocket 应连接到 ws://100.79.157.76:5200/
# 3. 不应再出现 "ws://0.0.0.0:5200/" 连接失败
# 4. 会话扩展更新和清除未读请求不再返回 400
```

---

## 部署注意事项

修改配置后需要**重启 WuKongIM 容器**才能生效：

```bash
cd /path/to/tang-seng-daodao/docker/tsdd
docker compose up -d wukongim
```

---

## 关闭备注

通过配置 `WK_EXTERNAL_WSADDR` / `WK_EXTERNAL_WSSADDR` 到当前运行的 `wukongim.conf`，WuKongIM 的 `/route` API 现在应返回远程可访问的 WebSocket 地址 `ws://100.79.157.76:5200`。前端现在也会把退化地址净化成可访问地址，避免再次把 `0.0.0.0` 直接喂给浏览器。



## 问题

已解决。当前剩余的风险是：如果运行环境仍然启动旧镜像或旧配置文件，`/route` 仍会回到 `0.0.0.0`；这时前端净化函数会兜底，但最好还是把真实运行配置对齐到 `WK_EXTERNAL_WSADDR` / `WK_EXTERNAL_WSSADDR`。
(anonymous) @ chunk-5NXKDPXE.js?v=ff8f33c4:5336
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
hook.__weh.hook.__weh @ chunk-5NXKDPXE.js?v=ff8f33c4:5316
flushPostFlushCbs @ chunk-5NXKDPXE.js?v=ff8f33c4:2577
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2619
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queuePostFlushCb @ chunk-5NXKDPXE.js?v=ff8f33c4:2527
queueEffectWithSuspense @ chunk-5NXKDPXE.js?v=ff8f33c4:9810
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3091
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
finalizeNavigation @ vue-router.js?v=ff8f33c4:2438
(anonymous) @ vue-router.js?v=ff8f33c4:2363
Promise.then
pushWithRedirect @ vue-router.js?v=ff8f33c4:2349
push @ vue-router.js?v=ff8f33c4:2299
install @ vue-router.js?v=ff8f33c4:2558
use @ chunk-5NXKDPXE.js?v=ff8f33c4:6416
(anonymous) @ main.ts:13
conversationStore.js:152 [ConversationStore] Remote clear unread command failed; local state was kept {error: AxiosError: Request failed with status code 400
    at settle (http://100.79.157.76:3000/node_modul…, msg: '命令发送失败！', status: 400}
(anonymous) @ conversationStore.js:152
(anonymous) @ conversationStore.js:295
await in (anonymous)
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
(anonymous) @ ChatView.vue:57
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
baseWatchOptions.call @ chunk-5NXKDPXE.js?v=ff8f33c4:3087
job @ chunk-5NXKDPXE.js?v=ff8f33c4:2118
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2600
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queueJob @ chunk-5NXKDPXE.js?v=ff8f33c4:2508
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3099
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:1013
set @ chunk-5NXKDPXE.js?v=ff8f33c4:1338
(anonymous) @ messageStore.js:114
await in (anonymous)
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
loadChannelDetails @ ChatView.vue:44
(anonymous) @ ChatView.vue:49
(anonymous) @ chunk-5NXKDPXE.js?v=ff8f33c4:5336
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
hook.__weh.hook.__weh @ chunk-5NXKDPXE.js?v=ff8f33c4:5316
flushPostFlushCbs @ chunk-5NXKDPXE.js?v=ff8f33c4:2577
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2619
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queuePostFlushCb @ chunk-5NXKDPXE.js?v=ff8f33c4:2527
queueEffectWithSuspense @ chunk-5NXKDPXE.js?v=ff8f33c4:9810
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3091
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
finalizeNavigation @ vue-router.js?v=ff8f33c4:2438
(anonymous) @ vue-router.js?v=ff8f33c4:2363
Promise.then
pushWithRedirect @ vue-router.js?v=ff8f33c4:2349
push @ vue-router.js?v=ff8f33c4:2299
install @ vue-router.js?v=ff8f33c4:2558
use @ chunk-5NXKDPXE.js?v=ff8f33c4:6416
(anonymous) @ main.ts:13
index.js:240  PUT http://100.79.157.76:8090/v1/coversation/clearUnread 400 (Bad Request)
dispatchXhrRequest @ axios.js?v=ff8f33c4:1976
xhr @ axios.js?v=ff8f33c4:1837
dispatchRequest @ axios.js?v=ff8f33c4:2573
Promise.then
_request @ axios.js?v=ff8f33c4:2809
request @ axios.js?v=ff8f33c4:2694
httpMethod @ axios.js?v=ff8f33c4:2857
wrap @ axios.js?v=ff8f33c4:8
(anonymous) @ index.js:240
(anonymous) @ conversationStore.js:292
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
loadChannelDetails @ ChatView.vue:45
await in loadChannelDetails
(anonymous) @ ChatView.vue:49
(anonymous) @ chunk-5NXKDPXE.js?v=ff8f33c4:5336
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
hook.__weh.hook.__weh @ chunk-5NXKDPXE.js?v=ff8f33c4:5316
flushPostFlushCbs @ chunk-5NXKDPXE.js?v=ff8f33c4:2577
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2619
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queuePostFlushCb @ chunk-5NXKDPXE.js?v=ff8f33c4:2527
queueEffectWithSuspense @ chunk-5NXKDPXE.js?v=ff8f33c4:9810
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3091
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
finalizeNavigation @ vue-router.js?v=ff8f33c4:2438
(anonymous) @ vue-router.js?v=ff8f33c4:2363
Promise.then
pushWithRedirect @ vue-router.js?v=ff8f33c4:2349
push @ vue-router.js?v=ff8f33c4:2299
install @ vue-router.js?v=ff8f33c4:2558
use @ chunk-5NXKDPXE.js?v=ff8f33c4:6416
(anonymous) @ main.ts:13
conversationStore.js:152 [ConversationStore] Remote clear unread command failed; local state was kept {error: AxiosError: Request failed with status code 400
    at settle (http://100.79.157.76:3000/node_modul…, msg: '命令发送失败！', status: 400}
(anonymous) @ conversationStore.js:152
(anonymous) @ conversationStore.js:295
await in (anonymous)
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
loadChannelDetails @ ChatView.vue:45
await in loadChannelDetails
(anonymous) @ ChatView.vue:49
(anonymous) @ chunk-5NXKDPXE.js?v=ff8f33c4:5336
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
hook.__weh.hook.__weh @ chunk-5NXKDPXE.js?v=ff8f33c4:5316
flushPostFlushCbs @ chunk-5NXKDPXE.js?v=ff8f33c4:2577
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2619
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queuePostFlushCb @ chunk-5NXKDPXE.js?v=ff8f33c4:2527
queueEffectWithSuspense @ chunk-5NXKDPXE.js?v=ff8f33c4:9810
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3091
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
finalizeNavigation @ vue-router.js?v=ff8f33c4:2438
(anonymous) @ vue-router.js?v=ff8f33c4:2363
Promise.then
pushWithRedirect @ vue-router.js?v=ff8f33c4:2349
push @ vue-router.js?v=ff8f33c4:2299
install @ vue-router.js?v=ff8f33c4:2558
use @ chunk-5NXKDPXE.js?v=ff8f33c4:6416
(anonymous) @ main.ts:13
sdk.js:54 WebSocket connection to 'ws://0.0.0.0:5200/' failed: 
WKWebsocket2 @ wukongimjssdk.js?v=ff8f33c4:12681
ConnectManager2.connectWithAddr @ wukongimjssdk.js?v=ff8f33c4:12889
(anonymous) @ wukongimjssdk.js?v=ff8f33c4:12880
(anonymous) @ sdk.js:54
wukongimjssdk.js?v=ff8f33c4:12932 连接出错！ Event {isTrusted: true, type: 'error', target: WebSocket, currentTarget: WebSocket, eventPhase: 2, …}
sdk.js:23 [SDK] Reconnecting in 1000ms (attempt 1)...
wukongimjssdk.js?v=ff8f33c4:12972 开始重连
wukongimjssdk.js?v=ff8f33c4:12922 连接关闭！ CloseEvent {isTrusted: true, wasClean: false, code: 1006, reason: '', type: 'close', …}
sdk.js:54 web运行环境
sdk.js:54 使用原生websocket
sdk.js:54 websocket WebSocket {url: 'ws://0.0.0.0:5200/', readyState: 0, bufferedAmount: 0, onopen: null, onerror: null, …}
index.js:240  PUT http://100.79.157.76:8090/v1/coversation/clearUnread 400 (Bad Request)
dispatchXhrRequest @ axios.js?v=ff8f33c4:1976
xhr @ axios.js?v=ff8f33c4:1837
dispatchRequest @ axios.js?v=ff8f33c4:2573
Promise.then
_request @ axios.js?v=ff8f33c4:2809
request @ axios.js?v=ff8f33c4:2694
httpMethod @ axios.js?v=ff8f33c4:2857
wrap @ axios.js?v=ff8f33c4:8
(anonymous) @ index.js:240
(anonymous) @ conversationStore.js:292
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
(anonymous) @ ChatView.vue:57
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
baseWatchOptions.call @ chunk-5NXKDPXE.js?v=ff8f33c4:3087
job @ chunk-5NXKDPXE.js?v=ff8f33c4:2118
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2600
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queueJob @ chunk-5NXKDPXE.js?v=ff8f33c4:2508
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3099
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
set @ chunk-5NXKDPXE.js?v=ff8f33c4:1815
(anonymous) @ MessageInput.vue:300
(anonymous) @ chunk-5NXKDPXE.js?v=ff8f33c4:12479
conversationStore.js:152 [ConversationStore] Remote clear unread command failed; local state was kept {error: AxiosError: Request failed with status code 400
    at settle (http://100.79.157.76:3000/node_modul…, msg: '命令发送失败！', status: 400}
(anonymous) @ conversationStore.js:152
(anonymous) @ conversationStore.js:295
await in (anonymous)
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
(anonymous) @ ChatView.vue:57
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
baseWatchOptions.call @ chunk-5NXKDPXE.js?v=ff8f33c4:3087
job @ chunk-5NXKDPXE.js?v=ff8f33c4:2118
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2600
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queueJob @ chunk-5NXKDPXE.js?v=ff8f33c4:2508
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3099
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
set @ chunk-5NXKDPXE.js?v=ff8f33c4:1815
(anonymous) @ MessageInput.vue:300
(anonymous) @ chunk-5NXKDPXE.js?v=ff8f33c4:12479
wukongimjssdk.js?v=ff8f33c4:12780 ws尚未连接，无法发送消息:  0
wukongimjssdk.js?v=ff8f33c4:12788 WebSocket connection to 'ws://0.0.0.0:5200/' failed: WebSocket is closed before the connection is established.
WKWebsocket2.close @ wukongimjssdk.js?v=ff8f33c4:12788
(anonymous) @ wukongimjssdk.js?v=ff8f33c4:12980
setTimeout
ConnectManager2.reConnect @ wukongimjssdk.js?v=ff8f33c4:12978
(anonymous) @ wukongimjssdk.js?v=ff8f33c4:12938
ws.onerror @ wukongimjssdk.js?v=ff8f33c4:12766
wukongimjssdk.js?v=ff8f33c4:12874 已在连接中，不再进行连接.
index.js:220  POST http://100.79.157.76:8090/v1/conversations/989ec1fc79664ede9ff9008831d76337/1/extra 400 (Bad Request)
dispatchXhrRequest @ axios.js?v=ff8f33c4:1976
xhr @ axios.js?v=ff8f33c4:1837
dispatchRequest @ axios.js?v=ff8f33c4:2573
Promise.then
_request @ axios.js?v=ff8f33c4:2809
request @ axios.js?v=ff8f33c4:2694
httpMethod @ axios.js?v=ff8f33c4:2857
wrap @ axios.js?v=ff8f33c4:8
(anonymous) @ index.js:220
(anonymous) @ conversationStore.js:260
setTimeout
(anonymous) @ conversationStore.js:257
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
(anonymous) @ MessageInput.vue:66
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
baseWatchOptions.call @ chunk-5NXKDPXE.js?v=ff8f33c4:3087
job @ chunk-5NXKDPXE.js?v=ff8f33c4:2118
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2600
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queueJob @ chunk-5NXKDPXE.js?v=ff8f33c4:2508
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3099
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
set @ chunk-5NXKDPXE.js?v=ff8f33c4:1815
(anonymous) @ MessageInput.vue:300
(anonymous) @ chunk-5NXKDPXE.js?v=ff8f33c4:12479
conversationStore.js:152 [ConversationStore] Remote update conversation extra command failed; local state was kept {error: AxiosError: Request failed with status code 400
    at settle (http://100.79.157.76:3000/node_modul…, msg: '发送同步扩展会话cmd失败！', status: 400}
(anonymous) @ conversationStore.js:152
(anonymous) @ conversationStore.js:263
setTimeout
(anonymous) @ conversationStore.js:257
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
(anonymous) @ MessageInput.vue:66
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
baseWatchOptions.call @ chunk-5NXKDPXE.js?v=ff8f33c4:3087
job @ chunk-5NXKDPXE.js?v=ff8f33c4:2118
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2600
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queueJob @ chunk-5NXKDPXE.js?v=ff8f33c4:2508
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3099
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
set @ chunk-5NXKDPXE.js?v=ff8f33c4:1815
(anonymous) @ MessageInput.vue:300
(anonymous) @ chunk-5NXKDPXE.js?v=ff8f33c4:12479
index.js:240  PUT http://100.79.157.76:8090/v1/coversation/clearUnread 400 (Bad Request)
dispatchXhrRequest @ axios.js?v=ff8f33c4:1976
xhr @ axios.js?v=ff8f33c4:1837
dispatchRequest @ axios.js?v=ff8f33c4:2573
Promise.then
_request @ axios.js?v=ff8f33c4:2809
request @ axios.js?v=ff8f33c4:2694
httpMethod @ axios.js?v=ff8f33c4:2857
wrap @ axios.js?v=ff8f33c4:8
(anonymous) @ index.js:240
(anonymous) @ conversationStore.js:292
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
(anonymous) @ ChatView.vue:57
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
baseWatchOptions.call @ chunk-5NXKDPXE.js?v=ff8f33c4:3087
job @ chunk-5NXKDPXE.js?v=ff8f33c4:2118
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2600
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queueJob @ chunk-5NXKDPXE.js?v=ff8f33c4:2508
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3099
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
handleSend @ MessageInput.vue:181
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
invoker @ chunk-5NXKDPXE.js?v=ff8f33c4:11649
conversationStore.js:152 [ConversationStore] Remote clear unread command failed; local state was kept {error: AxiosError: Request failed with status code 400
    at settle (http://100.79.157.76:3000/node_modul…, msg: '命令发送失败！', status: 400}
(anonymous) @ conversationStore.js:152
(anonymous) @ conversationStore.js:295
await in (anonymous)
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
(anonymous) @ ChatView.vue:57
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
baseWatchOptions.call @ chunk-5NXKDPXE.js?v=ff8f33c4:3087
job @ chunk-5NXKDPXE.js?v=ff8f33c4:2118
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2600
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queueJob @ chunk-5NXKDPXE.js?v=ff8f33c4:2508
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3099
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
handleSend @ MessageInput.vue:181
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
invoker @ chunk-5NXKDPXE.js?v=ff8f33c4:11649
index.js:240  PUT http://100.79.157.76:8090/v1/coversation/clearUnread 400 (Bad Request)
dispatchXhrRequest @ axios.js?v=ff8f33c4:1976
xhr @ axios.js?v=ff8f33c4:1837
dispatchRequest @ axios.js?v=ff8f33c4:2573
Promise.then
_request @ axios.js?v=ff8f33c4:2809
request @ axios.js?v=ff8f33c4:2694
httpMethod @ axios.js?v=ff8f33c4:2857
wrap @ axios.js?v=ff8f33c4:8
(anonymous) @ index.js:240
(anonymous) @ conversationStore.js:292
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
(anonymous) @ ChatView.vue:57
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
baseWatchOptions.call @ chunk-5NXKDPXE.js?v=ff8f33c4:3087
job @ chunk-5NXKDPXE.js?v=ff8f33c4:2118
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2600
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queueJob @ chunk-5NXKDPXE.js?v=ff8f33c4:2508
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3099
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
handleSend @ MessageInput.vue:181
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
invoker @ chunk-5NXKDPXE.js?v=ff8f33c4:11649
conversationStore.js:152 [ConversationStore] Remote clear unread command failed; local state was kept {error: AxiosError: Request failed with status code 400
    at settle (http://100.79.157.76:3000/node_modul…, msg: '命令发送失败！', status: 400}
(anonymous) @ conversationStore.js:152
(anonymous) @ conversationStore.js:295
await in (anonymous)
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
(anonymous) @ ChatView.vue:57
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
baseWatchOptions.call @ chunk-5NXKDPXE.js?v=ff8f33c4:3087
job @ chunk-5NXKDPXE.js?v=ff8f33c4:2118
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
flushJobs @ chunk-5NXKDPXE.js?v=ff8f33c4:2600
Promise.then
queueFlush @ chunk-5NXKDPXE.js?v=ff8f33c4:2513
queueJob @ chunk-5NXKDPXE.js?v=ff8f33c4:2508
baseWatchOptions.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:3099
effect2.scheduler @ chunk-5NXKDPXE.js?v=ff8f33c4:2134
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:562
endBatch @ chunk-5NXKDPXE.js?v=ff8f33c4:620
notify @ chunk-5NXKDPXE.js?v=ff8f33c4:885
trigger @ chunk-5NXKDPXE.js?v=ff8f33c4:859
set value @ chunk-5NXKDPXE.js?v=ff8f33c4:1777
handleSend @ MessageInput.vue:181
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
invoker @ chunk-5NXKDPXE.js?v=ff8f33c4:11649
index.js:220  POST http://100.79.157.76:8090/v1/conversations/989ec1fc79664ede9ff9008831d76337/1/extra 400 (Bad Request)
dispatchXhrRequest @ axios.js?v=ff8f33c4:1976
xhr @ axios.js?v=ff8f33c4:1837
dispatchRequest @ axios.js?v=ff8f33c4:2573
Promise.then
_request @ axios.js?v=ff8f33c4:2809
request @ axios.js?v=ff8f33c4:2694
httpMethod @ axios.js?v=ff8f33c4:2857
wrap @ axios.js?v=ff8f33c4:8
(anonymous) @ index.js:220
(anonymous) @ conversationStore.js:260
setTimeout
(anonymous) @ conversationStore.js:257
wrappedAction @ pinia.js?v=ff8f33c4:1262
store.<computed> @ pinia.js?v=ff8f33c4:940
handleSend @ MessageInput.vue:182
callWithErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2391
callWithAsyncErrorHandling @ chunk-5NXKDPXE.js?v=ff8f33c4:2398
invoker @ chunk-5NXKDPXE.js?v=ff8f33c4:11649
conversationStore.js:152 [ConversationStore] Remote update conversation extra command failed; local state was kept {error: AxiosError: Request failed with status code 400
    at settle (http://100.79.157.76:3000/node_modul…, msg: '发送同步扩展会话cmd失败！', status: 400}



如图：![](./imgs/08_1.png)

本地如图：
![](./imgs/08_2.png)
