# [ISSUE-13] 退出登录时全局 Pinia Store 的账户缓存残留与安全隐患

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / store / auth / security / cache-cleanup

---

## 问题描述

在单页应用 (SPA) 中，用户如果执行“退出登录”操作，并随即在同一个页面上重新登录另一个不同的账号，会因为全局 Pinia 状态管理器的生命周期与页面生存期一致，导致旧账号的缓存数据被直接遗留和残留。

具体表现为：
1. `groupStore` 里的群聊详情和群成员缓存仍存留。
2. `channelStore` 里的频道（包含陌生人、外部群聊基本信息）存留。
3. `conversationStore` 里的最近会话、草稿、未读数映射依然存在。
4. `messageStore` 里的历史消息、输入中计时器依然运行或存在。
5. `contactStore` 里的好友列表、黑名单及好友申请缓存存留。

当新账户登入时，将会直接继承这些数据，造成严重的数据污染与严重的账户安全、隐私泄漏隐患。

---

## 复现步骤

1. 用户 A 登录 IM 系统，加入若干群聊，并与若干好友产生聊天会话。
2. 用户 A 点击“退出登录”。界面跳转到登录页。
3. 紧接着，同一浏览器页面下，输入用户 B 的凭证登录用户 B。
4. 预期：用户 B 仅能看到用户 B 自己的会话与群聊。
5. 实际：用户 B 的会话列表和群设置中残留了大量属于用户 A 的私密群聊和会话消息，直到后续远程拉取覆盖（但在覆盖前会产生明显的界面渲染错乱和数据泄露）。

---

## 相关代码

### 修复前的退出登录机制

```ts
// packages/datasource-vue/src/stores/userStore.ts
async function logout() {
  try {
    await authApi.quit();
  } catch (e) {
    console.warn('Quit api call failed or bypassed', e);
  }
  // 仅清空了本地持久化凭证与 SDK 连接，完全忽视了 Pinia 各个 Store 内在内存中的状态 Ref
  StorageService.clear();
  token.value = null;
  loginInfo.value = null;
  currentUser.value = null;

  const sdkStore = useSdkStore();
  sdkStore.disconnect();
}
```

---

## 根因分析

退出登录阶段仅关注了存储凭证的清理（`StorageService.clear()`）和网络连接的切断（`sdkStore.disconnect()`），却遗漏了对内存层全局 Pinia 缓存的置空动作。在 SPA 的无刷账户切换场景下，这种遗漏必然导致数据滞留和越权呈现。

---

## 问题列表（Q&A 迭代）

### Q1: 为什么不能直接使用简单的 `window.location.reload()` 来做全页强刷清理状态？
**A1**: 强刷页面虽然最简单省事，但会摧毁 SPA (单页应用) 极佳的用户操作连续性体验。在优秀的客户端开发规范中，利用统一的 `reset` 数据流阻断内存污染是业界标准的无缝切换高品质技术路线。

### Q2: 为什么 `contactStore` 的重置是通过事件监听来做，而不是在 `userStore` 里面直接调用？
**A2**: `contactStore` 位于 `@tsdaodao/contacts-vue` 包中，而 `userStore` 位于底层基础包 `@tsdaodao/datasource-vue` 中。为防引发 Monorepo 中的跨包循环依赖（Circular Dependency）进而危害打包构建，用全局事件（如自定义 CustomEvent `tsdaodao:logout`）解耦通信是极其科学的前端工程设计。

---

## 修复记录

### 2026-05-23

已完成以下修复：

1. 各主要 Store 接入 `reset` 函数支持：
   - **`channelStore.ts`** / **`groupStore.ts`** / **`conversationStore.ts`** / **`messageStore.ts`** / **`contactStore.ts`**：统一实现并暴露了各自的 `reset()` 重置函数，将其管辖的 ref 数据及未完成的计时器全部优雅清空。
2. **`userStore.ts`**：
   - 导入底座各 Store，在 `logout` 函数中清空 `userCache.value = {}`，顺次调用兄弟 Store 的 `.reset()` 重置方法。
   - 退出登录时派发全局事件 `tsdaodao:logout`。
3. **`contactStore.ts`**：
   - 监听该 `tsdaodao:logout` 全局事件，在触发时自动调用本地的 `reset()` 函数彻底斩断联系人缓存。
4. 补充退出登录竞态防护：
   - **`channelStore.ts`** / **`groupStore.ts`** / **`conversationStore.ts`** / **`messageStore.ts`** 增加 `resetVersion` 栅栏，异步请求开始时记录版本，返回后如果已经发生 logout/reset，则丢弃旧账号响应结果，避免 reset 后被旧请求回填。
   - **`contactStore.ts`** 对联系人同步、好友申请、红点数、黑名单请求增加 request id 栅栏，并在 `reset()` 中递增所有 request id，阻断退出登录前发起的请求在退出后写回。
   - **`verify-issue-13-logout-store-cleanup.mjs`** 增加对异步回写防护的静态回归断言。

---

## 测试结果

```bash
# 运行专为此缺陷编写的高精测试脚本
node sections/im_web/.ai/checks/verify-issue-13-logout-store-cleanup.mjs
# exit 0 (issue 13 logout store cleanup checks passed)

# 执行全局回归测试
node sections/im_web/.ai/checks/verify-all-issues.mjs
# exit 0 (All 14 automated tests passed!)

# 静态类型检查
./node_modules/.bin/vue-tsc --noEmit
# exit 0 (Passed with no errors)

# 打包构建测试
./node_modules/.bin/vite build
# exit 0 (Passed with no errors)
```

---

## 关闭备注

问题已彻底修复，SPA 架构下的无刷新多账户隔离和内存数据强清理机制逻辑完美闭环，保障了极高的账户安全防御规格。
