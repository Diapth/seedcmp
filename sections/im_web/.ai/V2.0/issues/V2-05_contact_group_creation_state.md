# [V2-05] 联系人缺少发起群聊入口、添加好友状态判断不完整 — V2.0 回归风险

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / ux / contact / regression
**优先级**：P1
**来源**：[v1.0 ISSUE-09](https://git.whatever/.../issues/09)（Resolved 2026-05-23）

---

## v1.0 问题摘要

1. **联系人页无发起群聊入口**：联系人页只有"添加好友"和"跳转到群聊列表"，无法直接发起群聊
2. **添加好友状态判断不完整**：搜索已加好友或自己，仍可能显示"发送好友申请"

**v1.0 修复**：
- `ContactList.vue` 新增"发起群聊"快捷入口，跳转 `/chat/create-group`
- `friendSearchState.ts` 新增好友搜索状态判断
- `AddFriendPage.vue` 搜索自己时显示"这是你自己"；已是好友时显示"进入会话"

---

## V2.0 回归风险分析

1. **路由变化**：V2.0 若修改或移除 `/chat/create-group` 路由，"发起群聊"入口跳转会失效
2. **联系人页重构**：`ContactList.vue` 或等价组件若被重写，快捷入口可能被遗漏
3. **好友状态判断迁移**：添加好友页若改用新状态管理，`friendSearchState.ts` 逻辑可能未迁移
4. **自己判断逻辑**：搜索结果对自己展示"发送好友申请"的 bug 若在 V2.0 又引入，则违反 Constitution 原则 II（用户体验一致性）

---

## 验证步骤（V2.0 回归测试）

### Step 1 — Build Gate
```bash
pnpm type-check && pnpm build
```

### Step 2 — 发起群聊入口（手动）
1. 打开联系人页
2. **通过标准**：能找到"发起群聊"或等价的创建群聊入口
3. 点击后跳转到创建群聊页面（而非仅是群聊列表滚动）

### Step 3 — 添加好友状态（手动）
1. 进入"添加好友"页面
2. 搜索已经是好友的用户
3. **通过标准**：不显示"发送好友申请"，显示"已是好友"或"进入会话"
4. 搜索自己的手机号或 UID
5. **通过标准**：不显示"发送好友申请"，显示"这是你自己"或等效提示

### Step 4 — 组件测试（Vitest，待工具安装后）
```bash
pnpm test:unit -- --grep "ContactList\|AddFriend"
# 覆盖快捷入口跳转、好友状态判断、自己识别
```

---

## 相关代码（v1.0 修复位置）

```
packages/contacts-vue/src/views/ContactList.vue        ← 发起群聊入口
packages/contacts-vue/src/views/AddFriendPage.vue     ← 状态判断
packages/contacts-vue/src/utils/friendSearchState.ts  ← 状态判断工具
```

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm build` | ✅ Pass |
| Layer 2 Component | ContactList 快捷入口组件测试 | ✅ Pass |
| Layer 2 Component | AddFriendPage 状态判断测试 | ✅ Pass |
| Layer 5 E2E | 发起群聊页面、添加好友页面可访问 | ✅ Pass，见 `tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` |

---

## 关闭备注

V2.0 中上述修复位置和等价逻辑已确认存在；双账号浏览器审计覆盖发起群聊与添加好友页面，标记为 Resolved。
