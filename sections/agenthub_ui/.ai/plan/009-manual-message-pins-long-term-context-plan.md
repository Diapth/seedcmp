# Manual Message Pins as Long-Term Context Implementation Plan

**Feature:** Issue 009 - `sections/agenthub_ui/.ai/issue/009-manual-message-pins-long-term-context.md`
**Goal:** Users can manually pin key chat messages as durable, auditable long-term context for later Clowder agent invocations.
**Acceptance Criteria:**
1. Desktop right-click menu and mobile long-press menu can pin / unpin supported messages.
2. Pinned message state survives page refresh.
3. Current conversation shows a pinned context list and can jump back to the source message.
4. Later Clowder agent invocations receive manual pins as an independent context source, with priority over automatic anchors.
5. Context briefing or equivalent UI shows manual pin count and summaries so users can audit what the system gave the cat.
6. Deleted, revoked, or permission-denied source messages are not injected and show a clear degraded state.
7. Unit tests cover store action, API adapter, context selection priority, and deletion degradation; H5 smoke covers pin, refresh, and unpin.
**Architecture cell:** `thread-navigation` + F148 context transport under `memory`
**Map delta:** none
**Map delta why:** This extends existing user-facing pin semantics and F148 context assembly; it does not introduce a new ownership boundary.
**Architecture:** Reuse the existing IM pinned-message backend contract from `im_web`, wire it into `agenthub_ui`, then mirror active Clowder-thread pins into a small manual context pin store consumed by F148 context assembly. All Clowder context integration is optional and fail-open: if no manual pin store is available, routing behavior remains unchanged.
**Tech Stack:** Vue 3, uni-app, Pinia, existing AgentHub `request()` adapter, Clowder API Fastify routes, Redis-backed or in-memory store port, F148 routing helpers.
**前端验证:** Yes - H5 dev server with Playwright / Chromium screenshots.

---

## Finish Line

B state: a user pins a message in AgentHub UI, refreshes, sees it in the current conversation's pinned context list, triggers a Clowder cat, and can verify in the context briefing that the pinned message summary was included; unpin removes it from both UI and future context.

Not building:

- A global favorites or knowledge-base collection.
- Cross-thread context bridge.
- Agent-created pins without explicit user confirmation.
- Unlimited prompt injection of every pinned message.

## Terminal Schema

Frontend message pin state follows existing `im_web` semantics and adds a Clowder context mirror only when a conversation is bound to a thread:

```ts
type ManualContextPin = {
  id: string;
  threadId?: string;
  channelId: string;
  channelType: number;
  messageId: string;
  messageSeq?: number;
  clientMsgNo?: string;
  contentExcerpt: string;
  senderName?: string;
  pinnedBy: string;
  pinnedAt: string;
  updatedAt: string;
  status: 'active' | 'removed' | 'source_deleted' | 'permission_denied';
};
```

Routing output adds manual pins without changing existing automatic anchors:

```ts
type ManualContextPinSummary = Pick<
  ManualContextPin,
  'id' | 'messageId' | 'contentExcerpt' | 'senderName' | 'pinnedBy' | 'pinnedAt' | 'status'
>;
```

Manual pin context section format:

```text
[Manual context pins - user selected, max 5]
[pin:{messageId} @{senderName}] {contentExcerpt}
[/Manual context pins]
```

## Source References

- `sections/im_web/packages/datasource-vue/src/api/index.ts:361` already has `pinMessage`, `syncPinnedMessages`, and `clearPinnedMessages`.
- `sections/im_web/packages/datasource-vue/src/stores/messageStore.ts:1646` already has `togglePinnedMessage()` and `syncPinnedMessages()`.
- `sections/agenthub_ui/api/sync.js` currently only exposes `pinMessage(data)`.
- `sections/agenthub_ui/stores/message.js` currently has `pinnedMessages: {}` but no actions.
- `sections/agenthub_ui/components/chat/MessageContextMenu.vue` already owns desktop and mobile message actions.
- `sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/route-helpers.ts` assembles F148 context and already supports fail-open optional stores.

---

## Task 0: Contract Spike - Decide the Clowder Thread Bridge

**Files:**
- Read: `sections/agenthub_ui/stores/clowder.js`
- Read: `sections/agenthub_ui/api/clowder.js`
- Read: `sections/clowder-ai/packages/api/src/index.ts`
- Read: `sections/clowder-ai/packages/api/src/routes/thread-tasks.ts`
- Update if needed: `sections/agenthub_ui/.ai/issue/009-manual-message-pins-long-term-context.md`

**Purpose:** Confirm how AgentHub can resolve `channelId/channelType -> threadId` for Clowder project groups and direct cat chats before implementing the context mirror.

**Decision target:**

- If `clowderStore` already has a bound thread id for the active conversation, use that thread id.
- If no thread binding exists, pin only through IM `message/pinned`; show "未绑定 Clowder thread，不进入长期上下文" in the pinned context list.
- Do not invent cross-thread mapping in this issue.

**Verification command:**

```bash
rg -n "threadId|thread_id|binding|fetchBinding|projectThreadId" sections/agenthub_ui/stores sections/agenthub_ui/components sections/agenthub_ui/pages
```

Expected: identify the existing active-binding source and record it in the issue if the path differs from this plan.

**Commit checkpoint:**

```bash
git commit -m "009 阶段0：确认长期上下文 pin 的 thread 绑定契约"
```

---

## Task 1: Add AgentHub API Parity for Pinned Messages

**Files:**
- Modify: `sections/agenthub_ui/api/sync.js`
- Test: `sections/agenthub_ui/tests/unit/request.spec.js` or `sections/agenthub_ui/tests/unit/im-domain.spec.js`

**Step 1: Write failing adapter tests**

Add tests that call:

```js
syncApi.syncPinnedMessages({ channel_id: 'g1', channel_type: 2, version: 0 });
syncApi.clearPinnedMessages({ channel_id: 'g1', channel_type: 2 });
```

Expected request paths:

```text
POST message/pinned/sync
POST message/pinned/clear
```

**Step 2: Run failing test**

```bash
cd sections/agenthub_ui
pnpm test:unit tests/unit/request.spec.js
```

Expected: FAIL because the methods do not exist.

**Step 3: Implement API methods**

Add:

```js
syncPinnedMessages(data) {
  return request('message/pinned/sync', { method: 'POST', data });
},
clearPinnedMessages(data) {
  return request('message/pinned/clear', { method: 'POST', data });
}
```

**Step 4: Verify**

```bash
cd sections/agenthub_ui
pnpm test:unit tests/unit/request.spec.js
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "009 阶段1：补齐 AgentHub 置顶消息 API"
```

---

## Task 2: Implement Message Store Pin State and Hydration

**Files:**
- Modify: `sections/agenthub_ui/stores/message.js`
- Test: `sections/agenthub_ui/tests/unit/im-domain.spec.js`

**Step 1: Write failing store tests**

Cover:

- `togglePinnedMessage(channelId, channelType, msg)` calls `syncApi.pinMessage`.
- Toggle sets `msg.remoteExtra.isPinned`.
- `syncPinnedMessages(channelId, channelType)` loads backend pinned records and marks existing messages.
- Source-deleted or unavailable pinned messages become placeholder items with `remoteExtra.unavailable`.
- `reset()` clears `pinnedMessages` and `pinnedVersions`.

Test skeleton:

```js
it('syncs pinned messages and marks existing messages as pinned', async () => {
  setRequestAdapter(async ({ url }) => {
    if (url.includes('/message/channel/sync')) return { status: 200, data: { messages: [] } };
    if (url.includes('/message/pinned/sync')) {
      return {
        status: 200,
        data: {
          pinned_messages: [{ message_id: 'm-1', message_seq: 7, version: 2 }],
          messages: [{ message_id: 'm-1', message_seq: 7, payload: { type: 1, text: '关键约束' } }]
        }
      };
    }
    throw new Error(`unexpected ${url}`);
  });

  const store = useMessageStore();
  const pins = await store.syncPinnedMessages('group-1', 2);
  expect(pins[0].remoteExtra.isPinned).toBe(true);
  expect(store.pinnedVersions['group-1:2']).toBe(2);
});
```

**Step 2: Run failing test**

```bash
cd sections/agenthub_ui
pnpm test:unit tests/unit/im-domain.spec.js
```

Expected: FAIL on missing actions / version state.

**Step 3: Implement store actions**

Add:

- `pinnedVersions: {}`
- `getPinnedMessages(channelId, channelType)`
- `togglePinnedMessage(channelId, channelType, msg)`
- `syncPinnedMessages(channelId, channelType)`
- `clearPinnedMessages(channelId, channelType)`
- Normalization helper for `message_id`, `message_idstr`, `message_seq`, `client_msg_no`, `payload`, and `message_extra`.

Keep the implementation close to `im_web` but map to AgentHub's display message shape (`id`, `messageID`, `messageSeq`, `clientMsgNo`, `content`, `remoteExtra`).

**Step 4: Verify**

```bash
cd sections/agenthub_ui
pnpm test:unit tests/unit/im-domain.spec.js
```

Expected: PASS.

**Commit checkpoint:**

```bash
git commit -m "009 阶段2：消息 store 支持置顶同步"
```

---

## Task 3: Wire Message Menu, Bubble Badge, and Page Actions

**Files:**
- Modify: `sections/agenthub_ui/components/chat/MessageContextMenu.vue`
- Modify: `sections/agenthub_ui/components/chat/MessageBubble.vue`
- Modify: `sections/agenthub_ui/pages/chat/index.vue`
- Modify: `sections/agenthub_ui/pages/chat/detail.vue`
- Test: `sections/agenthub_ui/.ai/tests/manual-message-pins-smoke.mjs`

**Step 1: Add H5 smoke before implementation**

Create a smoke script that:

1. Opens a seeded or live conversation.
2. Right-clicks / long-presses a message bubble.
3. Asserts the menu contains `Pin 为长期上下文`.
4. Clicks it, reloads, and asserts the message shows pinned state.
5. Opens menu again and asserts `取消长期上下文 pin`.

Run:

```bash
cd sections/agenthub_ui
node .ai/tests/manual-message-pins-smoke.mjs
```

Expected before implementation: FAIL because menu item is absent.

**Step 2: Add menu item**

In `MessageContextMenu.vue`, add a non-destructive item before delete:

```js
{
  action: props.msg?.remoteExtra?.isPinned || props.msg?.isPinned ? 'unpin-context' : 'pin-context',
  label: props.msg?.remoteExtra?.isPinned || props.msg?.isPinned ? '取消长期上下文 pin' : 'Pin 为长期上下文',
  icon: 'pin',
  disabled: isRevoked.value
}
```

**Step 3: Add bubble badge**

In `MessageBubble.vue`, render a compact pin indicator when `data.remoteExtra?.isPinned || data.isPinned` is true. Keep it visually small and do not change bubble width.

**Step 4: Wire page actions**

In both chat pages:

- Handle `pin-context` and `unpin-context`.
- Call `messageStore.togglePinnedMessage(channelId, channelType, msg)`.
- After success, call the Clowder context mirror action from Task 5 when a `threadId` is known.
- Show toast on success/failure.

**Step 5: Hydrate pins on conversation switch**

When active conversation changes or messages are loaded, call:

```js
messageStore.syncPinnedMessages(channelId, channelType).catch(() => undefined);
```

Expected behavior: refresh keeps pinned state.

**Verification:**

```bash
cd sections/agenthub_ui
pnpm test:unit tests/unit/im-domain.spec.js
node .ai/tests/manual-message-pins-smoke.mjs
```

**Commit checkpoint:**

```bash
git commit -m "009 阶段3：消息菜单与气泡接入长期上下文 pin"
```

---

## Task 4: Add Conversation Pinned Context List

**Files:**
- Create: `sections/agenthub_ui/components/chat/PinnedContextPanel.vue`
- Modify: `sections/agenthub_ui/components/chat/RightWorkspace.vue`
- Modify: `sections/agenthub_ui/pages/chat/index.vue`
- Modify: `sections/agenthub_ui/pages/chat/detail.vue`
- Test: `sections/agenthub_ui/.ai/tests/manual-message-pins-smoke.mjs`

**Step 1: Write smoke assertion**

Extend the smoke script to assert:

- The active conversation exposes a pinned context list entry.
- The list shows sender, excerpt, pinned/degraded state, and unpin button.
- Clicking a list item scrolls or navigates to the source message when present.

Expected before implementation: FAIL because list is absent.

**Step 2: Build panel**

`PinnedContextPanel.vue` props:

```js
defineProps({
  channelId: { type: String, required: true },
  channelType: { type: Number, required: true },
  threadId: { type: String, default: '' }
});
```

Panel states:

- Empty: no pins.
- Active: list of pinned messages.
- Degraded: source unavailable / revoked / permission denied.
- Unbound: pinned message is saved in IM but not injected into Clowder context.

Emits:

- `jump-message`
- `unpin`

**Step 3: Mount in existing workspace**

Mount in `RightWorkspace.vue` for desktop. For mobile/detail pages, expose the same panel through an existing secondary pane or action entry without adding a landing screen.

**Step 4: Verify**

```bash
cd sections/agenthub_ui
node .ai/tests/manual-message-pins-smoke.mjs
```

Expected: PASS for pin list, source jump, and unpin path.

**Commit checkpoint:**

```bash
git commit -m "009 阶段4：新增会话长期上下文列表"
```

---

## Task 5: Add Clowder Manual Context Pin API and Store

**Files:**
- Modify: `sections/agenthub_ui/api/clowder.js`
- Modify: `sections/agenthub_ui/stores/clowder.js`
- Create: `sections/clowder-ai/packages/api/src/domains/cats/services/stores/ports/ManualContextPinStore.ts`
- Create: `sections/clowder-ai/packages/api/src/domains/cats/services/stores/redis/RedisManualContextPinStore.ts`
- Create or modify: `sections/clowder-ai/packages/api/src/routes/manual-context-pins.ts`
- Modify: `sections/clowder-ai/packages/api/src/routes/index.ts`
- Modify: `sections/clowder-ai/packages/api/src/index.ts`
- Test: `sections/clowder-ai/packages/api/test/manual-context-pins.test.js`
- Test: `sections/agenthub_ui/tests/unit/clowder-agent.spec.js`

**Step 1: Write backend failing tests**

Cover:

- `POST /api/threads/:threadId/manual-context-pins` upserts by `messageId`.
- `GET /api/threads/:threadId/manual-context-pins` returns active pins newest first, max 5 by default.
- `DELETE /api/threads/:threadId/manual-context-pins/:pinId` marks status `removed`.
- Deleted / revoked source status is preserved and excluded from active context injection.
- Store is per thread and per user where existing route auth provides user identity.

**Step 2: Implement store port**

Port methods:

```ts
export interface IManualContextPinStore {
  upsert(pin: ManualContextPin): Promise<ManualContextPin>;
  listActive(threadId: string, options?: { limit?: number }): Promise<ManualContextPin[]>;
  markRemoved(threadId: string, pinId: string, removedBy: string): Promise<void>;
  markSourceStatus(threadId: string, messageId: string, status: ManualContextPin['status']): Promise<void>;
}
```

**Step 3: Add routes**

Route payload should use the terminal schema and fail closed on missing `threadId`, `messageId`, or `contentExcerpt`.

**Step 4: Add AgentHub API/store mirror**

In `api/clowder.js`:

```js
listManualContextPins(threadId) {
  return request(`clowder/thread/${encodeURIComponent(threadId)}/manual-context-pins`);
},
upsertManualContextPin(threadId, data) {
  return request(`clowder/thread/${encodeURIComponent(threadId)}/manual-context-pins`, { method: 'POST', data });
},
removeManualContextPin(threadId, pinId) {
  return request(`clowder/thread/${encodeURIComponent(threadId)}/manual-context-pins/${encodeURIComponent(pinId)}`, { method: 'DELETE' });
}
```

In `stores/clowder.js`, add actions:

- `listManualContextPins(threadId)`
- `upsertManualContextPin(threadId, pinPayload)`
- `removeManualContextPin(threadId, pinId)`

**Verification:**

```bash
cd sections/clowder-ai/packages/api
pnpm build
node --test test/manual-context-pins.test.js

cd ../../../../agenthub_ui
pnpm test:unit tests/unit/clowder-agent.spec.js
```

**Commit checkpoint:**

```bash
git commit -m "009 阶段5：Clowder 持久化长期上下文 pin"
```

---

## Task 6: Inject Manual Pins into F148 Context and Briefing

**Files:**
- Modify: `sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/context-transport.ts`
- Modify: `sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/route-helpers.ts`
- Modify: `sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/format-briefing.ts`
- Modify: `sections/clowder-ai/packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts`
- Test: `sections/clowder-ai/packages/api/test/f148-context-transport.test.js`
- Test: `sections/clowder-ai/packages/api/test/f148-assemble-incremental.test.js`

**Step 1: Write failing routing tests**

Add tests:

- Warm path includes `[Manual context pins` before regular history.
- Cold smart-window path includes manual pins before automatic anchors.
- Manual pins are capped to 5 and sanitized with existing injected-content sanitizer.
- `source_deleted`, `permission_denied`, and `removed` pins are not injected.
- `briefingContext.manualContextPins` is present when pins were injected.
- Missing `manualContextPinStore` keeps output identical to current behavior.

**Step 2: Add formatter**

In `context-transport.ts`, add:

```ts
export function formatManualContextPins(pins: ManualContextPinSummary[], truncateLimit: number): string[] {
  return pins
    .filter((pin) => pin.status === 'active')
    .slice(0, 5)
    .map((pin) => `[Manual Pin @${pin.senderName || 'unknown'}: ${pin.messageId}] ${sanitizeInjectedContent(pin.contentExcerpt).slice(0, truncateLimit)}`);
}
```

Reuse the actual sanitizer and truncation style already present in the file; do not create a second sanitizer.

**Step 3: Extend deps and result**

Add optional dependency to `RouteStrategyDeps`:

```ts
manualContextPinStore?: IManualContextPinStore;
```

Add to `IncrementalContextResult.briefingContext`:

```ts
manualContextPins?: ManualContextPinSummary[];
```

**Step 4: Inject in warm and cold paths**

Read pins once near navigation header assembly:

```ts
const manualPins = await deps.manualContextPinStore?.listActive(threadId, { limit: 5 }).catch(() => []);
```

Insert formatted manual pins:

- Warm path: after `navigationHeader`, before `[对话历史增量 - 未发送过 ...]`.
- Cold path: before tombstone / automatic anchor sections.

Manual pins do not count as automatic anchors and should not alter `coverageMap.anchorIds`.

**Step 5: Update briefing**

Add a compact section to `format-briefing.ts` expanded view:

```text
**手动长期上下文**:
- {senderName}: {contentExcerpt}
```

Keep default collapsed summary short: include `手动 pin N 条` only when N > 0.

**Verification:**

```bash
cd sections/clowder-ai/packages/api
pnpm build
node --test test/f148-context-transport.test.js test/f148-assemble-incremental.test.js
```

**Commit checkpoint:**

```bash
git commit -m "009 阶段6：F148 注入手动长期上下文 pin"
```

---

## Task 7: End-to-End H5 Verification

**Files:**
- Modify: `sections/agenthub_ui/.ai/tests/manual-message-pins-smoke.mjs`
- Evidence output: `sections/agenthub_ui/.ai/tests-e2e/manual-pins-<timestamp>/`

**Setup:**

```bash
cd /home/yunyi/Desktop/Bytedance_cmp/seedcmp
bash scripts/start-im-clowder.sh start

cd sections/agenthub_ui
pnpm dev:h5
```

**Smoke steps:**

1. Log in with an existing test account.
2. Open a Clowder-bound project group or direct cat chat.
3. Pin a visible user message.
4. Refresh H5 and verify the bubble badge and pinned context list remain.
5. Trigger a Clowder cat invocation.
6. Capture context briefing and verify manual pin count / summary.
7. Unpin the message.
8. Trigger another invocation and verify the pin no longer appears.
9. Revoke or delete a pinned source message and verify degraded state.

**Evidence:**

- `01-menu-pin.png`
- `02-badge-after-pin.png`
- `03-refresh-pin-list.png`
- `04-briefing-manual-pin.png`
- `05-unpin-removed.png`
- `06-degraded-source-deleted.png`
- `diagnostics.log`
- `network.json`

**Verification commands:**

```bash
cd sections/agenthub_ui
pnpm test:unit
pnpm build:h5
node .ai/tests/manual-message-pins-smoke.mjs
```

Expected: all pass, screenshots written under `.ai/tests-e2e/manual-pins-<timestamp>/`.

**Commit checkpoint:**

```bash
git commit -m "009 阶段7：长期上下文 pin 端到端验收"
```

---

## Open Questions

**技术 OQ - Clowder route registration path:** If `src/index.ts` still owns local `/api/threads/:threadId/artifacts` route registration directly, should manual context pins live there or in a new `routes/manual-context-pins.ts` plugin?
Decision: implement the smallest route shape that matches current registration style; no CVO escalation.

**技术 OQ - Ordinary non-Clowder chats:** Should pins in ordinary chats be shown as regular pinned messages even when they cannot enter Clowder context?
Decision: yes, with explicit unbound state in `PinnedContextPanel`.

**价值 OQ - Agent-suggested pins:** Should agents suggest “pin this?” after important decisions?
Decision: out of scope for Issue 009; requires separate UX approval because it changes who initiates long-term memory.

## Final Verification Gate

Run all of these before closing Issue 009:

```bash
cd sections/agenthub_ui
pnpm test:unit
pnpm build:h5
node .ai/tests/manual-message-pins-smoke.mjs

cd ../clowder-ai/packages/api
pnpm build
node --test test/manual-context-pins.test.js test/f148-context-transport.test.js test/f148-assemble-incremental.test.js
```

Close the issue only after the evidence directory contains screenshots for pin, refresh, briefing visibility, unpin, and degraded source state.
