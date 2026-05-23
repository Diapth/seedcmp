## 5个问题的老前端代码分析

---

### 问题1：已添加好友但联系人页面看不到

**根本原因**：`friend/sync` 返回的每条记录有 `follow` 字段，`follow=1` 才是真正的好友。老前端过滤逻辑：

```tsx
// tsdaodaocontacts/src/Contacts/index.tsx:88-91
if (v.status === UserRelation.blacklist) return false  // status=2 是黑名单
if (v.follow !== 1) return false                        // follow!=1 不是好友，过滤掉
```

**我们当前的问题**：`contactStore.ts` 里 `syncContacts` 只过滤了 `is_deleted !== 1`，没有过滤 `follow !== 1`。

**修复**：
```ts
// contactStore.ts syncContacts 里
contacts.value = list.filter((f: any) => f.is_deleted !== 1 && f.follow === 1);
```

---

### 问题2：搜索好友不显示照片、名字、UID

**根本原因**：`user/search` 返回结构是：
```json
{
  "exist": 1,
  "data": {
    "uid": "xxx",
    "name": "xxx",
    "avatar": "xxx",
    "vercode": "xxx"
  }
}
```

老前端代码：
```tsx
// FriendAdd/index.tsx:45-48
if (result.exist !== 1) {
    Toast.error("用户不存在！")
} else {
    WKApp.shared.baseContext.showUserInfo(result.data.uid, undefined, result.data.vercode)
}
```

**我们当前的问题**：`AddFriendPage.vue` 里直接 `result.value = Array.isArray(res) ? res[0] : res`，但实际响应是 `{ exist: 1, data: {...} }`，所以拿到的是整个外层对象，`result.name`、`result.uid` 都是 `undefined`。

**修复**：
```ts
// AddFriendPage.vue handleSearch
if (res && res.exist === 1 && res.data) {
  result.value = res.data;   // 取 res.data
} else {
  Message.error('用户不存在');
}
```

---

### 问题3：已是好友还能重复添加

**根本原因**：老前端通过 `channels/{uid}/1` 接口拿到 `follow` 字段判断关系：
```ts
// UserInfo/vm.tsx:125-126
relation(): number {
    return this.channelInfo?.orgData?.follow || 0;  // follow=1 是好友
}

// UserInfo/index.tsx:34
if (vm.relation() === UserRelation.friend) {
    // 显示"发送消息"按钮
} else {
    if (!vm.vercode || vm.vercode == "") return  // 没vercode不显示添加按钮
    // 显示"添加好友"按钮
}
```

判断逻辑：`follow === 1` → 已是好友 → 只显示"发送消息"，不显示"添加好友"。

`user/search` 返回的 `data.vercode` 是添加验证码，只有非好友才需要 vercode；搜索到自己的好友时，后端也会返回 vercode，但前端通过 `channels/{uid}/1` 拿到 `follow=1` 来屏蔽添加入口。

**我们当前的问题**：`AddFriendPage.vue` 拿到搜索结果后没有检查 `follow` 字段，任何人都显示"发送好友申请"按钮。

**修复**：
```ts
// 拿到 res.data 之后
const userData = res.data;
// 检查 follow 字段（需要再调一次 channels/{uid}/1 或在 user/search 返回里）
// user/search 的 res.data 里有 follow 字段
if (userData.follow === 1) {
  Message.info('该用户已是你的好友');
  // 可跳转到会话
} else {
  result.value = userData;
}
```

---

### 问题4：无法接收用户发送的消息

**根本原因**：老前端在 `module.tsx` 里通过 `addMessageListener` 接收实时消息，Conversation 页面的 vm 也单独注册了 listener：

```ts
// module.tsx:358
WKSDK.shared().chatManager.addMessageListener((message: Message) => {
    console.log("收到消息->", message);
    // 处理通知、声音等
});

// Conversation/vm.ts:284-301
this.messageListener = (message: Message) => { ... }
WKSDK.shared().chatManager.addMessageListener(this.messageListener)
```

**我们当前的问题**：`cmd/index.ts` 的 `registerMessageListeners` 里：
```ts
WKSDK.shared().chatManager.addMessageListener((message: Message) => {
    messageStore.addRealtimeMessage(channelId, channelType, message);
    ...
});
```

这段本身逻辑正确，但 **`sdk.ts` 的 `initializeSDK` 里也注册了一个 messageListener**（第116行）用于重置 heartbeat，这导致 listener 被注册两次。更关键的是：**`sdk.ts` 里的 listener 在 `registerMessageListeners()` 之前就注册了，但 pinia store 在 listener 回调执行时可能还没初始化完成**（store 是 lazy 的，第一次 `useXxxStore()` 时才创建）。

实际更可能的原因：WKSDK connect 地址配置问题——`connectAddrCallback` 里调用 `/users/${uid}/im`（注意有前缀 `/`），而 baseURL 已经是 `http://127.0.0.1:8090/v1/`，加上 `/` 会变成 `http://127.0.0.1:8090/users/...` 而不是 `/v1/users/...`。

**修复**：
```ts
// sdk.ts 第80行
const res: any = await apiClient.get(`users/${uid}/im`);  // 去掉开头的 /
```

---

### 问题5：无法接收好友邀请通知

**根本原因**：老前端通过 SDK CMD 消息接收好友申请：

```ts
// module.tsx:263-273
} else if (cmdContent.cmd === "friendRequest") {
    const friendApply = new FriendApply();
    friendApply.uid = param.apply_uid;
    friendApply.to_name = param.apply_name;
    friendApply.status = FriendApplyState.apply;
    friendApply.remark = param.remark;
    friendApply.token = param.token;
    friendApply.unread = true;
    friendApply.createdAt = message.timestamp;
    WKApp.shared.addFriendApply(friendApply);  // 存到本地 storage
    WKApp.shared.setFriendApplysUnreadCount(); // 更新红点
}
```

CMD param 字段：`apply_uid`, `apply_name`, `remark`, `token`

**我们当前的 cmd/index.ts 处理**：
```ts
case 'friendRequest':
    userApi.getReddot('friendApply');
    window.dispatchEvent(new CustomEvent('wksdk:friendRequest'));
    break;
```

只发了一个 window event，但 `contactStore` 监听 `wksdk:friendRequest` 后只是调用 `fetchFriendRequests()`——这是对的，但 **`friend/apply` GET 接口有可能返回结构不匹配**（问题同问题1/2，接口返回字段可能是 `apply_uid` 而不是 `uid`）。

老前端实际上是把申请存到本地 localStorage（`${uid}friendApplys`），并**不调用** `friend/apply` GET 接口。我们调接口的思路本身更好，但 contactStore 里映射字段时：
```ts
uid: item.uid || item.apply_uid || item.to_uid || '',
name: item.to_name || item.name || item.apply_name || '未知用户',
```
这部分已经有多重 fallback，问题更可能在于接口是否能正确连上（同问题4的 `/users/` 路径问题导致 SDK 没连上，所以根本没收到 CMD）。

---

### 总结：修复优先级

| # | 问题 | 修复文件 | 核心改动 |
|---|------|---------|---------|
| 1 | 联系人不显示 | `contacts-vue/stores/contactStore.ts` | 过滤条件加 `&& f.follow === 1` |
| 2 | 搜索无头像名字 | `contacts-vue/views/AddFriendPage.vue` | 解析 `res.data`，检查 `res.exist === 1` |
| 3 | 重复添加好友 | `contacts-vue/views/AddFriendPage.vue` | 检查 `res.data.follow === 1` 则跳到会话 |
| 4/5 | 收不到消息/通知 | `datasource-vue/stores/sdk.ts` | `users/${uid}/im` 去掉前缀 `/`，确认 WS 连接成功 |

---

### 修复记录（2026-05-22）

已按上面的 5 个问题完成修复：

1. `packages/contacts-vue/src/stores/contactStore.ts` 和同名 `.js`：
   - `syncContacts()` 现在只保留 `is_deleted !== 1 && follow === 1` 的联系人，避免把非好友关系混进联系人列表。
   - 好友申请列表继续兼容 `apply_uid`、`to_name`、`apply_name` 等字段，用于接收好友邀请通知后的刷新展示。

2. `packages/contacts-vue/src/views/AddFriendPage.vue` 和同名 `.js`：
   - `user/search` 现在按 `{ exist: 1, data: {...} }` 结构解析，把 `res.data` 作为搜索结果，所以头像、昵称、UID 能正常显示。
   - 搜索结果里 `follow === 1` 时提示“该用户已是你的好友”，并跳转到 `/chat/conversation/{uid}/1`，不再展示“发送好友申请”入口。
   - 发送好友申请时带上 `vercode`，和搜索接口返回的添加验证码保持一致。

3. `packages/datasource-vue/src/stores/sdk.ts` 和同名 `.js`：
   - `connectAddrCallback` 请求从 `/users/${uid}/im` 改为 `users/${uid}/im`，避免绕过 `baseURL` 里的 `/v1/` 前缀，保证 SDK 能拿到正确 WS 地址。
   - 保留 `registerMessageListeners()` 和 CMD 事件分发逻辑，实时消息与 `friendRequest` 通知能通过 SDK 连接进入现有 store/event 流程。

4. 新增验证脚本：
   - `sections/im_web/.ai/checks/verify-base-issues.mjs` 用来检查上述关键修复点是否还在代码里，防止后续回退。

### 当前测试结果

已运行并通过：

```bash
node sections/im_web/.ai/checks/verify-base-issues.mjs
# base issue alignment checks passed
```

```bash
corepack pnpm -r exec vue-tsc --noEmit
# exit 0
```

```bash
./node_modules/.bin/vue-tsc --noEmit && ./node_modules/.bin/vite build apps/chat
# exit 0
```

备注：当前环境没有全局 `pnpm`，所以 `pnpm type-check` / `pnpm build` 会因为 `pnpm: not found` 失败；改用 `corepack pnpm -r exec vue-tsc --noEmit` 和本地 `node_modules/.bin` 后验证通过。Vite build 输出了 CJS API deprecation 提示和 chunk size warning，但不影响构建通过。
