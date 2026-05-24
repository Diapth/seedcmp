# [V2-07] 群聊会话排序、设置展示与体验回归 — V2.0 回归风险

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / group-chat / ux / regression
**优先级**：P1
**来源**：[v1.0 ISSUE-15](https://git.whatever/.../issues/15)（Resolved 2026-05-23）

---

## v1.0 问题摘要（8 个子问题）

1. 刷新后群聊会话时间变成本地当前时间，污染排序
2. 点击会话后列表消失或顺序跳变
3. 群设置首次打开不展示成员
4. 群主无法编辑群公告和群头像
5. 邀请成员使用浏览器原生 `prompt` 而非项目弹窗
6. 置顶与免打扰图标相同，无法区分
7. @ 用户缺少 `[有人@我]` 会话标记
8. 系统消息仍拼接发送者名字

**v1.0 根因**：补齐群会话时用 `Date.now()` 冒充历史时间；群设置抽屉只在 mounted 时加载一次；权限判断来源不一致；@ 元数据未进入摘要计算。

**v1.0 修复**（大量）：
- `groupChatUtils.ts`：`buildConversationFromGroup()` 不再使用本地当前时间
- `conversationPresentation.ts`：中文时间格式化 + 结构化摘要（`[有人@我]`、发送者、内容分字段）
- `ConversationList.vue`：@ 摘要左侧红色显示、系统消息不拼接名字、置顶/免打扰不同图标
- `GroupSettingsDrawer.vue`：打开时重新加载、群主编辑入口、弹窗邀请多选
- `messageStore.ts`：优先用非系统消息作为摘要
- `conversationStore.ts`：`prefetchMissingGroupConversationSummaries()` 主动预取

---

## V2.0 回归风险分析

这是 v1.0 中修复最重的一个 issue，涉及 8 个独立子问题，V2.0 重构中每个都有可能重新出现：

1. **时间格式化逻辑**：`conversationPresentation.ts` 的 `formatConversationTime` 和 `buildDigestPresentation` 若被重构，v1.0 修复的 8 个场景中的大部分都会回归
2. **群会话补齐逻辑**：`groupChatUtils.buildConversationFromGroup()` 若在 V2.0 中被改写，本地时间冒充问题会重新出现
3. **会话列表组件**：`ConversationList.vue` 若切换渲染方式，@ 标记位置、系统消息格式、状态图标差异均可能回归
4. **群设置抽屉**：`GroupSettingsDrawer.vue` 打开时重新加载、权限判断、弹窗邀请均在风险区
5. **历史消息预取**：`prefetchMissingGroupConversationSummaries()` 负责首屏群聊摘要，离线场景最关键

---

## 验证步骤（V2.0 回归测试）

### Step 1 — Build Gate
```bash
pnpm type-check && pnpm build
```

### Step 2 — 时间展示（手动）
刷新后观察群聊会话列表时间：
- **通过标准**：今天 `HH:mm`、昨天 `昨天 HH:mm`、一周内 `星期几 HH:mm`、超一周 `MM/DD`、超一年 `YYYY/MM/DD`

### Step 3 — 会话排序（手动）
1. 有历史消息的群刷新页面
2. **通过标准**：群聊不会因为刷新被顶到最新位置

### Step 4 — @ 提醒摘要（手动）
1. 在群聊中 @ 其他用户
2. **通过标准**：被 @ 用户会话列表左侧显示红色 `[有人@我]`，然后是发送者，然后是内容

### Step 5 — 系统消息格式（手动）
1. 查看"你已加入群聊"等系统消息
2. **通过标准**：不显示发送者名字，直接显示消息内容

### Step 6 — 置顶/免打扰图标（手动）
1. 打开群设置
2. **通过标准**：置顶和免打扰使用不同图标

### Step 7 — 群主编辑入口（手动）
1. 用群主账号打开群设置
2. **通过标准**：群头像、群公告、群名有明确编辑入口

### Step 8 — 邀请成员弹窗（手动）
1. 点击"邀请成员"
2. **通过标准**：弹出项目内统一样式弹窗（非浏览器原生 prompt）

### Step 9 — 组件测试（Vitest）
```bash
pnpm test:unit -- --grep "conversationPresentation"
# 覆盖：formatConversationTime 各时间场景、buildDigestPresentation 系统消息和 @ 标记
```

---

## 相关代码（v1.0 修复位置）

```
apps/chat/src/utils/conversationPresentation.ts    ← 时间格式化 + 摘要结构化
packages/datasource-vue/src/stores/groupChatUtils.ts ← 不使用本地当前时间
packages/datasource-vue/src/stores/conversationStore.ts ← prefetchMissingGroupConversationSummaries
packages/datasource-vue/src/stores/messageStore.ts  ← 非系统消息优先
apps/chat/src/views/ConversationList.vue            ← @ 标记、图标、系统消息
packages/base-vue/src/components/GroupSettingsDrawer.vue ← 群主权限、弹窗邀请
```

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm build` | ✅ Pass |
| Layer 3 Store | conversationPresentation 工具函数测试 | ✅ Pass |
| Layer 5 E2E | 会话列表展示探测、群设置抽屉、邀请成员弹窗、刷新保留 | ✅ Pass，见 `tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` |

---

## 关闭备注

会话展示工具函数已由 Vitest 覆盖；双账号浏览器审计覆盖会话列表、群设置抽屉和邀请弹窗，标记为 Resolved。
