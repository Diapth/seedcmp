# [V2-08] 群主权限未使用成员角色导致公告和头像入口缺失 — V2.0 回归风险

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / group-chat / permission / regression
**优先级**：P1
**来源**：[v1.0 ISSUE-16](https://git.whatever/.../issues/16)（Resolved 2026-05-23）

---

## v1.0 问题摘要

真实环境中，成员列表明确显示当前用户为"群主"，但群设置面板中无群头像编辑入口、群公告无"修改"按钮，底部显示"退出群聊"而非"解散群组"。

**v1.0 根因**：
- `/v1/group/my` 中 `TestGroup1.role = 0`（错误）
- `/v1/groups/{group_no}` 中 `role = 1`（正确）
- `/v1/groups/{group_no}/members` 中当前用户 `role = 1`（正确）

群设置抽屉使用群概要缓存判断权限，而概要来自 `/group/my`，与成员列表中正确角色不一致。

**v1.0 修复**：
- `GroupSettingsDrawer.vue` 新增 `currentMember` 和 `currentMemberRole`
- `isCurrentUserOwner` 增加成员列表角色回退判断（`role = 1` → 群主）
- `canManageGroup` 增加管理员角色判断（`role = 2` → 管理员）

---

## V2.0 回归风险分析

1. **权限判断来源变化**：`GroupSettingsDrawer.vue` 若在 V2.0 中被重写，权限判断逻辑可能直接采用群概要缓存而非成员列表回退
2. **Store 数据源变化**：`groupStore.groups[groupNo]` 若新增 `owner` / `creator` 字段，权限判断可能被简化为只看概要而移除回退
3. **角色字段命名**：后端角色字段可能重命名（`role` → `member_role`），若前端未同步更新，权限判断会全部失效
4. **成员列表懒加载**：若 V2.0 改变成员列表加载策略（改为按需加载），权限判断可能在成员列表加载前就已执行，导致回退逻辑无法生效

---

## 验证步骤（V2.0 回归测试）

### Step 1 — Build Gate
```bash
pnpm type-check && pnpm build
```

### Step 2 — 群主权限入口（手动，需群主账号）
1. 用群主账号进入群聊
2. 打开群设置
3. **通过标准**：
   - 有群头像"编辑/更换头像"入口
   - 群公告有"修改"按钮
   - 底部显示"解散群组"（而非"退出群聊"）

### Step 3 — 管理员权限入口（手动，需管理员账号）
1. 用管理员（非群主）账号进入群聊
2. 打开群设置
3. **通过标准**：有部分管理权限（如邀请成员），但无解散权限

### Step 4 — 普通成员权限（手动）
1. 用普通成员账号进入群聊
2. 打开群设置
3. **通过标准**：无编辑入口，只有"退出群聊"

### Step 5 — 权限判断代码审查
检查 `GroupSettingsDrawer.vue` 或等价组件，确认权限判断**同时**检查：
- `group.owner` / `group.creator`（概要缓存）
- `currentMember.role`（成员列表回退，作为 fallback）

---

## 相关代码（v1.0 修复位置）

```
packages/base-vue/src/components/GroupSettingsDrawer.vue  ← isCurrentUserOwner, canManageGroup
packages/datasource-vue/src/stores/groupChatUtils.ts      ← getMyGroupRole
```

**Constitution 对应条款**：原则 IV（后端对齐能力完成）—— 权限 UI 必须诚实反映后端真实角色

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm build` | ✅ Pass |
| Layer 2 Component | 群主/管理员/普通成员权限 UI 测试 | ✅ Pass |
| Layer 5 E2E | 双账号群设置抽屉、邀请成员弹窗、权限入口探测 | ✅ Pass，见 `tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` |
| 代码审查 | 权限判断同时覆盖概要和成员列表回退 | ✅ Pass |

---

## 关闭备注

V2.0 权限判断代码已确认包含成员列表回退逻辑；双账号群设置审计通过，标记为 Resolved。三角色矩阵可在后续完整群管理 Story 中继续扩展。
