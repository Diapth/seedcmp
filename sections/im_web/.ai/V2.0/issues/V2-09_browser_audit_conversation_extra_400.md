# [V2-09] 双账号浏览器审计发现 conversation extra 空草稿同步 400

**状态**：Resolved
**创建时间**：2026-05-24
**标签**：bug / browser-audit / regression
**优先级**：P1

---

## 问题描述

双账号浏览器自动化截图测试中，账号 `18337488675` 在群聊发送消息后，控制台出现：

```text
POST /v1/conversations/{group_no}/2/extra 400
[ConversationStore] Remote update conversation extra command failed; local state was kept
msg: 发送同步扩展会话cmd失败！
```

测试截图与报告：

- `sections/im_web/.ai/V2.0/issues/tests-e2e/two-account-audit-2026-05-23T17-53-35-628Z/summary.md`
- `sections/im_web/.ai/V2.0/issues/imgs/two-account-audit-2026-05-23T17-53-35-628Z/`

---

## 根因分析

`MessageInput.vue` 在发送消息时会清空输入框。输入框 watcher 调用 `conversationStore.updateDraft(channelId, channelType, '')`，随后 `conversationStore` 仍会向后端发送空草稿同步请求。

如果当前会话没有成功同步过非空草稿，这个空草稿同步没有业务价值；但后端 `conversationExtraUpdate` 在 DB 更新后继续发送 `syncConversationExtra` CMD，远程环境 CMD 失败时返回 400，导致浏览器审计出现网络错误和控制台警告。

---

## 修复策略

- 前端记录每个会话最近一次成功同步到后端的 draft。
- 如果新 draft 为空，并且从未成功同步过非空 draft，则跳过远程同步，仅保留本地清空状态。
- 如果之前已经成功同步过非空 draft，则允许同步空 draft，用于清除后端草稿。

---

## 测试发现记录

| 测试类型 | 命令 / 操作 | 结果 |
|---|---|---|
| Layer 3 Store | `pnpm --filter chat test:unit -- tests/groupOfflineUnreadRetention.test.ts` | ✅ Pass，7 files / 21 tests |
| Layer 5 Browser | 双账号浏览器自动化截图测试 | ✅ Pass，16 checks / 0 failed / 19 screenshots / 0 network errors |

---

## 关闭备注

已修复 `conversationStore.updateDraft()` 的空草稿同步策略：

- 从未成功同步过远端非空草稿时，发送消息后的空草稿不再触发 `/conversations/{channel_id}/{channel_type}/extra`。
- 已成功同步过非空草稿时，清空草稿仍会同步到后端，保证远端草稿可被清除。

验证通过：

- `pnpm --filter chat test:unit -- tests/groupOfflineUnreadRetention.test.ts`
- 双账号浏览器自动化截图测试：`sections/im_web/.ai/V2.0/issues/tests-e2e/two-account-audit-2026-05-23T18-00-03-819Z/summary.md`
