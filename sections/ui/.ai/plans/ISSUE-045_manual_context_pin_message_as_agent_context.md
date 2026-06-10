# ISSUE-045 Manual Context Pin Implementation Plan

**Feature:** ISSUE-045 — 手动 pin 关键消息作为 Agent 长期上下文
**Goal:** 用户能在 Agent 单聊和含 Agent 群聊中把关键消息设为/取消长期上下文，并让后续 Clowder invocation 使用后端 manual context pins 注入链路。
**Acceptance Criteria:**
- 桌面端消息右键菜单显示“设为长期上下文”，已 pin 后显示“取消长期上下文”。
- 移动端长按菜单具备同等能力。
- pin 请求走 `/v1/clowder/thread/:threadId/manual-context-pins`，payload 包含 `messageId` 和 `contentExcerpt`。
- 刷新页面后已 pin 消息仍有长期上下文标记。
- unpin 后 active pins 列表移除，对应消息标记消失。
- 后续 Agent invocation 的上下文包含 `[Manual context pins - user selected, max 5]`，且 pin 内容位于普通历史之前。
- 删除/撤回源消息后，长期上下文不再作为 active pin 注入；首版在删除/撤回本地动作中调用 `source-status` 标记 `source_deleted`。
- UI 文案和视觉上明确区分“置顶会话/置顶消息”和“设为长期上下文”。
- 单聊、群聊、桌面 viewport、移动 viewport 都通过浏览器验收。
- 不破坏现有 `promptContext`、引用回复、reaction、删除/撤回消息、会话置顶能力。
**Architecture cell:** sections/ui native-im + chat components
**Map delta:** none
**Map delta why:** 在既有 native IM/Clowder bridge 集成内补齐 UI 到已有后端能力的调用，不新增 ownership cell。
**Architecture:** 增加前端 manual-context-pin helper/service/store 状态；消息列表渲染时按 thread active pins 给源消息打标；菜单操作调用 TangSeng bridge 的 Clowder manual context pins API；Agent 后续调用继续由 Clowder runtime 从后端 pins 注入 prompt。
**Tech Stack:** Vue 3 / uni-app / Pinia / TangSeng bridge `/v1/clowder/thread/:threadId/manual-context-pins` / Playwright
**前端验证:** Yes — 必须使用 Playwright 覆盖桌面和移动端。

---

## Finish Line

用户在聊天消息上右键/长按即可把消息加入 Agent 长期上下文，刷新后标记仍在，取消后标记消失；测试能证明后端 manual context pin API 被调用，且 Clowder context formatter 产出 `[Manual context pins - user selected, max 5]` 区块。

首版不做完整右侧“长期上下文管理面板”，避免把信息架构范围扩大；消息菜单和低干扰气泡标记足以完成验收闭环。

## Terminal Schema

```js
ManualContextPin = {
  id: string,
  threadId: string,
  channelId: string,
  channelType: number,
  messageId: string,
  messageSeq?: number,
  clientMsgNo?: string,
  contentExcerpt: string,
  senderName?: string,
  pinnedBy?: string,
  status: 'active' | 'removed' | 'source_deleted' | 'permission_denied'
}

PinPayload = {
  channelId: string,
  channelType: number,
  messageId: string,
  clientMsgNo?: string,
  messageSeq?: number,
  contentExcerpt: string,
  senderName?: string
}

message.manualContextPinned = boolean
message.manualContextPinId = string
```

## Task 1: Red Tests For Service And Store Contracts

**Files:**
- Modify: `sections/ui/tests/native-im.test.mjs`

**Step 1:** Add failing service tests for:
- `nativeImService.listManualContextPins(threadId, { limit })` -> `GET /v1/clowder/thread/:threadId/manual-context-pins?limit=5`
- `nativeImService.upsertManualContextPin(threadId, payload)` -> `POST /v1/clowder/thread/:threadId/manual-context-pins`
- `nativeImService.removeManualContextPin(threadId, pinId)` -> `DELETE /v1/clowder/thread/:threadId/manual-context-pins/:pinId`
- `nativeImService.markManualContextPinSourceStatus(threadId, payload)` -> `PATCH /v1/clowder/thread/:threadId/manual-context-pins/source-status`

**Step 2:** Add failing pure helper/store tests for:
- Resolve thread id from direct Agent conversation metadata and group project binding metadata.
- Build `PinPayload` from text/Markdown/file messages, truncating `contentExcerpt`.
- Apply active pins to messages and remove mark after unpin.

**Step 3:** Run:

```bash
cd sections/ui
npm run test:native-im -- --test-name-pattern="manual context"
```

Expected: FAIL for missing service/store helpers.

## Task 2: Service Layer Implementation

**Files:**
- Modify: `sections/ui/services/native-im/service.js`
- Create: `sections/ui/services/native-im/manual-context-pins.js`

**Step 1:** Implement normalizers and helpers:
- `normalizeManualContextPin`
- `normalizeManualContextPinsResponse`
- `resolveConversationThreadId`
- `buildManualContextPinPayload`
- `applyManualContextPinsToMessages`

**Step 2:** Implement service wrappers:
- `listManualContextPins`
- `upsertManualContextPin`
- `removeManualContextPin`
- `markManualContextPinSourceStatus`

**Step 3:** Run targeted tests until green.

**Step 4:** Commit:

```bash
git commit -m "补齐长期上下文接口与状态助手"
```

## Task 3: Message Store Integration

**Files:**
- Modify: `sections/ui/stores/message.js`
- Modify as needed: `sections/ui/stores/conversation.js`

**Step 1:** Add state:
- `manualContextPinsByThread`
- `manualContextPinSyncStateByThread`
- `manualContextPinErrorsByThread`

**Step 2:** Add actions:
- `syncManualContextPins(conversationOrId, options)`
- `pinMessageAsContext(conversationOrId, message)`
- `unpinMessageAsContext(conversationOrId, messageOrPinId)`
- `markManualContextSourceDeleted(conversationOrId, message)`

**Step 3:** Ensure message mutation paths re-apply pin flags:
- after sync messages
- after receive native message
- after local send append
- after pin/unpin

**Step 4:** When deleting/revoking a pinned message, call source-status `source_deleted` and clear active local mark.

**Step 5:** Run targeted and full native-im tests.

**Step 6:** Commit:

```bash
git commit -m "接入消息长期上下文状态"
```

## Task 4: UI Menu And Bubble Marker

**Files:**
- Modify: `sections/ui/components/chat/MessageContextMenu.vue`
- Modify: `sections/ui/components/chat/MessageBubble.vue`
- Modify: `sections/ui/pages/chat/index.vue`
- Modify: `sections/ui/pages/chat/detail.vue`

**Step 1:** `MessageContextMenu` add props:
- `canPinAsContext`
- `pinContextDisabledReason`

**Step 2:** Menu item behavior:
- If message is not pinned: show `设为长期上下文`
- If pinned: show `取消长期上下文`
- Hide for revoked/system messages.
- Disable with clear title/label when current conversation has no Clowder thread.

**Step 3:** `MessageBubble` adds compact marker:
- Text: `长期上下文`
- Placement below bubble content, not inside text flow.
- No overlap with reaction/status.

**Step 4:** Page handlers:
- On menu open, derive current conversation and pass pin capability into menu.
- On `pin-context`/`unpin-context`, call message store actions and show toast.
- On page mount / active conversation change, sync manual context pins.

**Step 5:** Run H5 build and Playwright smoke.

**Step 6:** Commit:

```bash
git commit -m "增加长期上下文菜单与标记"
```

## Task 5: Browser Evidence And Clowder Context Injection Proof

**Files:**
- Create: `sections/ui/.ai/tests/ISSUE-045-20260610212802/verify-manual-context-pins.mjs`
- Update: `sections/ui/.ai/issues/ISSUE-045_manual_context_pin_message_as_agent_context.md`

**Step 1:** Playwright test setup:
- Register/login temporary users.
- Intercept `/v1/clowder/thread/*/manual-context-pins` and persist mock pins per thread.
- Seed one Agent direct chat with `threadId`.
- Seed one group chat with `projectThreadId`.

**Step 2:** Desktop path:
- Open `/#/pages/chat/index` at 1440x900.
- Right click message -> assert menu has `设为长期上下文`.
- Click pin -> assert POST payload has `messageId` and `contentExcerpt`.
- Assert bubble marker appears.
- Reload -> assert GET restores marker.
- Right click -> unpin -> assert DELETE and marker removed.

**Step 3:** Mobile path:
- Open `/#/pages/chat/detail?id=<group>` at 390x844.
- Long press message -> assert same pin/unpin behavior.

**Step 4:** Context injection proof:
- Use Clowder `formatManualContextPins` or live route evidence to verify formatted context includes `[Manual context pins - user selected, max 5]` and selected excerpt before normal history.

**Step 5:** Save:
- `result.json`
- `request-log.json`
- `browser-console.json`
- `playwright.log`
- desktop/mobile menu/state screenshots
- `clowder-context-log.txt`

## Task 6: Final Verification And Issue Close

**Commands:**

```bash
cd sections/ui && npm run test:native-im
cd sections/ui && npm run build:h5
cd sections/ui && node .ai/tests/ISSUE-045-20260610212802/verify-manual-context-pins.mjs
git diff --check
```

**Closeout:**
- Update ISSUE-045 status to `Resolved`.
- Record fix summary, command logs, screenshots, and evidence path.
- Use `verification-before-completion` before final report.
- Commit:

```bash
git commit -m "完成长期上下文消息 pin 验证"
```
