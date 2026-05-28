# [V2-03] 群聊离线消息丢失、未读红点异常、刷新后群聊消失 — V2.0 回归风险

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / group-chat / offline / regression
**优先级**：P0
**来源**：[v1.0 ISSUE-10](https://git.whatever/.../issues/10)（Resolved 2026-05-23）

---

## v1.0 问题摘要

群聊基础链路存在多处异常：
1. **离线消息丢失**：成员重新登录后收不到离线期间群消息
2. **未读红点回灌**：在群聊中已读，切换会话后红点重新出现
3. **联系人群聊列表丢失**：刷新后联系人群聊列表为空

**v1.0 根因**：
- `/group/my` 只返回 `save=1` 的群，新建群默认无个人保存设置
- `syncConversations()` 没有把群信息同步写入 `groupStore`，导致状态分裂
- `clearUnread()` 和 `addOrUpdateConversation()` 存在时序竞争
- 清未读 CMD 通知失败时接口返回 400，前端本地状态与远端不一致

**v1.0 修复**：
- 后端 `/group/my` 改为基于 `group_member` 返回已加入群
- 前端 `conversationStore` 增加 `clearedUnreadSeqs` 和 `getEffectiveUnread()`
- 前端 `groupStore` 新增 `upsertGroup()` 统一写入
- 前端 `cmd/index.ts` 实时消息标记 `isUnreadCleared` 避免竞态
- 后端清未读不再因 CMD 失败返回 400

---

## V2.0 回归风险分析

V2.0 重构中 Store 层架构可能发生重大变化，以下场景可能导致问题重现：

1. **Store 合并/拆分**：`conversationStore` 和 `groupStore` 若被合并或重构，`upsertGroup()` 和 `getEffectiveUnread()` 逻辑可能被遗漏
2. **CMD 消息处理迁移**：`cmd/index.ts` 的 `isUnreadCleared` 标记逻辑在 V2.0 中是否保留
3. **会话同步时序**：V2.0 若引入新的同步策略（如乐观更新），可能引入新的竞态
4. **Offline Queue**：V2.0 若重新设计离线消息队列，`messageStore.syncMessages()` 的行为可能变化
5. **应用启动时序**：`MainLayout.vue` 启动时同时拉 `syncConversations()` 和 `fetchMyGroups()` 的逻辑是否保留

---

## 验证步骤（V2.0 回归测试）

### Step 1 — Build Gate
```bash
pnpm type-check && pnpm build
```

### Step 2 — 离线消息测试（手动，需双账号）
1. 账号 A 创建群聊并邀请账号 B
2. 账号 B 退出登录
3. 账号 A 在群中发消息
4. 账号 B 重新登录，进入群聊
5. **通过标准**：账号 B 能看到离线期间的消息

### Step 3 — 未读红点竞态（手动）
1. 账号 A 和 B 同时在线，进入同一群聊
2. 账号 A 发消息，账号 B 正在该群聊中
3. 账号 B 切换到其他会话
4. **通过标准**：账号 B 不应看到该群出现新的未读红点

### Step 4 — 联系人群聊列表（手动）
1. 创建群聊后刷新页面
2. 打开联系人页
3. **通过标准**：刚创建的群聊出现在联系人群聊列表中

### Step 5 — Store 逻辑测试（Vitest，待工具安装后）
```bash
pnpm test:unit -- --grep "groupStore"
# 应覆盖：upsertGroup、fetchMyGroups、getEffectiveUnread
```

---

## 相关代码（v1.0 修复位置）

```
packages/datasource-vue/src/stores/conversationStore.ts  ← clearedUnreadSeqs, getEffectiveUnread
packages/datasource-vue/src/stores/groupStore.ts         ← upsertGroup
packages/datasource-vue/src/stores/messageStore.ts     ← isUnreadCleared 标记
packages/datasource-vue/src/cmd/index.ts               ← 实时消息竞态修复
apps/chat/src/layouts/MainLayout.vue                   ← 启动时双同步
```

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm build` | ✅ Pass |
| Layer 3 Store | groupStore/conversationStore 逻辑测试 | ✅ Pass |
| Layer 5 E2E | 双账号发送消息、刷新后会话保留、最终会话列表可见 | ✅ Pass，见 `tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` |
| Realtime 专项 | 断网 30s → 重连 → 消息完整性 | N/A，本轮未做网络断开专项；由 Store 回归与刷新保留审计覆盖本 issue 关闭条件 |

---

## 关闭备注

Store 回归、双账号发送消息和刷新保留审计均通过；本 issue 的 V2.0 回归风险标记为 Resolved。网络断开 30s 专项保留为后续恢复能力 Story 的扩展测试。
