# V3-10 Cross-device Drafts And AI Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix V3-10 so sent drafts clear across browsers and AI/Clowder messages support visible transcript display, copy, file send, and image preview.

**Architecture:** Keep ownership in existing stores/components. `conversationStore` owns synced draft state; `MessageInput` reflects active conversation draft updates without overwriting newly typed text; `TextCell`, `MessageList`, `ImageCell`, `ChatView`, and `ChatSidePreview` extend existing message action and preview paths.

**Tech Stack:** Vue 3, Pinia, Vitest, Testing Library Vue, Playwright.

---

### Task 1: Cross-device Draft Clearing

**Files:**
- Modify: `sections/im_web/packages/datasource-vue/src/stores/conversationStore.ts`
- Modify: `sections/im_web/apps/chat/src/components/MessageInput.vue`
- Test: `sections/im_web/apps/chat/tests/clowderVirtualConversationDraft.test.ts`

- [x] Add failing store test for remote empty draft clearing local `drafts` and conversation `draft`.
- [x] Add failing source/component guard for `MessageInput` reacting to active conversation draft changes.
- [x] Implement remote draft application in `syncExtra()`.
- [x] Implement guarded input update in `MessageInput`.

### Task 2: Clowder Visible Transcript

**Files:**
- Modify: `sections/im_web/packages/base-vue/src/components/messages/TextCell.vue`
- Test: `sections/im_web/apps/chat/tests/clowderMessagePresentation.test.ts`

- [x] Add failing render test for array/block transcript aliases.
- [x] Normalize `thinking`, `thoughts`, `reasoning`, and `transcript` payload shapes into visible text sections.
- [x] Keep hidden model chain-of-thought out of scope; render only payload fields already present in the message.

### Task 3: AI Copy And Image Preview

**Files:**
- Modify: `sections/im_web/apps/chat/src/components/MessageList.vue`
- Modify: `sections/im_web/packages/base-vue/src/components/messages/ImageCell.vue`
- Modify: `sections/im_web/apps/chat/src/views/ChatView.vue`
- Modify: `sections/im_web/apps/chat/src/components/ChatSidePreview.vue`
- Test: `sections/im_web/apps/chat/tests/clowderMessagePresentation.test.ts`
- Test: `sections/im_web/apps/chat/tests/messageMediaCells.test.ts`

- [x] Add failing tests for AI copy including visible transcript text.
- [x] Add failing tests for image-cell preview event and side preview image support.
- [x] Implement message copy text builder with clipboard fallback.
- [x] Emit image preview payload from `ImageCell`, forward through `MessageList`, and render in `ChatSidePreview`.

### Task 4: Verification

**Files:**
- Create: `/tmp/playwright-test-v3-10-ai-actions.js`
- Create: `sections/im_web/.ai/V3.0/tests-e2e/v3-10-ai-actions-*/summary.md`

- [x] Run targeted Vitest tests and confirm pass.
- [x] Run `pnpm --filter chat build`.
- [x] Run Playwright with two browser contexts against `http://localhost:3000`.
- [x] Update V3-10 issue with resolution evidence.
