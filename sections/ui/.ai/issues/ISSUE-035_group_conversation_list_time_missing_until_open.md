# [ISSUE-035] 群聊会话列表时间未在打开前显示

**状态**：Resolved
**创建时间**：2026-06-10
**标签**：bug / chat / conversation-list / group / time
**AI修复模式**：Direct Fix
**计划路径**：N/A
**阶段提交**：若开始修复，则每完成一个可验证阶段必须中文 commit。

**修复执行规则**：
- 若 `AI修复模式：Plan First`，先使用 `writing-plans` 写计划，计划无需用户确认直接实现。
- 若 `AI修复模式：Direct Fix`，可以直接修复，但必须使用 `tdd` 思路：先补/确认回归测试，再改实现，再验证。
- 若涉及前端页面、截图或交互验收，必须使用 `browser-preview` 或 Playwright 实测。
- 测试截图必须保存到 `seedcmp/sections/ui/.ai/tests-e2e/` 下，并按 issue 序号命名。
- 若遇到测试失败或行为不符合预期，使用 `debugging` / `systematic-debugging` 定位根因。
- 完成前使用 `verification-before-completion`，确认验证结果后再说完成。

---

## 问题描述

`sections/ui` 的群聊会话列表存在时间显示不稳定问题：部分群聊会话在左侧列表右侧不显示时间；点击进入该群聊后，如果群聊内存在消息，列表才补出最后一条消息时间。如果群聊内没有消息，则仍不显示群聊时间。

截图现象：

1. 左侧会话列表中多个 `UI深验群-*` 群聊右侧时间为空，只显示"你已加入群聊 ..."摘要。
2. 点击 `UI深验群-160100` 后，聊天区能看到消息，左侧该会话立刻显示"昨天"。
3. 这说明进入会话后的消息同步能补齐 `lastTime`，但会话列表初始渲染没有提前得到稳定时间。

预期体验：

1. 群聊会话在列表中不需要等用户点击进入，右侧时间应直接显示。
2. 如果群聊内存在消息，列表右侧显示最后一条记录时间。
3. 如果群聊内没有任何消息，列表右侧显示群创建时间。
4. 该规则应适用于桌面 `pages/chat/index.vue` 和移动 `pages/chat/detail.vue` / 会话入口。

---

## 复现步骤

1. 启动 `sections/ui` 并登录真实账号。
2. 打开聊天首页会话列表。
3. 找到一个群聊会话，例如 `UI深验群-160100`。
4. 在未点击进入前观察左侧会话右侧时间。
5. 点击进入该群聊。
6. 观察左侧同一会话是否在消息加载后才补出时间。
7. 再创建或准备一个没有任何聊天消息的新群，观察列表右侧时间。

实际：

1. 未点击进入前，部分群聊右侧时间为空。
2. 点击进入并同步到消息后，有消息的群聊才显示最后消息时间。
3. 没有消息的群聊仍不显示任何时间。

预期：

1. 未点击进入前，群聊会话右侧也有时间。
2. 有消息群聊显示最后一条消息时间。
3. 无消息群聊显示创建时间。

---

## 相关代码

```text
sections/ui/components/chat/ConversationItem.vue
- 右侧时间只渲染 formatTime(data.lastTime)。
- data.lastTime 为 0 / 空时，formatTime 返回空字符串。

sections/ui/utils/formatConversation.js
- formatTime(timestamp) 对 falsy timestamp 返回 ''。
- 这里不应硬造时间，根因应在 conversation lastTime 归一化/合并阶段解决。

sections/ui/services/native-im/conversation-state.js
- normalizeNativeGroup(input) 会解析 groupLastMessageTime(input)。
- 当前 lastTime = toTimestampMs(groupLastMessageTime(input), lastMessage ? Date.now() : 0)。
- upsertGroupConversation(group) 会构造 lastMessage = normalized.lastMessage || `你已加入群聊 ${normalized.name}`。
- nextConversation.lastTime = normalized.lastTime || normalized.createTime || 0。
- 但已有会话合并时只有 shouldUseGroupLastMessage 为真才替换 lastTime，可能导致已有空时间行没被 createTime 补齐。

sections/ui/services/native-im/normalizers.js
- normalizeConversation(input, channelInfo) 会从 conversation sync 的 last_msg_time / last_message_time / lastMessage.time / recents[0].time 解析 lastTime。
- 如果 conversation sync 没有返回最后消息时间，当前 fallback 依赖 lastMessage ? Date.now() : 0，无法稳定表达"无消息用创建时间"。

sections/ui/stores/conversation.js
- applyNativeConversations(list) 合并 conversation sync 结果。
- applyNativeGroups(groups) / upsertGroupConversation(group) 合并 group sync 结果。
- sortConversations(list) 使用 lastTime 排序。

sections/ui/stores/message.js
- syncNativeMessages / receiveMessage 会在进入会话或收到消息后更新 conversation.lastMessage / lastTime。
- 这解释了"点击进入后才显示时间"的现象，但列表不能依赖进入会话后才修正。

sections/ui/.ai/issues/ISSUE-026_conversation_time_and_reply_quote_state_not_isolated.md
- 曾修复"有最后消息但后端缺时间"的兜底，但本 issue 是剩余的群聊初始列表展示规则：无论是否已有消息，列表应在打开前显示合理时间。
```

---

## 根因分析

初步根因是群聊会话列表的时间来源没有统一为一个稳定规则：

1. `ConversationItem.vue` 只看 `data.lastTime`，而群聊初始列表中部分数据的 `lastTime` 是 `0`。
2. `messageStore` 在进入会话同步消息后会基于真实消息补写 `conversation.lastTime`，所以有消息的群聊表现为"点击后才显示时间"。
3. 群资料同步能提供 `createTime`，但已有会话合并时不一定把 `createTime` 兜底到 `lastTime`，导致无消息群聊仍然没有列表时间。
4. `ISSUE-026` 的兜底更偏向"有最后消息摘要但缺最后消息时间"；本轮需要把群聊列表规则补完整：`lastRecordTime > createTime > 0`，其中 `lastRecordTime` 必须优先来自真实最后消息，而不是点击后才从消息列表补。

需要进一步验证的点：

1. `syncConversations()` 对群聊是否总能返回 `last_msg_time / recents[0].time`。
2. `syncMyGroups()` 是否返回 `created_at / createdAt / createTime`。
3. `applyNativeConversations()` 与 `applyNativeGroups()` 的调用顺序是否会让后到的 group sync 覆盖已有 `lastTime`。
4. 对于后端只返回"你已加入群聊 ..."这类加入提示的群，应该把它视为无聊天消息还是系统记录。建议产品规则按用户要求处理：没有聊天记录时显示群创建时间。

---

## 问题列表（Q&A 迭代）

### Q1: 群聊没有最后一条聊天消息时，列表右侧应该空白吗？
**A1**: 不应该。无聊天消息时显示群创建时间。

### Q2: 群聊有消息时是否可以显示群创建时间？
**A2**: 不可以。有消息时必须优先显示最后一条消息/记录时间。

### Q3: 是否等用户点击进入后再补时间可以接受？
**A3**: 不可以。会话列表首次展示就应该有时间，否则用户无法判断群聊新旧，也会影响排序稳定性。

### Q4: 是否应在 `formatTime` 中给空时间兜底？
**A4**: 不建议。`formatTime` 是展示函数，不知道群聊是否有消息或创建时间。应在 conversation normalization / merge 阶段保证 `lastTime` 是正确业务时间。

---

## 修复建议

1. 增加统一 helper，例如 `resolveGroupConversationDisplayTime(group, messages?)` 或在 `normalizeNativeGroup` 中明确返回：
   - `lastRecordTime`：真实最后消息/记录时间。
   - `createTime`：群创建时间。
   - `displayTime`：`lastRecordTime || createTime || 0`。
2. `upsertGroupConversation` 构造会话时，`lastTime` 使用 `lastRecordTime || createTime || 0`，并保留 `createTime` 到 conversation 对象。
3. 合并已有会话时，如果 existing.lastTime 缺失，应允许 group createTime 兜底：
   - 有新的真实 lastRecordTime：覆盖。
   - 没有 lastRecordTime 但 existing.lastTime 为空：用 createTime。
   - existing.lastTime 已经是消息时间时，不要被 createTime 覆盖。
4. `applyNativeConversations` 合并后不要让缺少时间的 remote conversation 把已有 group createTime / lastTime 清掉。
5. `syncNativeMessages` 或 `receiveMessage` 写入真实消息时间后，仍应覆盖 createTime 兜底，保证有消息时显示最后记录时间。
6. 增加回归测试覆盖：
   - 群有最后消息但 conversation sync 初始缺时间：列表显示最后消息时间或后端 recents 时间。
   - 群无消息但有 createTime：列表显示创建时间。
   - 先用 createTime 兜底，后同步到真实消息：列表时间更新为消息时间。
   - 已有真实消息时间，不被较早 createTime 覆盖。

---

## 验收标准

- 未点击进入群聊前，群聊会话列表右侧必须显示时间。
- 群聊有最后一条消息时，显示最后一条消息/记录时间。
- 群聊没有任何消息时，显示群创建时间。
- 点击进入群聊后，列表时间不会从空白突然变为有值；只允许从创建时间更新为更准确的最后消息时间。
- 会话排序使用同一套时间规则，不让有时间的群聊排到无时间旧位置。
- 桌面聊天首页和移动聊天会话入口都通过。
- 不影响单聊、机器人会话、草稿和置顶排序。

---

## 建议测试

```bash
npm run test:native-im
npm run build:h5
npm run test:smoke
```

补充自动化/手工验收：

1. 构造 group sync 数据：无 last message、有 `createdAt`，断言 `ConversationItem` 显示创建日期。
2. 构造 group sync 数据：有 last message 和 last message time，断言显示最后消息时间。
3. 构造已有 conversation：`lastTime=0`，再 apply group createTime，断言 lastTime 被补齐。
4. 构造已有 conversation：`lastTime=消息时间`，再 apply 较早 createTime，断言不被覆盖。
5. 使用真实账号打开截图中的群聊列表，未点击前保存截图到 `sections/ui/.ai/tests-e2e/ISSUE-035-group-time/`，确认右侧时间可见。

---

## 修复记录

### 2026-06-10

已完成以下修复：

1. `sections/ui/services/native-im/normalizers.js`
   - `normalizeConversation` 只在远端会话确实携带最后消息 payload/content 时生成摘要和当前时间兜底。
   - 空 remote conversation row 不再凭空变成“收到一条新消息”和当前时间。

2. `sections/ui/services/native-im/conversation-state.js`
   - 新增 `mergeNativeConversationTimeline`，统一处理远端会话时间线合并。
   - 当 remote conversation 没有 `lastMessage/lastTime` 时，保留已有 group sync 写入的群创建时间兜底。

3. `sections/ui/stores/conversation.js`
   - `applyNativeConversations` 使用统一时间线合并规则，避免后到的空远端会话覆盖已有群聊列表时间。

4. `sections/ui/tests/native-im.test.mjs`
   - 新增回归测试覆盖空 remote group row 不造当前时间。
   - 新增回归测试覆盖 group createTime 兜底不会被空 conversation sync 覆盖。

---

## 测试结果

```bash
# 红灯验证（修复前）
npm run test:native-im
# exit 1
# FAIL conversation normalizer does not invent current time for empty remote group rows
# FAIL conversation merge preserves group create time fallback when remote sync has no time

# 单元/集成回归（修复后）
npm run test:native-im
# exit 0
# tests 58 / pass 58 / fail 0

# H5 构建
npm run build:h5
# exit 0
# DONE Build complete.

# 启动真实本地环境
PATH=/home/yunyi/go1.22/go/bin:$PATH bash scripts/start-im-clowder.sh start
# exit 0
# AgentHub UI: http://localhost:5173

# 浏览器可视化验收
# Playwright 打开 http://localhost:5173/#/pages/chat/index
# 桌面 viewport: 1440x900
# 移动 viewport: 375x844
# 断言：
# - 空群 `ISSUE-035空群` 右侧时间可见，来自群创建时间。
# - 消息群 `ISSUE-035消息群` 右侧时间可见，来自最后消息时间。
# - 未点击进入群聊前列表已显示时间。
# - body/document scrollWidth 不超过 viewport width。
# - requestFailures = []，console error = []。
```

证据路径：

```text
sections/ui/.ai/tests/ISSUE-035-20260610014612/result.json
sections/ui/.ai/tests/ISSUE-035-20260610014612/browser-console.json
sections/ui/.ai/tests/ISSUE-035-20260610014612/request-log.json
sections/ui/.ai/tests/ISSUE-035-20260610014612/request-failures.json
sections/ui/.ai/tests/ISSUE-035-20260610014612/desktop-1440x900-clean.png
sections/ui/.ai/tests/ISSUE-035-20260610014612/mobile-375x844-clean.png
```

---

## 关闭备注

已解决。群聊列表时间来源收敛到数据归一化/合并阶段：有最后消息时优先使用最后消息时间；无消息但有群创建时间时使用创建时间；后续空 conversation sync 不会清空已有时间。桌面与移动 H5 浏览器验收均通过。
