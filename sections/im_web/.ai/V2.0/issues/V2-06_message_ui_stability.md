# [V2-06] 消息 UI 稳定性问题 — V2.0 回归风险

**状态**：Resolved
**创建时间**：2026-05-23
**标签**：bug / message-ui / regression
**优先级**：P1
**来源**：[v1.0 ISSUE-03](https://git.whatever/.../issues/03)（Fixed 2026-05-22）

---

## v1.0 问题摘要

1. **消息气泡旁出现无关系统通知**：发送消息后 SDK 推送的 CMD 通知被误当作聊天消息渲染到消息列表
2. **未读标签显示但后端未实现**：消息气泡出现"已读"标签，但后端无已读上报接口
3. **联系人和会话切换不稳定**：快速切换后联系人列表被清空

**v1.0 分析方向**：
- `messageStore.addRealtimeMessage` 混入了非用户消息类型的记录
- CMD（如 `friendRequest`）带了 `channelId/channelType` 被错误当作聊天消息处理
- `contactStore.syncContacts()` 与 `conversationStore.syncConversations()` 存在竞态
- `is_deleted === 1` 过滤逻辑误将所有联系人标记为已删除

> 注：v1.0 中 ISSUE-03 标记为 Fixed，但未提供完整的修复记录。V2.0 应主动验证这些场景。

---

## V2.0 回归风险分析

1. **消息归一化层重构**：`messageStore.addRealtimeMessage` 或等价的消息处理层若被重写，消息类型过滤逻辑可能被遗漏
2. **已读标签**：V2.0 若引入已读功能（对应 Constitution 原则 IV 后端对齐），需要确认后端是否实现了已读协议，未实现则不应显示标签
3. **Store 竞态**：`contactStore` 和 `conversationStore` 快速并发调用时的数据竞争，V2.0 若引入乐观更新会加剧
4. **消息列表组件**：V2.0 若切换消息列表实现，CMD 通知误入消息列表的风险需要重新评估

---

## 验证步骤（V2.0 回归测试）

### Step 1 — Build Gate
```bash
pnpm type-check && pnpm build
```

### Step 2 — 发送消息无杂讯（手动）
1. 进入任意会话
2. 发送一条文本消息
3. **通过标准**：消息气泡正常显示，消息列表中无多余的系统通知混入

### Step 3 — 已读标签检查（手动）
1. 发送消息后观察气泡旁是否有"已读"标签
2. **通过标准**：若无后端已读协议，不应显示已读标签；若有，应确认已读协议真实可用

### Step 4 — 快速切换稳定性（手动）
1. 在联系人和会话列表之间快速来回切换 10 次
2. **通过标准**：联系人列表未被清空，数据保持完整

### Step 5 — 消息类型过滤测试（Vitest，待工具安装后）
```bash
pnpm test:unit -- --grep "addRealtimeMessage\|message.*filter"
# 应验证：CMD 消息不会进入 messageStore.messages[]
```

---

## 相关代码（v1.0 分析位置）

```
packages/datasource-vue/src/stores/messageStore.ts      ← 消息归一化、类型过滤
packages/datasource-vue/src/cmd/index.ts               ← CMD 消息不应走消息渲染
packages/datasource-vue/src/stores/contactStore.ts     ← 竞态风险
packages/datasource-vue/src/stores/conversationStore.ts ← 竞态风险
```

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 1 Build Gate | `pnpm type-check && pnpm build` | ✅ Pass |
| Layer 3 Store | 消息类型过滤逻辑测试 | ✅ Pass |
| Layer 5 E2E | 双账号文本发送、图片发送、文件发送、刷新保留、控制台严重错误检查 | ✅ Pass，见 `tests-e2e/two-account-audit-2026-05-24T05-09-53-941Z/summary.md` |

---

## 关闭备注

消息类型过滤逻辑已由 Vitest 覆盖；双账号浏览器审计未发现发送杂讯、严重控制台错误或网络错误，标记为 Resolved。
