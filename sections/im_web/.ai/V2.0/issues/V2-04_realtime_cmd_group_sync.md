# [V2-04] 群聊 Realtime CMD 同步 — groupStore 未刷新 — V2.0 回归风险

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / realtime / store-sync / regression
**优先级**：P0
**来源**：[v1.0 ISSUE-12](https://git.whatever/.../issues/12)（Resolved 2026-05-23）

---

## v1.0 问题摘要

群聊管理功能切换到 `groupStore` 后，CMD 实时事件（`groupAvatarUpdate`、`memberUpdate`）仍只刷新 `channelStore`，`groupStore` 未同步更新。导致实时聊天和管理界面无法响应后台变更。

**v1.0 根因**：`cmd/index.ts` 引入 `useGroupStore` 但未在 CMD 事件中调用其刷新方法。

**v1.0 修复**：
- `cmd/index.ts` 在 `groupAvatarUpdate` 事件中清理 `groupStore.groups[channelID]` 并调用 `groupStore.getGroupInfo()`
- `cmd/index.ts` 在 `memberUpdate` 事件中调用 `groupStore.fetchGroupMembers()`

---

## V2.0 回归风险分析

这是 V2.0 **最高风险**的 issue——Constitution 原则 III（SDK 和 Store 单一真相）直接针对的就是这类问题：

1. **CMD 处理模块重构**：`cmd/index.ts` 或其等价模块在 V2.0 中可能被重写或迁移，`groupStore` 同步逻辑遗漏风险极高
2. **Store 命名/结构变化**：`groupStore` 可能改名为 `useGroupChatStore` 或拆分为 `useGroupInfoStore` + `useGroupMembersStore`，CMD 处理未同步更新
3. **SDK 消息归一化**：V2.0 若在 SDK 监听层做预处理而非在 `cmd/index.ts` 处理，等价的 groupStore 同步逻辑可能根本没有实现
4. **多 Store 同时更新**：Constitution 要求 `channelStore` 和 `groupStore` 必须同步更新（v1.0 Q&A 明确不能移除 `channelStore` 更新），V2.0 若只更新一个则回归

---

## 验证步骤（V2.0 回归测试）

### Step 1 — Build Gate
```bash
pnpm type-check && pnpm build
```

### Step 2 — 成员实时刷新测试（手动，需双账号）
1. 用户 A 开启群成员列表页面
2. 用户 B 在另一客户端将用户 C 邀请入群
3. **通过标准**：用户 A 的成员列表实时刷新出用户 C，无需退出重进

### Step 3 — 群头像实时刷新测试（手动）
1. 群主更改群头像
2. **通过标准**：正在查看群资料的成员界面实时更新头像，无需刷新

### Step 4 — CMD 处理器代码审查
检查 `cmd/index.ts` 或等价模块，确认以下事件均同时更新 `channelStore` 和 `groupStore`：

```ts
case 'groupAvatarUpdate':  // 两 Store 均清理缓存并刷新
case 'channelUpdate':      // 两 Store 均同步更新
case 'memberUpdate':       // 两 Store 均拉取成员
```

---

## 相关代码（v1.0 修复位置）

```
packages/datasource-vue/src/cmd/index.ts  ← groupStore 同步刷新逻辑
```

**Constitution 对应条款**：原则 III（SDK 和 Store 单一真相）、原则 IV（后端对齐能力完成）

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm build` | ✅ Pass |
| Layer 3 Store | groupStore CMD 同步逻辑单元测试 | ✅ Pass |
| Layer 5 E2E | 双账号群设置抽屉、邀请成员弹窗、最终会话列表可见 | ✅ Pass，见 `tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` |
| 代码审查 | 检查 cmd/index.ts 两 Store 同步 | ✅ Pass |

---

## 关闭备注

CMD 处理模块已确认同时更新 `channelStore` 和 `groupStore`，双账号群设置/会话审计通过，标记为 Resolved。
